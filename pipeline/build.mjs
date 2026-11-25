// Turns the LLM plan into a storyboard and enforces the red lines in code.
// Anything the AI got wrong becomes an error (sent back to the LLM); anything sensitive becomes a review flag.
import fs from "node:fs";

export const NAMES = JSON.parse(fs.readFileSync(new URL("./names.json", import.meta.url), "utf8"));
const TYPES = ["lines", "reveal", "verse", "names", "doors"];
const FPS = 30;
const END_SECONDS = 3;
const MIN_VERSE_SECONDS = 4; // time to reveal the Arabic and show the translation
const MAX_VERSE_WORDS = 40; // longer verses overflow a 1920px card

/** A problem with the AI's plan (worth sending back to the AI), not a network or code failure. */
export class PlanError extends Error {}

const norm = (s) => String(s).toLowerCase().replace(/[^a-z؀-ۿ]/g, "");
const findName = (q) => NAMES.find(([ar, latin]) => norm(ar) === norm(q) || norm(latin) === norm(q));
const round = (n) => Math.round(n * 100) / 100;

const getJson = async (url) => {
  const r = await fetch(url, { signal: AbortSignal.timeout(15_000) });
  if (r.status === 404) return {};
  if (!r.ok) throw new Error(`Quran.com API ${r.status} for ${url}`);
  return r.json();
};

async function fetchVerse(key) {
  const api = "https://api.quran.com/api/v4";
  const v = await getJson(`${api}/verses/by_key/${key}?fields=text_uthmani&translations=20`);
  if (!v.verse?.translations?.[0]) return null;
  const c = await getJson(`${api}/chapters/${key.split(":")[0]}`);
  return {
    key,
    surah: c.chapter.name_simple,
    arabic: v.verse.text_uthmani,
    translation: v.verse.translations[0].text.replace(/<sup[^>]*>.*?<\/sup>/g, ""),
    source: "Quran.com API v4 · Saheeh International",
  };
}

export async function buildStoryboard({ plan, transcript, info, max }) {
  const errors = [];
  const flags = ["Captions come from automatic transcription: check spelling and capitalisation (He/Him for Allah)."];
  const scenes = [];
  let lastEnd = -1;

  for (const [n, s] of (plan.scenes ?? []).entries()) {
    const where = `Scene ${n + 1} (${s.type})`;
    const ids = s.segments ?? [];
    const segs = ids.map((i) => transcript[i]);
    if (!TYPES.includes(s.type)) { errors.push(`${where}: unknown type.`); continue; }
    if (!segs.length || segs.includes(undefined)) { errors.push(`${where}: invalid segment numbers.`); continue; }
    if (ids.some((id, k) => k && id !== ids[k - 1] + 1)) errors.push(`${where}: segments must be consecutive.`);

    const from = segs[0].start;
    const to = segs.at(-1).end;
    if (from < lastEnd) errors.push(`${where}: overlaps or is out of order.`);
    lastEnd = to;

    // Captions = the speaker's exact words. The AI cannot add text.
    const scene = { type: s.type, audio: { from, to }, lines: segs.map((x) => ({ at: round(x.start - from), text: x.text })) };

    if (s.type === "reveal") {
      const name = findName(s.arabic ?? "Allah");
      if (!name) errors.push(`${where}: "${s.arabic}" is not in the approved Names list.`);
      else scene.arabic = name[0];
    }
    if (s.type === "names") {
      const found = (s.names ?? []).map((q) => [q, findName(q)]);
      found.filter(([, f]) => !f).forEach(([q]) => errors.push(`${where}: "${q}" is not in the approved Names list.`));
      scene.names = found.filter(([, f]) => f).map(([, [arabic, latin, meaning]]) => ({ arabic, latin, meaning }));
      if (!scene.names.length) errors.push(`${where}: needs at least one name.`);
    }
    if (s.type === "verse") {
      const verse = /^\d{1,3}:\d{1,3}$/.test(s.verseKey ?? "") && (await fetchVerse(s.verseKey));
      if (!verse) errors.push(`${where}: verse "${s.verseKey}" not found.`);
      else if (verse.arabic.split(" ").length > MAX_VERSE_WORDS) errors.push(`${where}: verse ${verse.key} is too long for a card; pick a shorter one or none.`);
      else if (to - from < MIN_VERSE_SECONDS) errors.push(`${where}: verse scenes need at least ${MIN_VERSE_SECONDS}s of segments.`);
      else {
        scene.verse = verse;
        flags.push(`Verse ${verse.key} (${verse.surah}): confirm it matches what the speaker says at ${from.toFixed(1)}s.`);
      }
    }
    scenes.push(scene);
  }

  const total = scenes.reduce((t, s) => t + s.audio.to - s.audio.from, 0) + END_SECONDS;
  if (scenes.length < 2) errors.push("Need at least 2 scenes.");
  if (total > max) errors.push(`Reel is ${total.toFixed(1)}s; maximum is ${max}s. Use fewer or shorter segments.`);

  const endTitle = plan.endTitle && info.title.toLowerCase().includes(plan.endTitle.toLowerCase()) ? plan.endTitle : info.title;
  scenes.push({
    type: "end",
    audio: { from: lastEnd, to: lastEnd + END_SECONDS }, // silent: the template plays no audio here (no unreviewed speech)
    lines: [],
    title: endTitle,
    footer: `AI-assisted cut of the original video · ${info.uploader ?? ""}`.trim(),
  });

  if (errors.length) throw new PlanError(errors.map((e) => `- ${e}`).join("\n"));

  const storyboard = {
    source: { title: info.title, url: info.url, audioFile: info.audioFile },
    fps: FPS,
    review: { approved: false, reviewer: "", flags },
    scenes,
  };
  return { storyboard, review: reviewSheet(storyboard, total) };
}

/** Re-checked at render time: sacred text must still match the sources, even after manual edits. */
export async function verifySacred(sb) {
  const errors = [];
  for (const s of sb.scenes) {
    if (s.arabic && !NAMES.some(([ar]) => ar === s.arabic)) errors.push(`"${s.arabic}" is not an approved Name.`);
    for (const n of s.names ?? []) {
      if (!NAMES.some(([ar, latin, meaning]) => ar === n.arabic && latin === n.latin && meaning === n.meaning)) {
        errors.push(`Name "${n.latin}" does not match names.json.`);
      }
    }
    if (s.verse) {
      const v = await fetchVerse(s.verse.key);
      if (!v || v.arabic !== s.verse.arabic || v.translation !== s.verse.translation) {
        errors.push(`Verse ${s.verse.key} text differs from Quran.com.`);
      }
    }
  }
  return errors;
}

const reviewSheet = (sb, total) => `# Review: ${sb.source.title}

Source: ${sb.source.url} · Length: ${total.toFixed(1)}s

## Check before approving
${sb.review.flags.map((f) => `- [ ] ${f}`).join("\n")}

## Scenes
${sb.scenes
  .map((s, i) => `${i + 1}. **${s.type}** (${s.audio.from.toFixed(1)}–${s.audio.to.toFixed(1)}s)` +
    (s.verse ? ` · ${s.verse.surah} ${s.verse.key}\n   > ${s.verse.arabic}\n   > ${s.verse.translation}` : "") +
    (s.names ? ` · ${s.names.map((n) => n.latin).join(", ")}` : "") +
    s.lines.map((l) => `\n   - "${l.text}"`).join(""))
  .join("\n")}

To approve: set \`"approved": true\` and your name in \`"reviewer"\` in storyboard.json, then run the render.
`;
