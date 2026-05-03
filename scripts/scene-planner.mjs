#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const manifestPath = path.join(projectRoot, "src", "templates", "template-manifest.json");

const rhythm = [
  "HistoricalGlobeTexture1938",
  "PortraitFocus",
  "DocumentReveal",
  "QuoteReveal",
  "ConceptDiagram",
  "MapRouteFlyover",
  "MetaphorVisual",
  "NarratedScene",
];

const sceneTypeByCategory = {
  document: "document_evidence",
  quote: "quote_evidence",
  person: "character_focus",
  concept: "concept_explain",
  metaphor: "metaphor_visual",
  map: "geo_context",
  narration: "narration_bridge",
};

export function loadTemplateManifest() {
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

export function splitIntoBlocks(text, maxChars = 130) {
  return String(text || "")
    .replace(/\r/g, "")
    .split(/(?<=[。！？!?；;：:])\s*/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)
    .reduce((blocks, sentence) => {
      const last = blocks[blocks.length - 1];
      const typeChanged = last && inferSceneType(last) !== inferSceneType(sentence);
      if (!last || typeChanged || last.length + sentence.length > maxChars) {
        blocks.push(sentence);
      } else {
        blocks[blocks.length - 1] = `${last}${sentence}`;
      }
      return blocks;
    }, []);
}

export function extractKeywords(text) {
  const value = String(text || "");
  const quoted = [...value.matchAll(/[《“"]([^》”"]{2,48})[》”"]/g)].map((match) => match[1]);
  const proper = [
    ...value.matchAll(
      /[\u4e00-\u9fa5]{2,14}(?:港|铁路|和约|条约|租借地|官厅|课长|本部|策论|大陆|满洲|关东州|霞关|黄海|利权|怀表)/g,
    ),
  ].map((match) => match[0]);
  const names = [...value.matchAll(/[\u4e00-\u9fa5]{2,8}(?:太郎|将军|大臣|首相|伯爵|侯爵|课长)/g)].map(
    (match) => match[0],
  );
  const compactTerms = [
    ...value.matchAll(
      /(?:南满铁路|朴茨茅斯和约|关东州|旅顺港|大连|俄国|日本|东京霞关|宇都宫太郎|铁路附属地|港口|租借地|军政控制|利权)/g,
    ),
  ].map((match) => match[0]);
  return [...new Set([...quoted, ...compactTerms, ...names, ...proper])]
    .map(cleanKeyword)
    .filter(Boolean)
    .filter((keyword) => !/(的|进入|形成|成为|是)/.test(keyword) || quoted.includes(keyword))
    .slice(0, 8);
}

export function makeVisualBeat(blockText, index) {
  const keywords = extractKeywords(blockText);
  const sceneType = inferSceneType(blockText);
  const visualIntent = buildVisualIntent(sceneType, blockText, keywords);
  return {
    id: `scene-${String(index + 1).padStart(3, "0")}`,
    index,
    narrationText: blockText,
    text: blockText,
    sceneType,
    visualIntent,
    keywords,
  };
}

export function chooseTemplate(beat, previousScene, manifest = loadTemplateManifest()) {
  const candidates = manifest
    .map((template) => ({
      template,
      score: scoreTemplate(beat, template, previousScene),
    }))
    .sort((a, b) => b.score - a.score);

  const best = candidates[0];
  const rotated =
    previousScene && best?.template.id === previousScene.templateId && best.template.category === previousScene.category
      ? candidates.find((candidate) => candidate.template.id !== previousScene.templateId && candidate.score >= best.score - 2)
      : best;

  return rotated || best || { template: manifest.find((template) => template.id === "NarratedScene"), score: 0 };
}

export function buildSceneProps(templateId, beat) {
  const blockText = beat.narrationText;
  const keywords = beat.keywords || [];
  const title = keywords[0] || `第 ${beat.index + 1} 镜`;
  const common = {
    title,
    subtitle: beat.visualIntent,
    body: summarizeBody(blockText),
    keywords,
    highlightWords: keywords.slice(0, 4),
    visualFocus: beat.sceneType,
    tone: "historical",
  };

  if (templateId === "DocumentReveal") {
    return {
      ...common,
      title: keywords.find((keyword) => /和约|条约|协定|策论|文件/.test(keyword)) || title,
      subtitle: inferYear(blockText) || "历史文件",
      body: summarizeDocumentContent(blockText),
      sealText: "ARCHIVE",
    };
  }

  if (templateId === "QuoteReveal") {
    return {
      ...common,
      quote: extractQuote(blockText) || summarizeBody(blockText),
      source: keywords.find((keyword) => /策论|和约|条约|文件/.test(keyword)) || "原文摘录",
    };
  }

  if (templateId === "PortraitFocus") {
    return {
      ...common,
      name: extractPersonName(blockText, keywords) || title,
      roleTitle: extractRoleTitle(blockText) || "关键人物",
      description: summarizeBody(blockText),
      era: inferYear(blockText) || "历史现场",
    };
  }

  if (templateId === "ConceptDiagram") {
    return {
      ...common,
      concept: keywords.find((keyword) => /利权|租借地|铁路|势力|控制|转让/.test(keyword)) || title,
      definition: summarizeBody(blockText),
      nodes: buildConceptNodes(blockText, keywords),
      tone: "dark",
    };
  }

  if (templateId === "MetaphorVisual") {
    return {
      ...common,
      metaphor: extractMetaphorTitle(blockText),
      fromLabel: /俄国/.test(blockText) ? "俄国" : "来源",
      toLabel: /日本/.test(blockText) ? "日本" : "去向",
      objectLabel: keywords.find((keyword) => /铁路|关东州|利权|租借地/.test(keyword)) || "权益",
      tone: "historical",
    };
  }

  if (templateId === "AtlasMapFlyover") {
    return {
      ...common,
      subtitle: keywords.slice(1, 4).join(" · ") || "地理关系",
      textureSrc: "maps/natural-earth-world-4096.jpg",
      routeColor: "#f4d35e",
      overlayOpacity: 0.76,
    };
  }

  if (templateId === "MapRouteFlyover") {
    return {
      ...common,
      subtitle: keywords.slice(1, 4).join(" · ") || "路线关系",
      backgroundColor: "#09111f",
      routeColor: "#06b6d4",
      glowColor: "#0891b2",
      visualFocus: "route",
    };
  }

  if (templateId === "HistoricalGlobeTexture1938") {
    return {
      ...common,
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
      ...common,
      words: keywords.length ? keywords.join(",") : "历史,利权,铁路,港口",
      backgroundColor: "#111111",
      textColor: "#f5f5f5",
      fontSize: 72,
      tone: "dark",
    };
  }

  return {
    ...common,
    bodyText: blockText,
  };
}

export function planScenes(text, options = {}) {
  const fps = Number(options.fps || 30);
  const manifest = loadTemplateManifest();
  const blocks = splitIntoBlocks(text, Number(options.maxChars || 130));
  let cursor = 0;
  let previousScene = null;

  return blocks.map((blockText, index) => {
    const beat = makeVisualBeat(blockText, index);
    const selected = chooseTemplate(beat, previousScene, manifest);
    const template = selected.template;
    const [minDuration, maxDuration] = template.durationRangeSec || [4, 8];
    const durationSec = Math.max(minDuration, Math.min(maxDuration, Math.ceil(blockText.length / 28)));
    const durationInFrames = durationSec * fps;
    const scene = {
      ...beat,
      templateId: template.id,
      category: template.category,
      durationSec,
      fromFrame: cursor,
      durationInFrames,
      decisionReason: `${template.displayName}: ${template.visualMetaphor}`,
      props: buildSceneProps(template.id, beat),
    };
    cursor += durationInFrames;
    previousScene = scene;
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

function inferSceneType(text) {
  if (/“[^”]{4,}”|"[^"]{4,}"/.test(text) || /一行字|圈点|写道/.test(text)) return "quote_evidence";
  if (/太郎|课长|大臣|首相|将军|参谋本部/.test(text)) return "character_focus";
  if (/像|仿佛|犹如|好比|怀表|衣袋|新得之刃|庖丁解牛/.test(text)) return "metaphor_visual";
  if (/利权|铁路附属地|势力范围|控制|本质|意味着|关系|结构|机制/.test(text)) return "concept_explain";
  if (/条约|和约|协定|策论|文件|法令|转让|租借地/.test(text)) return "document_evidence";
  if (/港|铁路|路线|大陆|关东州|南满|旅顺|大连|黄海|东京|霞关|俄国|日本|满洲/.test(text)) return "geo_context";
  if (/战争|战役|硝烟|军|作战|焦土|铁锈|占领/.test(text)) return "establishing_map";
  return "narration_bridge";
}

function buildVisualIntent(sceneType, text, keywords) {
  const focus = keywords.slice(0, 3).join("、") || summarizeBody(text).slice(0, 24);
  const map = {
    character_focus: `介绍关键人物身份，并说明其在叙事中的作用：${focus}`,
    quote_evidence: `展示原文或关键引文，强调这句话如何推动解释：${focus}`,
    document_evidence: `用文件/条约视觉呈现证据，突出关键措辞：${focus}`,
    metaphor_visual: `把文本中的比喻转成可见的对象转移或关系变化：${focus}`,
    concept_explain: `把抽象概念拆成节点关系，帮助理解结构：${focus}`,
    geo_context: `用地图说明地点、路线或势力范围之间的关系：${focus}`,
    establishing_map: `建立历史地理背景，让观众知道事件发生的空间范围：${focus}`,
    narration_bridge: `承接旁白信息，作为下一组视觉解释的过渡：${focus}`,
  };
  return map[sceneType] || map.narration_bridge;
}

function scoreTemplate(beat, template, previousScene) {
  const text = beat.narrationText;
  const haystack = `${text} ${beat.visualIntent} ${(beat.keywords || []).join(" ")}`;
  let score = 0;

  for (const keyword of template.bestFor || []) {
    if (haystack.includes(keyword)) score += 3;
  }
  for (const keyword of template.avoidFor || []) {
    if (haystack.includes(keyword)) score -= 4;
  }
  if ((template.sceneRole || []).some((role) => beat.sceneType.includes(role))) score += 3;
  if (sceneTypeByCategory[template.category] === beat.sceneType) score += 4;
  if (template.id === rhythm[beat.index % rhythm.length]) score += 1.2;
  if (previousScene?.templateId === template.id) score -= 6;
  if (previousScene?.category === template.category && template.category !== "map") score -= 2;
  if (template.id === "NarratedScene") score -= 1;
  return score;
}

function summarizeDocumentContent(text) {
  const quoted = extractQuote(text);
  if (quoted) return quoted;
  return String(text || "").replace(/[《》]/g, "").slice(0, 110);
}

function summarizeBody(text) {
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, 120);
}

function extractQuote(text) {
  const match = String(text || "").match(/[“"]([^”"]{4,120})[”"]/);
  return match?.[1] || "";
}

function extractPersonName(text, keywords) {
  const name = String(text || "").match(/([\u4e00-\u9fa5]{2,4}太郎)(?:而言|认为|写道|指出)?/);
  return name?.[1] || keywords.find((keyword) => /太郎|将军|大臣|首相|课长/.test(keyword)) || "";
}

function extractRoleTitle(text) {
  const role = String(text || "").match(/是([\u4e00-\u9fa5]{2,16}(?:课长|大臣|首相|将军|负责人))/)
    || String(text || "").match(/(参谋本部[\u4e00-\u9fa5]{2,8}课长|[\u4e00-\u9fa5]{2,10}(?:课长|大臣|首相|将军|负责人))/);
  return role?.[1] || "";
}

function inferYear(text) {
  const match = String(text || "").match(/(明治[一二三四五六七八九十百零〇\d]+年|\d{4}\s*年?)/);
  return match?.[1] || "";
}

function buildConceptNodes(text, keywords) {
  const seeded = [];
  if (/铁路/.test(text)) seeded.push("铁路");
  if (/港/.test(text)) seeded.push("港口");
  if (/租借地/.test(text)) seeded.push("租借地");
  if (/军|参谋|作战/.test(text)) seeded.push("军政控制");
  if (/利权|权益/.test(text)) seeded.push("利权");
  return [...new Set([...seeded, ...keywords])].slice(0, 5);
}

function extractMetaphorTitle(text) {
  if (/怀表/.test(text)) return "怀表易手";
  if (/刃|刀/.test(text)) return "新得之刃";
  if (/庖丁解牛|牛/.test(text)) return "庖丁解牛";
  return "隐喻关系";
}

function cleanKeyword(value) {
  return String(value || "")
    .replace(/^[这那其之所谓与和及、，仿佛好像]+/, "")
    .replace(/[，。！？；：,.!?;:]$/g, "")
    .trim();
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
