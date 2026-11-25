// Usage: node pipeline/render.mjs <id>
// Human-in-the-loop gate: nothing renders until a reviewer approves the storyboard,
// and sacred text is re-checked against its sources in case it was edited after review.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { verifySacred } from "./build.mjs";

// exitCode, not process.exit(): exiting with open sockets crashes Node on Windows.
const fail = (msg) => {
  console.error(msg);
  process.exitCode = 1;
};

async function main(id) {
  const file = `out/${id}/storyboard.json`;
  if (!/^[\w-]+$/.test(id ?? "") || !fs.existsSync(file)) return fail("Usage: node pipeline/render.mjs <id>  (run `npm run make` first)");
  const sb = JSON.parse(fs.readFileSync(file, "utf8"));

  if (!sb.review?.approved || !sb.review?.reviewer) {
    return fail(`Not approved. Read out/${id}/review.md, then set "approved": true and "reviewer" in ${file}.`);
  }
  const errors = await verifySacred(sb);
  if (errors.length) return fail(`Blocked: sacred text no longer matches its source.\n- ${errors.join("\n- ")}`);

  execFileSync(
    process.execPath,
    ["node_modules/@remotion/cli/remotion-cli.js", "render", "src/index.ts", "NameReel", `out/${id}/reel.mp4`, `--props=${file}`],
    { stdio: "inherit" }
  );
  console.log(`Rendered out/${id}/reel.mp4 (approved by ${sb.review.reviewer})`);
}

await main(process.argv[2]);
