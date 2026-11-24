// Upstream-upgrade smoke test: after `npx remotion upgrade`, run `npm run verify:upstream`.
//
// Bundles src/index.ts once with the official @remotion/bundler, then for every registered
// composition renders one still with @remotion/renderer. Fails if a composition disappears
// compared to tests/fixtures/compositions.json, or if any still fails to render.
//
// Earth check: every composition that draws the 3D Earth must draw the whole human-geography stack
// (borders, territory, railways, cities, regions). src/earth3d/view/EarthView.tsx prints the layers it drew;
// a composition that draws only part of them fails, and so does a composition listed in
// tests/fixtures/earth-compositions.json that no longer draws the Earth at all.
//
//   node tests/verify-upstream.mjs            check all compositions
//   node tests/verify-upstream.mjs --update   rewrite the expected composition list
//   node tests/verify-upstream.mjs Foo Bar    only render these ids

import { bundle } from "@remotion/bundler";
import { getCompositions, renderStill } from "@remotion/renderer";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { earth3dWebpackOverride } from "../src/earth3d/webpackOverride.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedPath = path.join(root, "tests", "fixtures", "compositions.json");
const earthExpectedPath = path.join(root, "tests", "fixtures", "earth-compositions.json");
// Keep in sync with MAP_LAYER_IDS in src/earth3d/map/mapLayers.ts.
const MAP_LAYERS = ["nations", "occupation", "railways", "cities", "regions"];
const MAP_LOG = "[earth3d] map layers: ";
const outDir = path.join(root, "out", "verify-upstream");
const args = process.argv.slice(2);
const update = args.includes("--update");
const only = args.filter((a) => !a.startsWith("--"));

const serveUrl = await bundle({
  entryPoint: path.join(root, "src", "index.ts"),
  publicDir: path.join(root, "public"),
  // The Node bundler does not read remotion.config.ts, so pass the earth3d asset rules here too.
  webpackOverride: earth3dWebpackOverride,
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
const earthDrawn = [];
for (const comp of compositions) {
  if (only.length && !only.includes(comp.id)) continue;
  const frame = Math.min(30, comp.durationInFrames - 1);
  const output = path.join(outDir, `${comp.id}.jpeg`);
  const started = Date.now();
  const mapLogs = [];
  try {
    await renderStill({
      onBrowserLog: (log) => {
        if (log.text.startsWith(MAP_LOG)) mapLogs.push(log.text.slice(MAP_LOG.length));
      },
      composition: comp,
      serveUrl,
      output,
      frame,
      imageFormat: "jpeg",
      inputProps: comp.props,
      // The 3D Earth compositions need a GPU-backed WebGL context.
      chromiumOptions: { gl: "angle" },
      timeoutInMilliseconds: 180000,
    });
    let note = "";
    if (mapLogs.length) {
      earthDrawn.push(comp.id);
      const drawn = new Set(mapLogs.at(-1).split(",").filter(Boolean));
      const lacking = MAP_LAYERS.filter((id) => !drawn.has(id));
      if (lacking.length) {
        failed++;
        console.error(`FAIL ${comp.id}: earth drawn without map layers: ${lacking.join(", ")}`);
        continue;
      }
      note = ", earth with all map layers";
    }
    console.log(`ok   ${comp.id} (frame ${frame}, ${Date.now() - started}ms${note})`);
  } catch (error) {
    failed++;
    console.error(`FAIL ${comp.id}: ${error instanceof Error ? error.message.split("\n")[0] : error}`);
  }
}

if (!only.length) {
  if (update) {
    await writeFile(earthExpectedPath, JSON.stringify(earthDrawn, null, 2) + "\n");
    console.log(`wrote ${path.relative(root, earthExpectedPath)}: ${earthDrawn.join(", ")}`);
  }
  const earthExpected = JSON.parse(await readFile(earthExpectedPath, "utf8"));
  const gone = earthExpected.filter((id) => ids.includes(id) && !earthDrawn.includes(id));
  if (gone.length) {
    failed++;
    console.error(`FAIL earth no longer drawn by: ${gone.join(", ")}`);
  }
}

console.log(failed ? `\n${failed} problem(s).` : `\nall good, stills in ${path.relative(root, outDir)}`);
process.exit(failed ? 1 : 0);
