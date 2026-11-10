import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const outDir = path.join(".runtime", "tests", "material-seed");
const seedPath = path.join(outDir, "material-seed.jsonl");
const summaryPath = path.join(outDir, "material-seed-summary.json");

fs.mkdirSync(path.join(repoRoot, outDir), { recursive: true });
execFileSync(process.execPath, [
  "pipeline/material-seed.mjs",
  "--asset-index",
  "tests/fixtures/asset-index.sample.json",
  "--out",
  seedPath,
  "--summary",
  summaryPath,
], {
  cwd: repoRoot,
  stdio: "inherit",
});

const rows = fs.readFileSync(path.join(repoRoot, seedPath), "utf8").trim().split("\n").map((line) => JSON.parse(line));
const summary = JSON.parse(fs.readFileSync(path.join(repoRoot, summaryPath), "utf8"));

assert(rows.length === 1, `expected 1 seed row, got ${rows.length}`);
assert(summary.rowCount === 1, `expected rowCount 1, got ${summary.rowCount}`);
assert(rows[0].id === "city-night:shot-001", "unexpected row id");
assert(rows[0].indexText.includes("深夜城市航拍"), "indexText missing description");
assert(rows[0].metadata.kind === "atmosphere", "metadata.kind mismatch");

console.log("material seed fixture ok");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
