#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const footageDir = path.join(projectRoot, "public", "footage");
const outIndex = path.join(projectRoot, "public", "generated", "asset-index.json");

export function buildAssetIndex() {
  mkdirSync(path.dirname(outIndex), { recursive: true });
  const files = walk(footageDir).filter((file) => /\.(mp4|mov|webm|mkv)$/i.test(file));
  const index = files.map((file, index) => {
    const rel = path.relative(path.join(projectRoot, "public"), file).replace(/\\/g, "/");
    const base = path.basename(file, path.extname(file));
    const tags = inferTagsFromName(base);
    return {
      id: base || `clip-${index + 1}`,
      type: "footage",
      path: rel,
      title: base.replace(/[-_]+/g, " "),
      description: tags.length ? `${tags.join("、")}相关素材` : "未标注素材，请补充 description、tags、bestFor",
      tags,
      bestFor: inferBestFor(tags),
      avoidFor: [],
      mood: inferMood(tags),
      durationSec: ffprobeDuration(file),
      license: "local",
      source: "local-library",
    };
  });

  writeFileSync(outIndex, JSON.stringify(index, null, 2), "utf8");
  console.log(`ASSET_INDEX ${outIndex}`);
  console.log(`ASSET_COUNT ${index.length}`);
  return index;
}

function walk(dir) {
  if (!existsSync(dir)) {
    return [];
  }
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function ffprobeDuration(file) {
  const res = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file],
    { encoding: "utf8" },
  );
  const duration = Number(String(res.stdout || "").trim());
  return Number.isFinite(duration) ? Math.round(duration * 100) / 100 : 0;
}

function inferTagsFromName(name) {
  const value = String(name || "").toLowerCase();
  const tags = [];
  if (/war|battle|smoke|fire|炮|战|硝烟|焦土/.test(value)) tags.push("战争", "硝烟", "焦土", "战场");
  if (/paper|doc|treaty|seal|archive|条约|文件|档案|印章/.test(value)) tags.push("条约", "文件", "档案", "印章");
  if (/map|rail|route|地图|铁路|路线|港口/.test(value)) tags.push("地图", "铁路", "路线", "港口");
  if (/person|portrait|人物|肖像|官员|将领/.test(value)) tags.push("人物", "身份介绍");
  return [...new Set(tags)];
}

function inferBestFor(tags) {
  const bestFor = [];
  if (tags.some((tag) => ["战争", "硝烟", "焦土"].includes(tag))) bestFor.push("establishing_map", "war_context");
  if (tags.some((tag) => ["条约", "文件", "档案"].includes(tag))) bestFor.push("document_evidence", "quote_evidence");
  if (tags.some((tag) => ["地图", "铁路", "路线", "港口"].includes(tag))) bestFor.push("geo_context", "concept_explain");
  if (tags.some((tag) => ["人物", "身份介绍"].includes(tag))) bestFor.push("character_focus");
  return bestFor;
}

function inferMood(tags) {
  const mood = [];
  if (tags.some((tag) => ["战争", "硝烟", "焦土"].includes(tag))) mood.push("dark", "tense", "historical");
  if (tags.some((tag) => ["条约", "文件", "档案"].includes(tag))) mood.push("historical", "serious");
  if (tags.some((tag) => ["地图", "铁路", "路线"].includes(tag))) mood.push("analytical", "historical");
  return [...new Set(mood)];
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  buildAssetIndex();
}
