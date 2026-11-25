// The only AI step: choose WHICH transcript segments become WHICH scene.
// Works with any OpenAI-compatible endpoint. Default: Google Gemini free tier.
// Ollama (fully local): LLM_BASE_URL=http://localhost:11434/v1 LLM_MODEL=llama3.1
import fs from "node:fs";
import { NAMES } from "./build.mjs";

try { process.loadEnvFile(".env"); } catch {} // key lives in reel/.env

const RED_LINES = fs.readFileSync(new URL("./red-lines.md", import.meta.url), "utf8");
const NAME_LIST = NAMES.map(([, latin]) => latin).join(", ");

const BASE = process.env.LLM_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai";
const MODEL = process.env.LLM_MODEL ?? "gemini-3.5-flash"; // 3.8 is often overloaded (503) on the free tier
const KEY = process.env.LLM_API_KEY ?? process.env.GEMINI_API_KEY ?? "";

const system = (max) => `You are a story editor for an Islamic education channel.
You turn a talk into a vertical social reel of at most ${max} seconds.

${RED_LINES}

You never write captions. You only choose transcript segment numbers; the captions are the speaker's exact words.

Scene types:
- "lines": captions only.
- "reveal": one large Arabic word ("arabic": a name from the list, usually "Allah"), for a key moment about Allah.
- "verse": Quran verse card. Add "verseKey" (e.g. "2:186") ONLY if the speaker quotes or clearly refers to that exact verse.
- "names": cycles through Names of Allah. Add "names": transliterations from this list only: ${NAME_LIST}.
- "doors": 99 glowing doors. Only when the speaker talks about the ninety-nine names.

Return JSON only, no prose:
{"endTitle": "<a short part copied exactly from the video title>",
 "scenes": [{"type": "lines", "segments": [0,1,2]}, {"type": "verse", "segments": [7,8], "verseKey": "7:180"}]}

Rules for "segments": consecutive numbers, scenes in original order, no overlap,
total duration of all chosen segments <= ${max - 3} seconds. 4 to 7 scenes. Open with a strong hook,
end on the strongest line. Prefer complete sentences.`;

export async function makePlan({ transcript, info, max, feedback, previous }) {
  if (!KEY && !BASE.includes("localhost")) {
    throw new Error("No LLM key. Get a free Gemini key at https://aistudio.google.com/apikey and paste it into reel/.env");
  }
  const segments = transcript
    .map((s) => `[${s.i}] ${s.start.toFixed(1)}-${s.end.toFixed(1)}s: ${s.text}`)
    .join("\n");
  const user = `Video title: ${info.title}\n\nTranscript segments:\n${segments}` +
    (feedback
      ? `\n\nYour previous plan:\n${JSON.stringify(previous)}\n\nIt was rejected by the validator. Fix these problems:\n${feedback}`
      : "");

  const call = () => fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${KEY}` },
    signal: AbortSignal.timeout(120_000),
    body: JSON.stringify({
      model: MODEL,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system(max) },
        { role: "user", content: user },
      ],
    }),
  });
  // Free tiers return 429/503 when busy: retry with backoff (5s, 15s, 45s).
  let res = await call();
  for (const wait of [5, 15, 45]) {
    if (res.status !== 429 && res.status !== 503) break;
    console.log(`  LLM busy (${res.status}), retrying in ${wait}s...`);
    await new Promise((r) => setTimeout(r, wait * 1000));
    res = await call();
  }
  if (!res.ok) throw new Error(`LLM error ${res.status}: ${await res.text()}`);
  const text = (await res.json()).choices[0].message.content;
  return JSON.parse(text.replace(/^```(json)?|```$/g, "").trim());
}
