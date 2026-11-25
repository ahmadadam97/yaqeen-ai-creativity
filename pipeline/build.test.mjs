// npm test   (verse lookups need internet)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import { buildStoryboard, verifySacred } from "./build.mjs";

const transcript = [0, 1, 2, 3].map((i) => ({ i, start: i * 5, end: i * 5 + 5, text: `line ${i}` }));
const info = { title: "The Name I Need | Trailer", url: "u", duration: 30, audioFile: "a.wav" };
const build = (scenes, max = 60) => buildStoryboard({ plan: { scenes }, transcript, info, max });

test("captions are the speaker's words and render is not pre-approved", async () => {
  const { storyboard } = await build([{ type: "lines", segments: [0, 1] }, { type: "reveal", segments: [2], arabic: "Allah" }]);
  assert.deepEqual(storyboard.scenes[0].lines.map((l) => l.text), ["line 0", "line 1"]);
  assert.equal(storyboard.scenes[1].arabic, "الله");
  assert.equal(storyboard.review.approved, false);
});

test("red lines reject bad plans", async () => {
  await assert.rejects(build([{ type: "image", segments: [0] }, { type: "lines", segments: [1] }]), /unknown type/);
  await assert.rejects(build([{ type: "reveal", segments: [0], arabic: "Muhammad" }, { type: "lines", segments: [1] }]), /not in the approved Names/);
  await assert.rejects(build([{ type: "names", segments: [0], names: ["Al-Qarib"] }, { type: "lines", segments: [1] }]), /not in the approved Names/);
  await assert.rejects(build([{ type: "lines", segments: [0, 2] }, { type: "lines", segments: [3] }]), /consecutive/);
  await assert.rejects(build([{ type: "lines", segments: [2] }, { type: "lines", segments: [0] }]), /out of order/);
  await assert.rejects(build([{ type: "lines", segments: [0, 1, 2] }, { type: "lines", segments: [3] }], 10), /maximum/);
  await assert.rejects(build([{ type: "verse", segments: [0], verseKey: "7:999" }, { type: "lines", segments: [1] }]), /not found/);
});

test("verse text comes from Quran.com, not the AI", async () => {
  const { storyboard } = await build([{ type: "verse", segments: [0], verseKey: "7:180" }, { type: "lines", segments: [1] }]);
  assert.match(storyboard.scenes[0].verse.arabic, /^[؀-ۿ\s࣓-ࣿ]+$/);
  assert.match(storyboard.scenes[0].verse.translation, /^And to Allāh belong the best names/);
  assert.equal(storyboard.scenes[0].verse.surah, "Al-A'raf");
});

test("end card is silent and never zero-length, even when the last line ends the video", async () => {
  const { storyboard } = await build([{ type: "lines", segments: [0, 1] }, { type: "lines", segments: [2, 3] }]);
  const end = storyboard.scenes.at(-1);
  assert.equal(end.type, "end");
  assert.equal(end.audio.to - end.audio.from, 3); // last segment ends at 20s = video end
});

test("verse scenes too short to read are rejected", async () => {
  const short = [{ i: 0, start: 0, end: 2, text: "a" }, { i: 1, start: 2, end: 9, text: "b" }];
  await assert.rejects(
    buildStoryboard({ plan: { scenes: [{ type: "verse", segments: [0], verseKey: "7:180" }, { type: "lines", segments: [1] }] }, transcript: short, info, max: 60 }),
    /at least 4s/
  );
});

test("render re-check catches sacred text edited after review", async () => {
  const { storyboard } = await build([{ type: "verse", segments: [0], verseKey: "7:180" }, { type: "names", segments: [1], names: ["Ar-Rahman"] }]);
  assert.deepEqual(await verifySacred(storyboard), []);
  storyboard.scenes[0].verse.translation = "edited";
  storyboard.scenes[1].names[0].meaning = "edited";
  assert.equal((await verifySacred(storyboard)).length, 2);
});

test("render gate: refuses unapproved or tampered storyboards", async () => {
  const dir = "out/test-gate";
  const { storyboard } = await build([{ type: "verse", segments: [0], verseKey: "7:180" }, { type: "lines", segments: [1] }]);
  const render = () => spawnSync(process.execPath, ["pipeline/render.mjs", "test-gate"], { encoding: "utf8" });
  fs.mkdirSync(dir, { recursive: true });
  try {
    fs.writeFileSync(`${dir}/storyboard.json`, JSON.stringify(storyboard));
    let r = render();
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Not approved/);

    storyboard.review = { ...storyboard.review, approved: true, reviewer: "Test" };
    storyboard.scenes[0].verse.arabic = "edited";
    fs.writeFileSync(`${dir}/storyboard.json`, JSON.stringify(storyboard));
    r = render();
    assert.equal(r.status, 1);
    assert.match(r.stderr, /Blocked/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
