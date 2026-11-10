#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const SHOWCASE_URL = "https://remotionlab.com/showcase";
const TERMS_URL = "https://remotionlab.com/terms";
const SOURCE_ROOT = path.join(projectRoot, "asset-source", "remotionlab");
const SHOWCASE_ROOT = path.join(SOURCE_ROOT, "showcase");
const SRC_SHOWCASE_ROOT = path.join(projectRoot, "src", "remotionlab-showcase");
const PUBLIC_FOOTAGE_ROOT = path.join(projectRoot, "public", "footage", "remotionlab", "showcase");
const GENERATED_ROOT = path.join(projectRoot, "public", "generated");
const ASSET_INDEX_PATH = path.join(GENERATED_ROOT, "asset-index.json");
const SRC_CATALOG_PATH = path.join(SRC_SHOWCASE_ROOT, "catalog.ts");

const args = new Set(process.argv.slice(2));
const skipMedia = args.has("--skip-media");
const skipCode = args.has("--skip-code");
const force = args.has("--force");
const copyRuntime = args.has("--copy-runtime");
const writeRuntimeAssetIndex = args.has("--write-runtime-index");
const concurrency = numberArg("--concurrency", 8);

async function main() {
  ensureDirs();

  const html = await fetchText(SHOWCASE_URL);
  writeFileSync(path.join(SOURCE_ROOT, "showcase-page.html"), html, "utf8");

  const items = extractShowcaseItems(html);
  if (items.length !== 263) {
    throw new Error(`Expected 263 RemotionLab showcase items, got ${items.length}`);
  }

  console.log(`REMOTIONLAB_ITEMS ${items.length}`);
  console.log(`CONCURRENCY ${concurrency}`);

  const results = await mapLimit(items, concurrency, async (item, index) => {
    const enriched = {
      ...item,
      index,
      sourceUrl: `${SHOWCASE_URL}/${item.slug}`,
      source: "remotionlab-showcase",
    };

    if (!skipCode) {
      Object.assign(enriched, await fetchSourceCode(enriched));
    }

    if (!skipMedia) {
      await downloadMedia(enriched);
    }

    enriched.local = localPathsFor(enriched);
    enriched.durationSec = ffprobeDuration(path.join(projectRoot, enriched.local.sourcePreviewPath || ""));
    enriched.rights = {
      license: "MIT-per-remotionlab-terms",
      termsUrl: TERMS_URL,
      note:
        "RemotionLab terms state code templates use MIT, while full code/template downloads require login and unauthorized bulk scraping/member-only redistribution is prohibited. This sync stores only publicly exposed showcase payloads.",
    };

    writeItemMetadata(enriched);
    console.log(`OK ${String(index + 1).padStart(3, "0")}/${items.length} ${item.slug}`);
    return enriched;
  });

  writeShowcaseIndex(results);
  writeFootageCandidates(results);
  if (writeRuntimeAssetIndex) {
    writeAssetIndex(results);
  }
  writeProviderCandidates(results);
  writeSrcCatalog(results);
  writeReadme(results);

  console.log(`SOURCE_ROOT ${relative(SOURCE_ROOT)}`);
  console.log(`PUBLIC_FOOTAGE_ROOT ${copyRuntime ? relative(PUBLIC_FOOTAGE_ROOT) : "not copied by default"}`);
  console.log(`ASSET_INDEX ${writeRuntimeAssetIndex ? relative(ASSET_INDEX_PATH) : "not written by default"}`);
}

function ensureDirs() {
  mkdirSync(SOURCE_ROOT, { recursive: true });
  mkdirSync(SHOWCASE_ROOT, { recursive: true });
  mkdirSync(SRC_SHOWCASE_ROOT, { recursive: true });
  mkdirSync(PUBLIC_FOOTAGE_ROOT, { recursive: true });
  mkdirSync(GENERATED_ROOT, { recursive: true });
}

function extractShowcaseItems(html) {
  const startNeedle = '\\"items\\":[{\\"title\\"';
  const start = html.indexOf(startNeedle);
  if (start === -1) {
    throw new Error("Could not locate RemotionLab items array in showcase HTML");
  }

  const arrayStart = start + '\\"items\\":'.length;
  const arrayEnd = html.indexOf(',\\"categories\\"', arrayStart);
  if (arrayEnd === -1) {
    throw new Error("Could not locate RemotionLab categories marker after items array");
  }

  const escapedArray = html.slice(arrayStart, arrayEnd);
  const jsonText = JSON.parse(`"${escapedArray}"`);
  const items = JSON.parse(jsonText);

  return dedupeBy(items, (item) => item.slug).map((item) => ({
    title: item.title,
    description: item.description,
    date: item.date,
    tags: Array.isArray(item.tags) ? item.tags : [],
    video: item.video,
    thumbnail: item.thumbnail,
    fileName: item.fileName,
    category: item.category,
    prompt: item.prompt,
    featured: Boolean(item.featured),
    slug: item.slug,
  }));
}

async function fetchSourceCode(item) {
  const rscUrl = `${SHOWCASE_URL}/${item.slug}/__next.showcase.$d$slug.__PAGE__.txt?_rsc=remotionlab-sync`;
  const text = await fetchText(rscUrl, {
    headers: {
      rsc: "1",
      "next-router-segment-prefetch": "/showcase/$d$slug/__PAGE__",
      "next-url": "/showcase",
    },
  });

  const records = parseFlightTextRecords(text);
  const gate = text.includes("登入後查看完整程式碼");
  const codeRefs =
    text.match(/"code":"\$([^"]+)","transparentCode":"\$([^"]+)","fileName":"([^"]+)","hasTransparent":(true|false)/) ||
    text.match(/\\"code\\":\\"\$([^\\"]+)\\",\\"transparentCode\\":\\"\$([^\\"]+)\\",\\"fileName\\":\\"([^\\"]+)\\",\\"hasTransparent\\":(true|false)/);

  if (!codeRefs) {
    const inlineCode = extractInlineCodePayload(text);
    if (inlineCode) {
      const itemDir = itemDirFor(item);
      mkdirSync(itemDir, { recursive: true });

      writeFileSync(path.join(itemDir, inlineCode.fileName || item.fileName), inlineCode.code, "utf8");

      if (inlineCode.hasTransparent && inlineCode.transparentCode && inlineCode.transparentCode !== inlineCode.code) {
        const parsed = path.parse(inlineCode.fileName || item.fileName);
        writeFileSync(
          path.join(itemDir, `${parsed.name}.transparent${parsed.ext || ".tsx"}`),
          inlineCode.transparentCode,
          "utf8",
        );
      }

      return {
        sourceStatus: gate ? "public_preview_code_login_gated_full_code" : "public_code",
        sourceCodeLength: inlineCode.code.length,
        transparentCodeLength: inlineCode.transparentCode.length,
        hasTransparent: inlineCode.hasTransparent,
        codeGate: gate,
        rscUrl,
        detailFileName: inlineCode.fileName,
      };
    }

    return {
      sourceStatus: gate ? "login_gated_code_not_extracted" : "code_not_extracted",
      sourceCodeLength: 0,
      hasTransparent: false,
      codeGate: gate,
      rscUrl,
    };
  }

  const [, codeId, transparentId, detailFileName, hasTransparentRaw] = codeRefs;
  const sourceCode = records.get(codeId) || "";
  const transparentCode = records.get(transparentId) || "";
  const hasTransparent = hasTransparentRaw === "true";

  const itemDir = itemDirFor(item);
  mkdirSync(itemDir, { recursive: true });

  if (sourceCode) {
    writeFileSync(path.join(itemDir, detailFileName || item.fileName), sourceCode, "utf8");
  }

  if (hasTransparent && transparentCode && transparentCode !== sourceCode) {
    const parsed = path.parse(detailFileName || item.fileName);
    writeFileSync(path.join(itemDir, `${parsed.name}.transparent${parsed.ext || ".tsx"}`), transparentCode, "utf8");
  }

  return {
    sourceStatus: gate ? "public_preview_code_login_gated_full_code" : "public_code",
    sourceCodeLength: sourceCode.length,
    transparentCodeLength: transparentCode.length,
    hasTransparent,
    codeGate: gate,
    rscUrl,
    detailFileName,
  };
}

function parseFlightTextRecords(text) {
  const buffer = Buffer.from(text, "utf8");
  const markers = [...text.matchAll(/(^|\n|})([0-9a-z]+):T([0-9a-f]+),/g)];
  const records = new Map();

  for (const marker of markers) {
    const fullMarker = marker[0].startsWith("}") ? marker[0].slice(1) : marker[0].replace(/^\n/, "");
    const markerCharIndex = marker.index + marker[0].length - fullMarker.length;
    const markerByteIndex = Buffer.byteLength(text.slice(0, markerCharIndex), "utf8");
    const start = markerByteIndex + Buffer.byteLength(fullMarker, "utf8");
    const len = Number.parseInt(marker[3], 16);
    const value = buffer.subarray(start, start + len).toString("utf8");
    records.set(marker[2], value);
  }

  return records;
}

function extractInlineCodePayload(text) {
  const match = text.match(
    /"code":"((?:\\.|[^"\\])*)","transparentCode":"((?:\\.|[^"\\])*)","fileName":"([^"]+)","hasTransparent":(true|false)/,
  );

  if (!match) return null;

  return {
    code: decodeJsonString(match[1]),
    transparentCode: decodeJsonString(match[2]),
    fileName: match[3],
    hasTransparent: match[4] === "true",
  };
}

function decodeJsonString(value) {
  return JSON.parse(`"${value}"`);
}

async function downloadMedia(item) {
  const itemDir = itemDirFor(item);
  mkdirSync(itemDir, { recursive: true });

  const previewSource = path.join(itemDir, "preview.mp4");
  const thumbName = `thumb${extensionFromUrl(item.thumbnail, ".jpg")}`;
  const thumbSource = path.join(itemDir, thumbName);
  const previewRuntime = path.join(PUBLIC_FOOTAGE_ROOT, item.slug, "preview.mp4");

  await downloadFile(item.video, previewSource);
  await downloadFile(item.thumbnail, thumbSource);

  if (copyRuntime) {
    mkdirSync(path.dirname(previewRuntime), { recursive: true });
    if (force || !existsSync(previewRuntime) || statSync(previewRuntime).size !== statSync(previewSource).size) {
      copyFileSync(previewSource, previewRuntime);
    }
  }
}

async function downloadFile(url, target) {
  if (!force && existsSync(target) && statSync(target).size > 0) return;

  mkdirSync(path.dirname(target), { recursive: true });
  const res = await fetchWithRetry(url);
  if (!res.ok) {
    throw new Error(`Download failed ${res.status} ${url}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  writeFileSync(target, Buffer.from(arrayBuffer));
}

async function fetchText(url, init = {}) {
  const res = await fetchWithRetry(url, init);
  if (!res.ok) {
    throw new Error(`Fetch failed ${res.status} ${url}`);
  }
  return res.text();
}

async function fetchWithRetry(url, init = {}, attempts = 3) {
  let lastError = null;
  for (let i = 1; i <= attempts; i += 1) {
    try {
      const res = await fetch(url, init);
      if (res.ok || i === attempts) return res;
      lastError = new Error(`HTTP ${res.status}`);
    } catch (error) {
      lastError = error;
    }
    await wait(350 * i);
  }
  throw lastError || new Error(`Fetch failed ${url}`);
}

function writeItemMetadata(item) {
  const metadata = {
    id: `remotionlab-${item.slug}`,
    slug: item.slug,
    title: item.title,
    description: item.description,
    category: item.category,
    tags: item.tags,
    date: item.date,
    featured: item.featured,
    fileName: item.detailFileName || item.fileName,
    prompt: item.prompt,
    sourceUrl: item.sourceUrl,
    media: {
      video: item.video,
      thumbnail: item.thumbnail,
    },
    local: item.local,
    sourceStatus: item.sourceStatus || "not_requested",
    hasTransparent: Boolean(item.hasTransparent),
    codeGate: Boolean(item.codeGate),
    sourceCodeLength: item.sourceCodeLength || 0,
    durationSec: item.durationSec || 0,
    rights: item.rights,
  };

  writeFileSync(path.join(itemDirFor(item), "metadata.json"), JSON.stringify(metadata, null, 2), "utf8");
  writeFileSync(path.join(itemDirFor(item), "prompt.txt"), item.prompt || "", "utf8");
}

function writeShowcaseIndex(items) {
  const categories = Object.fromEntries(
    Object.entries(groupBy(items, (item) => item.category)).map(([category, list]) => [category, list.length]),
  );

  const index = {
    source: "remotionlab-showcase",
    sourceUrl: SHOWCASE_URL,
    syncedAt: new Date().toISOString(),
    count: items.length,
    categories,
    items: items.map((item) => ({
      id: `remotionlab-${item.slug}`,
      slug: item.slug,
      title: item.title,
      category: item.category,
      tags: item.tags,
      fileName: item.detailFileName || item.fileName,
      sourceUrl: item.sourceUrl,
      local: item.local,
      sourceStatus: item.sourceStatus || "not_requested",
      codeGate: Boolean(item.codeGate),
      durationSec: item.durationSec || 0,
    })),
  };

  writeFileSync(path.join(SOURCE_ROOT, "showcase-index.json"), JSON.stringify(index, null, 2), "utf8");
}

function writeAssetIndex(items) {
  const index = items.map((item) => ({
    id: `remotionlab-${item.slug}`,
    type: "footage",
    providerType: "footage",
    path: item.local.runtimePreviewPath,
    title: item.title,
    description: item.description,
    tags: [...new Set(["RemotionLab", item.category, ...item.tags])],
    bestFor: inferBestFor(item),
    avoidFor: [],
    mood: inferMood(item),
    durationSec: item.durationSec || 0,
    license: "MIT-per-remotionlab-terms",
    source: "remotionlab-showcase",
    sourceUrl: item.sourceUrl,
    sourceStatus: item.sourceStatus || "not_requested",
    semantic: {
      visualKinds: inferVisualKinds(item),
      objects: [...new Set([item.category, ...item.tags])],
      actions: inferActions(item),
      entities: [],
      locations: [],
    },
    rights: item.rights,
  }));

  writeFileSync(ASSET_INDEX_PATH, JSON.stringify(index, null, 2), "utf8");
}

function writeFootageCandidates(items) {
  const index = items.map((item) => ({
    id: `remotionlab-${item.slug}`,
    type: "footage-reference",
    providerType: "footage",
    previewUrl: item.video,
    localPreviewPath: item.local.sourcePreviewPath,
    title: item.title,
    description: item.description,
    tags: [...new Set(["RemotionLab", item.category, ...item.tags])],
    bestFor: inferBestFor(item),
    avoidFor: [],
    mood: inferMood(item),
    durationSec: item.durationSec || 0,
    license: "MIT-per-remotionlab-terms",
    source: "remotionlab-showcase",
    sourceUrl: item.sourceUrl,
    sourceStatus: item.sourceStatus || "not_requested",
    semantic: {
      visualKinds: inferVisualKinds(item),
      objects: [...new Set([item.category, ...item.tags])],
      actions: inferActions(item),
      entities: [],
      locations: [],
    },
    rights: item.rights,
  }));

  writeFileSync(path.join(SOURCE_ROOT, "footage-candidates.json"), JSON.stringify(index, null, 2), "utf8");
}

function writeProviderCandidates(items) {
  const providers = items.map((item) => ({
    id: `RemotionLab:${item.slug}`,
    providerType: "programmatic",
    category: providerCategory(item),
    displayName: item.title,
    source: "remotionlab-showcase",
    sourceUrl: item.sourceUrl,
    sourceStatus: item.sourceStatus || "not_requested",
    fileName: item.detailFileName || item.fileName,
    localSourcePath: item.local.sourceCodePath,
    localPreviewPath: item.local.sourcePreviewPath,
    tags: item.tags,
    accepts: {
      visualKinds: inferVisualKinds(item),
      requiredAny: [],
      allowedActions: inferActions(item),
    },
    capabilities: inferCapabilities(item),
    duration: { minSec: 2, idealSec: Math.max(3, Math.round(item.durationSec || 3)), maxSec: 10 },
    notes:
      "Candidate only. Review component props and license before adding this provider to src/templates/visual-provider-manifest.json.",
  }));

  writeFileSync(path.join(SOURCE_ROOT, "visual-provider-candidates.json"), JSON.stringify(providers, null, 2), "utf8");
}

function writeSrcCatalog(items) {
  const assets = items.map((item) => ({
    id: `remotionlab-${item.slug}`,
    slug: item.slug,
    title: item.title,
    description: item.description,
    category: item.category,
    tags: item.tags,
    date: item.date,
    featured: item.featured,
    fileName: item.detailFileName || item.fileName,
    previewPath: item.local.runtimePreviewPath,
    previewUrl: item.video,
    thumbnailUrl: item.thumbnail,
    sourceCodePath: item.local.sourceCodePath,
    metadataPath: item.local.metadataPath,
    promptPath: item.local.promptPath,
    sourceUrl: item.sourceUrl,
    durationSec: item.durationSec || 0,
    license: "MIT-per-remotionlab-terms",
    sourceStatus: item.sourceStatus || "not_requested",
    visualKinds: inferVisualKinds(item),
    bestFor: inferBestFor(item),
    providerCandidateId: `RemotionLab:${item.slug}`,
  }));

  const categoryCounts = Object.fromEntries(
    Object.entries(groupBy(items, (item) => item.category)).map(([category, list]) => [category, list.length]),
  );

  const text = `import type { RemotionLabShowcaseAsset } from "./types";

// Generated by pipeline/sync-remotionlab-showcase.mjs.
// Do not edit this file by hand; rerun the sync script instead.

export const REMOTIONLAB_SHOWCASE_SOURCE_URL = ${JSON.stringify(SHOWCASE_URL)};
export const REMOTIONLAB_SHOWCASE_TERMS_URL = ${JSON.stringify(TERMS_URL)};

export const REMOTIONLAB_SHOWCASE_CATEGORY_COUNTS = ${JSON.stringify(categoryCounts, null, 2)} as const;

export const REMOTIONLAB_SHOWCASE_ASSETS = ${JSON.stringify(assets, null, 2)} as const satisfies readonly RemotionLabShowcaseAsset[];

export const REMOTIONLAB_SHOWCASE_ASSET_IDS = REMOTIONLAB_SHOWCASE_ASSETS.map((asset) => asset.id) as [
  RemotionLabShowcaseAssetId,
  ...RemotionLabShowcaseAssetId[],
];

export type RemotionLabShowcaseAssetId = (typeof REMOTIONLAB_SHOWCASE_ASSETS)[number]["id"];
export type RemotionLabShowcaseCategory = (typeof REMOTIONLAB_SHOWCASE_ASSETS)[number]["category"];

export const DEFAULT_REMOTIONLAB_SHOWCASE_ASSET_ID: RemotionLabShowcaseAssetId =
  REMOTIONLAB_SHOWCASE_ASSETS[0].id;

export const REMOTIONLAB_SHOWCASE_ASSET_BY_ID = Object.fromEntries(
  REMOTIONLAB_SHOWCASE_ASSETS.map((asset) => [asset.id, asset]),
) as unknown as Record<RemotionLabShowcaseAssetId, RemotionLabShowcaseAsset>;

export const getRemotionLabShowcaseAsset = (
  id?: string,
): RemotionLabShowcaseAsset =>
  REMOTIONLAB_SHOWCASE_ASSET_BY_ID[id as RemotionLabShowcaseAssetId] ||
  REMOTIONLAB_SHOWCASE_ASSET_BY_ID[DEFAULT_REMOTIONLAB_SHOWCASE_ASSET_ID];

export const getRemotionLabShowcaseAssetsByCategory = (
  category: RemotionLabShowcaseCategory,
): readonly RemotionLabShowcaseAsset[] =>
  REMOTIONLAB_SHOWCASE_ASSETS.filter((asset) => asset.category === category);
`;

  writeFileSync(SRC_CATALOG_PATH, text, "utf8");
}

function writeReadme(items) {
  const categories = Object.entries(groupBy(items, (item) => item.category))
    .map(([category, list]) => `- ${category}: ${list.length}`)
    .join("\n");

  const readme = `# RemotionLab Showcase Import

Source: ${SHOWCASE_URL}

Terms: ${TERMS_URL}

Synced at: ${new Date().toISOString()}

Imported count: ${items.length}

## Layout

\`\`\`text
asset-source/remotionlab/
  showcase-page.html
  showcase-index.json
  visual-provider-candidates.json
  showcase/<slug>/
    metadata.json
    prompt.txt
    <Component>.tsx
    <Component>.transparent.tsx
    preview.mp4
    thumb.jpg|png

src/remotionlab-showcase/catalog.ts
asset-source/remotionlab/footage-candidates.json
\`\`\`

## Categories

${categories}

## Source Status

RemotionLab terms state code templates use MIT, while full code/template downloads require login and unauthorized bulk scraping/member-only redistribution is prohibited. The sync stores code blocks that are publicly exposed in the showcase detail payload; treat them as source references until source completeness is verified.

## Repeat Sync

\`\`\`console
node pipeline/sync-remotionlab-showcase.mjs
node pipeline/sync-remotionlab-showcase.mjs --force
node pipeline/sync-remotionlab-showcase.mjs --skip-media
node pipeline/sync-remotionlab-showcase.mjs --copy-runtime --write-runtime-index
\`\`\`

By default, preview videos are not copied into \`public/\`, because Remotion Studio scans and copies \`public/\` during bundling. Use \`--copy-runtime --write-runtime-index\` only when these previews must participate as local FootageScene runtime assets.
`;

  writeFileSync(path.join(SOURCE_ROOT, "README.md"), readme, "utf8");
}

function localPathsFor(item) {
  const itemDir = itemDirFor(item);
  const sourceCodeName = item.detailFileName || item.fileName;
  const thumb = firstExistingThumb(itemDir);
  return {
    metadataPath: relative(path.join(itemDir, "metadata.json")),
    promptPath: relative(path.join(itemDir, "prompt.txt")),
    sourceCodePath: sourceCodeName ? relative(path.join(itemDir, sourceCodeName)) : "",
    sourcePreviewPath: relative(path.join(itemDir, "preview.mp4")),
    sourceThumbPath: thumb ? relative(thumb) : "",
    runtimePreviewPath: copyRuntime ? `footage/remotionlab/showcase/${item.slug}/preview.mp4` : "",
  };
}

function itemDirFor(item) {
  return path.join(SHOWCASE_ROOT, item.slug);
}

function firstExistingThumb(dir) {
  for (const ext of [".jpg", ".jpeg", ".png", ".webp"]) {
    const file = path.join(dir, `thumb${ext}`);
    if (existsSync(file)) return file;
  }
  return "";
}

function inferBestFor(item) {
  const values = [item.category, ...item.tags].join(" ");
  const bestFor = [];
  if (/轉場|transition|擦除|淡化|滑動|揭露|wipe/i.test(values)) bestFor.push("transition", "scene_change");
  if (/資料|圖表|chart|data|統計|視覺化/i.test(values)) bestFor.push("data_visualization", "concept_explain");
  if (/字幕|CC|字卡|文字|title|text/i.test(values)) bestFor.push("title_card", "subtitle", "quote_evidence");
  if (/地圖|軌跡|map|route/i.test(values)) bestFor.push("geo_context", "route_explain");
  if (/Logo|品牌/i.test(values)) bestFor.push("brand_intro", "logo_reveal");
  if (/音頻|wave|audio/i.test(values)) bestFor.push("audio_visualization");
  if (/倒數|count/i.test(values)) bestFor.push("countdown");
  if (!bestFor.length) bestFor.push("programmatic_motion", "atmosphere");
  return [...new Set(bestFor)];
}

function inferMood(item) {
  const values = [item.category, ...item.tags].join(" ");
  const mood = ["motion"];
  if (/簡約|商務|minimal|business/i.test(values)) mood.push("clean", "business");
  if (/華麗|霓虹|glow|neon/i.test(values)) mood.push("high_energy");
  if (/社群|short|social/i.test(values)) mood.push("social");
  if (/電影|漏光|film/i.test(values)) mood.push("cinematic");
  return [...new Set(mood)];
}

function inferVisualKinds(item) {
  const values = [item.category, ...item.tags, item.slug].join(" ");
  if (/地圖|軌跡|map|route/i.test(values)) return ["map", "geo"];
  if (/資料|圖表|chart|data|統計/i.test(values)) return ["concept", "data"];
  if (/字幕|CC|字卡|文字|title|text/i.test(values)) return ["quote", "concept"];
  if (/轉場|transition/i.test(values)) return ["transition"];
  if (/Logo|品牌/i.test(values)) return ["logo", "brand"];
  if (/音頻|audio|wave/i.test(values)) return ["audio"];
  if (/倒數|count/i.test(values)) return ["countdown"];
  return ["concept", "motion"];
}

function inferActions(item) {
  const values = [item.category, ...item.tags, item.slug].join(" ");
  const actions = ["show_motion"];
  if (/轉場|transition|wipe|reveal|push|fade/i.test(values)) actions.push("transition", "reveal");
  if (/地圖|route|map/i.test(values)) actions.push("locate", "route");
  if (/資料|chart|data/i.test(values)) actions.push("explain", "diagram");
  if (/文字|字幕|title|text/i.test(values)) actions.push("quote", "show_evidence");
  if (/Logo|brand/i.test(values)) actions.push("brand");
  return [...new Set(actions)];
}

function inferCapabilities(item) {
  const kinds = inferVisualKinds(item);
  return {
    canRenderText: /字|字幕|文字|title|Logo|資料|圖表|倒數/.test([item.category, ...item.tags].join(" ")),
    canHighlightWords: kinds.includes("quote"),
    canShowMovement: true,
    canShowRelationship: kinds.includes("concept") || kinds.includes("data"),
    canShowMap: kinds.includes("map") || kinds.includes("geo"),
    canLoop: true,
  };
}

function providerCategory(item) {
  const map = {
    "轉場": "transition",
    "片頭/片尾": "intro_outro",
    "資料視覺化": "data_visualization",
    "社群媒體": "social_media",
    "Logo 動畫": "logo",
    "土撥鼠影片": "groundhog_video",
    "音頻視覺化": "audio_visualization",
    "字卡": "title_card",
    "倒數計時器": "countdown",
    "地圖/軌跡": "map_route",
    "字幕/CC": "subtitle",
    "文字特效": "text_effect",
  };
  return map[item.category] || "programmatic_motion";
}

function extensionFromUrl(url, fallback) {
  try {
    const ext = path.extname(new URL(url).pathname);
    return ext || fallback;
  } catch {
    return fallback;
  }
}

function ffprobeDuration(file) {
  if (!file || !existsSync(file)) return 0;
  const res = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", file],
    { encoding: "utf8" },
  );
  const duration = Number(String(res.stdout || "").trim());
  return Number.isFinite(duration) ? Math.round(duration * 100) / 100 : 0;
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, limit) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function dedupeBy(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function groupBy(items, keyFn) {
  return items.reduce((acc, item) => {
    const key = keyFn(item) || "unknown";
    acc[key] ||= [];
    acc[key].push(item);
    return acc;
  }, {});
}

function numberArg(name, fallback) {
  const prefix = `${name}=`;
  const raw = process.argv.find((arg) => arg.startsWith(prefix));
  if (!raw) return fallback;
  const value = Number(raw.slice(prefix.length));
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
}

function relative(file) {
  return path.relative(projectRoot, file).replace(/\\/g, "/");
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
