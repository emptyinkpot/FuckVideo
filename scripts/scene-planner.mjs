#!/usr/bin/env node
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const templateRules = [
  {
    id: "document",
    templateId: "DocumentReveal",
    test: (text) => /条约|和约|协定|策论|文件|合同|转让|租借地|利权|章程|宣言|法案/.test(text),
  },
  {
    id: "map",
    templateId: "AtlasMapFlyover",
    test: (text) => /港|铁路|路线|大陆|关东州|南满|旅顺|大连|黄海|东京|霞关|俄国|日本|满洲|地图/.test(text),
  },
  {
    id: "war",
    templateId: "HistoricalGlobeTexture1938",
    test: (text) => /战争|战役|硝烟|军|参谋|作战|焦土|铁锈|港口|占领/.test(text),
  },
  {
    id: "concept",
    templateId: "PromptTextRotation",
    test: (text) => /意味着|本质|犹如|仿佛|并非|不是|而是|关键|逻辑|开篇|筋骨/.test(text),
  },
];

export function splitIntoBlocks(text, maxChars = 130) {
  return String(text || "")
    .replace(/\r/g, "")
    .split(/(?<=[。！？!?；;])\s*/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .reduce((blocks, sentence) => {
      const last = blocks[blocks.length - 1];
      if (!last || last.length + sentence.length > maxChars) {
        blocks.push(sentence);
      } else {
        blocks[blocks.length - 1] = `${last}${sentence}`;
      }
      return blocks;
    }, []);
}

export function extractKeywords(text) {
  const value = String(text || "");
  const quoted = [...value.matchAll(/[《“"]([^》”"]{2,40})[》”"]/g)].map((match) => match[1]);
  const proper = [...value.matchAll(/[\u4e00-\u9fa5]{2,12}(?:港|铁路|和约|条约|租借地|官厅|课长|本部|策论|大陆|满洲)/g)].map(
    (match) => match[0],
  );
  const names = [...value.matchAll(/[\u4e00-\u9fa5]{2,8}(?:太郎|将军|大臣|首相|伯爵|侯爵)/g)].map(
    (match) => match[0],
  );
  return [...new Set([...quoted, ...proper, ...names])].slice(0, 8);
}

export function chooseTemplate(blockText) {
  return templateRules.find((rule) => rule.test(blockText))?.templateId || "NarratedScene";
}

export function buildSceneProps(templateId, blockText, index) {
  const keywords = extractKeywords(blockText);
  const title = keywords[0] || `第 ${index + 1} 镜`;

  if (templateId === "DocumentReveal") {
    const docTitle = keywords.find((keyword) => /和约|条约|协定|策论|文件/.test(keyword)) || title;
    return {
      title: docTitle,
      subtitle: "历史文件",
      body: summarizeDocumentContent(blockText),
      sealText: "ARCHIVE",
      highlightWords: keywords.slice(0, 4),
      tone: "aged",
    };
  }

  if (templateId === "AtlasMapFlyover") {
    return {
      title,
      subtitle: keywords.slice(1, 4).join(" · ") || "地理关系",
      textureSrc: "maps/natural-earth-world-4096.jpg",
      routeColor: "#f4d35e",
      overlayOpacity: 0.76,
    };
  }

  if (templateId === "HistoricalGlobeTexture1938") {
    return {
      title,
      subtitle: keywords.slice(1, 4).join(" · ") || "历史局势",
      startLongitude: -104,
      rotationDegreesPerFrame: 1.2,
      projectionScale: 292,
      projectionTranslateX: 0,
      projectionTranslateY: 12,
      showLabels: true,
    };
  }

  if (templateId === "PromptTextRotation") {
    return {
      words: keywords.length ? keywords.join(",") : "历史,利权,铁路,港口",
      backgroundColor: "#111111",
      textColor: "#f5f5f5",
      fontSize: 72,
    };
  }

  return {
    title,
    bodyText: blockText,
    keywords,
  };
}

export function planScenes(text, options = {}) {
  const fps = Number(options.fps || 30);
  const blocks = splitIntoBlocks(text, Number(options.maxChars || 130));
  let cursor = 0;

  return blocks.map((blockText, index) => {
    const templateId = chooseTemplate(blockText);
    const durationSeconds = Math.max(4, Math.min(9, Math.ceil(blockText.length / 28)));
    const durationInFrames = durationSeconds * fps;
    const scene = {
      id: `scene-${String(index + 1).padStart(3, "0")}`,
      index,
      text: blockText,
      templateId,
      keywords: extractKeywords(blockText),
      fromFrame: cursor,
      durationInFrames,
      props: buildSceneProps(templateId, blockText, index),
    };
    cursor += durationInFrames;
    return scene;
  });
}

export async function writeScenesFile({ text, outputPath, options = {} }) {
  const fps = Number(options.fps || 30);
  const scenes = planScenes(text, { ...options, fps });
  const payload = {
    fps,
    width: 1280,
    height: 720,
    totalFrames: scenes.reduce((sum, scene) => sum + scene.durationInFrames, 0),
    scenes,
  };
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, JSON.stringify(payload, null, 2), "utf8");
  return payload;
}

function summarizeDocumentContent(text) {
  const quoted = [...String(text).matchAll(/[“"]([^”"]{6,90})[”"]/g)].map((match) => match[1]);
  if (quoted.length > 0) {
    return quoted[0];
  }
  return String(text || "").replace(/[《》]/g, "").slice(0, 110);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    const eq = arg.indexOf("=");
    const key = toCamel(eq >= 0 ? arg.slice(2, eq) : arg.slice(2));
    const rawValue =
      eq >= 0
        ? arg.slice(eq + 1)
        : index + 1 >= argv.length || argv[index + 1].startsWith("--")
          ? "true"
          : argv[++index];
    parsed[key] = rawValue === "false" ? false : rawValue === "true" ? true : rawValue;
  }
  return parsed;
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
}

function isDirectRun() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isDirectRun()) {
  const args = parseArgs(process.argv.slice(2));
  const output = path.resolve(projectRoot, args.output || `public/generated/scenes-${Date.now()}.json`);
  const text = args.textFile
    ? await readFile(path.resolve(projectRoot, args.textFile), "utf8")
    : String(args.text || "");

  if (!text.trim()) {
    throw new Error("缺少文本。请传入 --text 或 --text-file。");
  }

  const payload = await writeScenesFile({
    text,
    outputPath: output,
    options: { fps: Number(args.fps || 30), maxChars: Number(args.maxChars || 130) },
  });
  console.log(`SCENES_FILE ${output}`);
  console.log(`SCENE_COUNT ${payload.scenes.length}`);
  console.log(`TOTAL_FRAMES ${payload.totalFrames}`);
}
