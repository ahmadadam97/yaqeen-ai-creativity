// Usage: node pipeline/run.mjs <youtube-url> [maxSeconds=60]
// Steps: fetch audio -> transcribe (Whisper, local) -> plan (free LLM) -> build + validate -> review.md
// Each step caches its output in out/<id>/, so re-runs are free and resumable.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { installWhisperCpp, downloadWhisperModel, transcribe } from "@remotion/install-whisper-cpp";
import { makePlan } from "./plan.mjs";
import { buildStoryboard, PlanError } from "./build.mjs";

const [url, maxArg] = process.argv.slice(2);
if (!url) throw new Error("Usage: node pipeline/run.mjs <youtube-url> [maxSeconds]");
const max = Number(maxArg ?? 60);
// Handles watch?v=ID, youtu.be/ID?si=..., and shorts/ID. The id becomes a folder name, so it must be safe.
const u = new URL(url);
const id = u.searchParams.get("v") ?? u.pathname.split("/").filter(Boolean).pop();
if (!/^[\w-]{6,20}$/.test(id ?? "")) throw new Error(`No YouTube video id found in ${url}`);
const dir = path.join("out", id);
const out = (name) => path.join(dir, name);
// Remotion ships a cross-platform ffmpeg; call it through its CLI.
const ffmpeg = (args) =>
  execFileSync(process.execPath, ["node_modules/@remotion/cli/remotion-cli.js", "ffmpeg", "-y", "-loglevel", "error", ...args]);
const WHISPER = path.resolve("whisper.cpp");

fs.mkdirSync(dir, { recursive: true });
fs.mkdirSync("public", { recursive: true });

const readJson = (f) => JSON.parse(fs.readFileSync(f, "utf8"));
const writeJson = (f, data) => fs.writeFileSync(f, JSON.stringify(data, null, 2));
const cached = async (name, make) => {
  if (!fs.existsSync(out(name))) writeJson(out(name), await make());
  return readJson(out(name));
};
const step = (msg) => console.log(`\n▶ ${msg}`);

step("1/4 Fetch audio + metadata");
const info = await cached("info.json", () => {
  const json = execFileSync("python", [
    "-m", "yt_dlp", "-f", "bestaudio", "--no-playlist", "-o", out("source.%(ext)s"), "-j", "--no-simulate", url,
  ], { maxBuffer: 64 * 1024 * 1024 }).toString(); // yt-dlp's JSON can exceed the 1 MB default
  const { title, duration, uploader } = JSON.parse(json);
  const src = fs.readdirSync(dir).find((f) => f.startsWith("source."));
  ffmpeg(["-i", out(src), "-ar", "48000", "-ac", "2", `public/${id}.wav`]);
  ffmpeg(["-i", out(src), "-ar", "16000", "-ac", "1", out("speech16k.wav")]);
  return { id, url, title, duration, uploader, audioFile: `${id}.wav` };
});

step("2/4 Transcribe with Whisper (local, free)");
const transcript = await cached("transcript.json", async () => {
  await installWhisperCpp({ to: WHISPER, version: "1.5.5" });
  await downloadWhisperModel({ model: "base.en", folder: WHISPER });
  const { transcription } = await transcribe({
    inputPath: path.resolve(out("speech16k.wav")),
    whisperPath: WHISPER,
    whisperCppVersion: "1.5.5",
    model: "base.en",
    tokenLevelTimestamps: true, // per-word timing; grouped into sentences below
    // Domain vocabulary so Whisper hears "Allah", not "a love"
    additionalArgs: [["--prompt", "A talk about Allah, the Quran, the Prophet Muhammad and the names of Allah."]],
  });
  // Group word tokens into caption-sized sentences (split long ones at commas).
  const lines = [];
  let cur = null;
  for (const t of transcription) {
    cur ??= { start: t.offsets.from / 1000, text: "" };
    cur.text += t.text;
    cur.end = t.offsets.to / 1000;
    const words = cur.text.trim().split(/\s+/).length;
    if (/[.?!]$/.test(cur.text) || (/,$/.test(cur.text) && words >= 8)) (lines.push(cur), (cur = null));
  }
  if (cur) lines.push(cur);
  return lines
    .map((l) => ({ ...l, text: l.text.replace(/\[[^\]]*\]|\([^)]*\)/g, "").trim() })) // drop [Music]
    .filter((l) => /[a-z]/i.test(l.text))
    .map((l, i) => ({ i, start: l.start, end: l.end, text: l.text }));
});

step("3/4 Plan the reel with the LLM, then validate against the red lines");
let plan = await cached("plan.json", () => makePlan({ transcript, info, max }));
let result;
for (let attempt = 1; ; attempt++) {
  try {
    result = await buildStoryboard({ plan, transcript, info, max });
    break;
  } catch (err) {
    if (!(err instanceof PlanError) || attempt > 2) throw err; // network/code errors are not the AI's fault
    console.log(`  Plan rejected, asking the LLM to fix it:\n${err.message}`);
    plan = await makePlan({ transcript, info, max, feedback: err.message, previous: plan });
    writeJson(out("plan.json"), plan);
  }
}

step("4/4 Write storyboard + review sheet");
writeJson(out("storyboard.json"), result.storyboard);
fs.writeFileSync(out("review.md"), result.review);
console.log(`\nDone. Review ${out("review.md")}, set "approved": true in ${out("storyboard.json")},`);
console.log(`then render with: node pipeline/render.mjs ${id}`);
