#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { attachAssetsToScenes, loadAssetIndex } from "./asset-matcher.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

export function attachAssetsFile({ scenesPath, indexPath = "public/generated/asset-index.json", outputPath }) {
  const fullScenesPath = path.resolve(projectRoot, scenesPath);
  const payload = JSON.parse(readFileSync(fullScenesPath, "utf8"));
  const assets = loadAssetIndex(indexPath);
  const scenes = attachAssetsToScenes(payload.scenes || payload, assets, { minScore: 8, limit: 6 });
  const output = {
    ...payload,
    scenes,
    assetIndexPath: indexPath,
    assetMatchedAt: new Date().toISOString(),
  };
  writeFileSync(path.resolve(projectRoot, outputPath), JSON.stringify(output, null, 2), "utf8");
  return output;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    const key = toCamel(eq >= 0 ? arg.slice(2, eq) : arg.slice(2));
    const rawValue =
      eq >= 0
        ? arg.slice(eq + 1)
        : index + 1 >= argv.length || argv[index + 1].startsWith("--")
          ? "true"
          : argv[++index];
    parsed[key] = rawValue;
  }
  return parsed;
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.scenes) {
    throw new Error("缺少 --scenes=public/generated/scenes-xxx.json");
  }
  const output = args.output || `public/generated/scenes-with-assets-${Date.now()}.json`;
  const result = attachAssetsFile({
    scenesPath: args.scenes,
    indexPath: args.index || "public/generated/asset-index.json",
    outputPath: output,
  });
  console.log(`SCENES_WITH_ASSETS ${path.resolve(projectRoot, output)}`);
  console.log(`SCENE_COUNT ${result.scenes.length}`);
}
