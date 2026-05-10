#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildAssetIndex } from "./asset-indexer.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const defaultAssetIndexPath = path.join(projectRoot, "public", "generated", "asset-index.json");
const defaultSeedPath = path.join(projectRoot, "public", "generated", "material-seed.jsonl");
const defaultSummaryPath = path.join(projectRoot, "public", "generated", "material-seed-summary.json");

export function buildMaterialSeed(options = {}) {
  const assetIndexPath = path.resolve(projectRoot, options.assetIndexPath || defaultAssetIndexPath);
  const seedPath = path.resolve(projectRoot, options.seedPath || defaultSeedPath);
  const summaryPath = path.resolve(projectRoot, options.summaryPath || defaultSummaryPath);
  const assets = loadOrBuildAssetIndex(assetIndexPath, Boolean(options.rebuild));
  const rows = assets.flatMap((asset) => rowsFromAsset(asset));
  const generatedAt = new Date().toISOString();
  const summary = {
    schemaVersion: 1,
    generatedAt,
    sourceIndex: path.relative(projectRoot, assetIndexPath).replace(/\\/g, "/"),
    seedPath: path.relative(projectRoot, seedPath).replace(/\\/g, "/"),
    rowCount: rows.length,
    assetCount: assets.length,
    countsByAssetType: countBy(rows, "assetType"),
    countsBySource: countBy(rows, "source"),
  };

  mkdirSync(path.dirname(seedPath), { recursive: true });
  writeFileSync(seedPath, `${rows.map((row) => JSON.stringify(row)).join("\n")}${rows.length ? "\n" : ""}`, "utf8");
  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");

  console.log(`MATERIAL_SEED ${seedPath}`);
  console.log(`MATERIAL_SEED_ROWS ${rows.length}`);
  return { rows, summary };
}

function loadOrBuildAssetIndex(assetIndexPath, rebuild) {
  if (rebuild || !existsSync(assetIndexPath)) {
    buildAssetIndex();
  }
  const payload = JSON.parse(readFileSync(assetIndexPath, "utf8"));
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.assets)) return payload.assets;
  return [];
}

function rowsFromAsset(asset) {
  const shots = Array.isArray(asset.shots) && asset.shots.length
    ? asset.shots
    : [{ id: `${asset.id}:asset`, startMs: 0, endMs: Math.round(Number(asset.durationSec || 0) * 1000) }];

  return shots.map((shot) => {
    const shotId = String(shot.id || `${asset.id}:shot`);
    return {
      id: shotId,
      assetId: String(asset.id || ""),
      shotId,
      source: "asset-index",
      assetType: String(asset.providerType || asset.type || "unknown"),
      path: String(asset.path || ""),
      title: String(asset.title || asset.id || ""),
      startMs: Number(shot.startMs || 0),
      endMs: Number(shot.endMs || Math.round(Number(asset.durationSec || 0) * 1000)),
      indexText: buildIndexText(asset, shot),
      metadata: buildMetadata(asset, shot),
    };
  }).filter((row) => row.assetId && row.path && row.indexText);
}

function buildIndexText(asset, shot) {
  return compact([
    asset.title,
    asset.description,
    asset.kind,
    ...(asset.tags || []),
    ...(asset.bestFor || []),
    ...(asset.mood || []),
    ...(asset.semantic?.visualKinds || []),
    ...(asset.semantic?.entities || []),
    ...(asset.semantic?.visualObjects || []),
    ...(asset.semantic?.actions || []),
    ...(asset.semantic?.location || []),
    ...(asset.semantic?.captions || []),
    asset.semantic?.ocrText,
    asset.semantic?.asrText,
    ...(shot.captions || []),
  ]).join(" | ");
}

function buildMetadata(asset, shot) {
  return {
    kind: asset.kind || asset.semantic?.kind || "",
    tags: asset.tags || [],
    bestFor: asset.bestFor || [],
    avoidFor: asset.avoidFor || [],
    mustNotShow: asset.semantic?.mustNotShow || asset.mustNotShow || [],
    mood: asset.mood || [],
    license: asset.license || "",
    source: asset.source || "",
    durationSec: Number(asset.durationSec || 0),
    startMs: Number(shot.startMs || 0),
    endMs: Number(shot.endMs || 0),
    qualityGate: asset.qualityGate || {},
    retrieval: asset.retrieval || {},
  };
}

function compact(values) {
  return values.map((value) => String(value || "").trim()).filter(Boolean);
}

function countBy(rows, key) {
  return rows.reduce((counts, row) => {
    const value = String(row[key] || "unknown");
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--rebuild") options.rebuild = true;
    if (arg === "--asset-index") {
      options.assetIndexPath = argv[index + 1];
      index += 1;
    }
    if (arg === "--out") {
      options.seedPath = argv[index + 1];
      index += 1;
    }
    if (arg === "--summary") {
      options.summaryPath = argv[index + 1];
      index += 1;
    }
  }
  return options;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildMaterialSeed(parseArgs(process.argv.slice(2)));
}
