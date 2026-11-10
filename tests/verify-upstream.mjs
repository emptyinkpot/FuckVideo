// Upstream-upgrade smoke test: after `npx remotion upgrade`, run `npm run verify:upstream`.
//
// Bundles src/index.ts once with the official @remotion/bundler, then for every registered
// composition renders one still with @remotion/renderer. Fails if a composition disappears
// compared to tests/fixtures/compositions.json, or if any still fails to render.
//
//   node tests/verify-upstream.mjs            check all compositions
//   node tests/verify-upstream.mjs --update   rewrite the expected composition list
//   node tests/verify-upstream.mjs Foo Bar    only render these ids

import { bundle } from "@remotion/bundler";
import { getCompositions, renderStill } from "@remotion/renderer";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedPath = path.join(root, "tests", "fixtures", "compositions.json");
const outDir = path.join(root, "out", "verify-upstream");
const args = process.argv.slice(2);
const update = args.includes("--update");
const only = args.filter((a) => !a.startsWith("--"));

const serveUrl = await bundle({
  entryPoint: path.join(root, "src", "index.ts"),
  publicDir: path.join(root, "public"),
});
const compositions = await getCompositions(serveUrl);
const ids = compositions.map((c) => c.id);
console.log(`registered compositions: ${ids.length}`);

if (update) {
  await writeFile(expectedPath, JSON.stringify(ids, null, 2) + "\n");
  console.log(`wrote ${path.relative(root, expectedPath)}`);
}

let failed = 0;
const expected = JSON.parse(await readFile(expectedPath, "utf8"));
const missing = expected.filter((id) => !ids.includes(id));
if (missing.length) {
  failed++;
  console.error(`MISSING compositions: ${missing.join(", ")}`);
}

await mkdir(outDir, { recursive: true });
for (const comp of compositions) {
  if (only.length && !only.includes(comp.id)) continue;
  const frame = Math.min(30, comp.durationInFrames - 1);
  const output = path.join(outDir, `${comp.id}.jpeg`);
  const started = Date.now();
  try {
    await renderStill({ composition: comp, serveUrl, output, frame, imageFormat: "jpeg", inputProps: comp.props });
    console.log(`ok   ${comp.id} (frame ${frame}, ${Date.now() - started}ms)`);
  } catch (error) {
    failed++;
    console.error(`FAIL ${comp.id}: ${error instanceof Error ? error.message.split("\n")[0] : error}`);
  }
}

console.log(failed ? `\n${failed} problem(s).` : `\nall good, stills in ${path.relative(root, outDir)}`);
process.exit(failed ? 1 : 0);
