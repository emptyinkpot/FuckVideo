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
  "FootageScene",
  "NarratedScene",
];

const sceneTypeByCategory = {
  document: "document_evidence",
  quote: "quote_evidence",
  person: "character_focus",
  concept: "concept_explain",
  metaphor: "metaphor_visual",
  footage: "footage_context",
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
    .flatMap((sentence) => splitLongSentence(sentence, maxChars));
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
  const visualIntentData = buildVisualIntentData(sceneType, blockText, keywords);
  const semanticCard = buildSemanticCard(blockText, sceneType, keywords, visualIntentData);
  const visualContract = buildVisualContract(semanticCard);
  const visualGrounding = buildVisualGrounding(semanticCard);
  return {
    id: `scene-${String(index + 1).padStart(3, "0")}`,
    index,
    narrationText: blockText,
    text: blockText,
    sceneType,
    visualIntent,
    visualIntentData,
    semanticCard,
    visualContract,
    visualGrounding,
    keywords,
  };
}

export function chooseTemplate(beat, previousScene, manifest = loadTemplateManifest()) {
  const candidates = manifest
    .map((template) => scoreTemplateHandshake(beat, template, previousScene))
    .sort((a, b) => b.score - a.score);

  const accepted = candidates.filter((candidate) => candidate.accepted);
  const best = accepted[0];
  const rotated =
    previousScene && best?.template.id === previousScene.templateId && best.template.category === previousScene.category
      ? accepted.find((candidate) => candidate.template.id !== previousScene.templateId && candidate.score >= best.score - 2)
      : best;

  const selected =
    rotated ||
    best ||
    candidates.find((candidate) => candidate.template.id === "NarratedScene") ||
    { template: manifest.find((template) => template.id === "NarratedScene"), score: 0, accepted: true, reasons: ["兜底"] };
  const candidateTemplates = accepted.slice(0, 5).map((candidate) => ({
    id: candidate.template.id,
    score: Math.round(candidate.score),
    reason: candidate.reasons,
  }));
  const rejectedTemplates = candidates
    .filter((candidate) => !candidate.accepted)
    .slice(0, 6)
    .map((candidate) => ({
      id: candidate.template.id,
      reason: candidate.rejectReason,
    }));
  return {
    ...selected,
    trace: {
      rejectedTemplates,
      candidateTemplates,
      finalChoice: {
        type: "template",
        id: selected.template.id,
        score: Math.round(selected.score),
        reason: selected.reasons?.join("；") || `${selected.template.displayName}: ${selected.template.visualMetaphor}`,
      },
    },
  };
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

  if (templateId === "FootageScene") {
    return {
      ...common,
      title,
      subtitle: beat.visualIntent,
      src: "",
      showTitle: true,
      fit: "cover",
      darken: 0.28,
      zoom: 1.08,
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
      visualCandidates: selected.trace.candidateTemplates.map((candidate) => ({
        source: "template",
        templateId: candidate.id,
        score: candidate.score,
        reason: candidate.reason,
      })),
      decisionTrace: selected.trace,
      props: buildSceneProps(template.id, beat),
    };
    scene.decisionTrace.finalChoice.mappedProps = scene.props;
    cursor += durationInFrames;
    previousScene = scene;
    return scene;
  });
}

export function planScenesFromCaptions(captions, options = {}) {
  const fps = Number(options.fps || 30);
  const manifest = loadTemplateManifest();
  const sourceBlocks = splitIntoBlocks(options.sourceText || "", Number(options.maxChars || 130));
  const timedTexts = normalizeTimedTexts(captions, sourceBlocks);
  const microSegments = planMicroSegmentsFromTimedTexts(timedTexts, options);
  let previousScene = null;

  return microSegments.map((item, index) => {
    const beat = makeVisualBeat(item.text, index);
    const selected = chooseTemplate(beat, previousScene, manifest);
    const template = selected.template;
    const fromFrame = Math.max(0, Math.round((item.startMs / 1000) * fps));
    const durationInFrames = Math.max(1, Math.round(((item.endMs - item.startMs) / 1000) * fps));
    const durationSec = Math.round((durationInFrames / fps) * 100) / 100;
    const scene = {
      ...beat,
      captionIndex: item.captionIndex,
      templateId: template.id,
      category: template.category,
      durationSec,
      fromFrame,
      durationInFrames,
      audioStartMs: item.startMs,
      audioEndMs: item.endMs,
      parentCaptionId: item.parentCaptionId,
      parentCaptionIndex: item.parentCaptionIndex,
      estimatedTiming: Boolean(item.estimatedTiming),
      timingSource: "caption-segment",
      decisionReason: `${template.displayName}: ${template.visualMetaphor}`,
      visualCandidates: selected.trace.candidateTemplates.map((candidate) => ({
        source: "template",
        templateId: candidate.id,
        score: candidate.score,
        reason: candidate.reason,
      })),
      decisionTrace: selected.trace,
      props: buildSceneProps(template.id, beat),
    };
    scene.decisionTrace.finalChoice.mappedProps = scene.props;
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

function splitLongSentence(sentence, maxChars) {
  const value = String(sentence || "").trim();
  const limit = Number(maxChars || 0);
  if (!limit || value.length <= limit) {
    return value ? [value] : [];
  }
  const parts = value
    .split(/(?<=[，、,])\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length <= 1) {
    return [value];
  }
  const blocks = [];
  for (const part of parts) {
    const last = blocks[blocks.length - 1] || "";
    if (!last || `${last}${part}`.length > limit) {
      blocks.push(part);
    } else {
      blocks[blocks.length - 1] = `${last}${part}`;
    }
  }
  return blocks;
}

function normalizeTimedTexts(captions, sourceBlocks) {
  const list = Array.isArray(captions) ? captions : [];
  const sourceTexts = sourceBlocks.length ? sourceTextsForCaptionCount(sourceBlocks, list) : [];
  const clean = list
    .map((caption, index) => {
      const startMs = Math.max(0, Number(caption.startMs || 0));
      const endMs = Math.max(startMs, Number(caption.endMs || startMs));
      const captionText = String(caption.text || "").trim();
      const sourceText = sourceTexts[index] || "";
      return {
        captionIndex: Number(caption.index || index + 1),
        startMs,
        endMs,
        text: (sourceText || captionText).trim(),
      };
    })
    .filter((item) => item.text && item.endMs > item.startMs);
  return clean;
}

export function planMicroSegmentsFromCaptions(captions, options = {}) {
  const sourceBlocks = splitIntoBlocks(options.sourceText || "", Number(options.maxChars || 130));
  return planMicroSegmentsFromTimedTexts(normalizeTimedTexts(captions, sourceBlocks), options);
}

function planMicroSegmentsFromTimedTexts(timedTexts, options = {}) {
  const maxChars = Number(options.microMaxChars || 32);
  const targetChars = Number(options.microTargetChars || 24);
  const minChars = Number(options.microMinChars || 8);
  const result = [];

  for (const item of timedTexts) {
    let parts = splitSemanticMicroSegments(item.text, { maxChars, targetChars, minChars });
    if (item.endMs - item.startMs < parts.length * 250) {
      parts = [item.text];
    }
    if (parts.length <= 1) {
      result.push({
        ...item,
        parentCaptionId: `caption-${item.captionIndex}`,
        parentCaptionIndex: item.captionIndex,
        estimatedTiming: false,
      });
      continue;
    }

    const totalWeight = parts.reduce((sum, part) => sum + Math.max(1, cleanText(part).length), 0);
    let cursor = item.startMs;
    parts.forEach((part, partIndex) => {
      const isLast = partIndex === parts.length - 1;
      const weight = Math.max(1, cleanText(part).length);
      const endMs = isLast ? item.endMs : Math.min(item.endMs, Math.round(cursor + ((item.endMs - item.startMs) * weight) / totalWeight));
      result.push({
        captionIndex: Number(`${item.captionIndex}${String(partIndex + 1).padStart(2, "0")}`),
        parentCaptionId: `caption-${item.captionIndex}`,
        parentCaptionIndex: item.captionIndex,
        startMs: cursor,
        endMs: Math.max(endMs, cursor + 250),
        text: part,
        estimatedTiming: true,
      });
      cursor = Math.max(endMs, cursor + 250);
    });
  }

  return result.filter((item) => item.text && item.endMs > item.startMs);
}

function splitSemanticMicroSegments(text, options = {}) {
  const value = String(text || "").trim();
  if (!value) return [];
  const maxChars = Number(options.maxChars || 32);
  const targetChars = Number(options.targetChars || 24);
  const minChars = Number(options.minChars || 8);
  if (cleanText(value).length <= maxChars && !shouldForceSemanticSplit(value)) return [value];

  const rawParts = value
    .replace(/([；;。！？!?：:])/g, "$1|")
    .replace(/([，,、])/g, "$1|")
    .replace(/(但|然而|可是|不过|而|并且|以及|与|便是|所谓|这“[^”]+”)/g, "|$1")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

  if (rawParts.length <= 1) return [value];
  const merged = [];
  for (const part of rawParts) {
    const last = merged[merged.length - 1] || "";
    const nextLength = cleanText(`${last}${part}`).length;
    if (!last || cleanText(last).length >= minChars || nextLength > targetChars) {
      merged.push(part);
    } else {
      merged[merged.length - 1] = `${last}${part}`;
    }
  }

  const finalParts = [];
  for (const part of merged) {
    if (cleanText(part).length <= maxChars) {
      finalParts.push(part);
      continue;
    }
    finalParts.push(...splitLongSentence(part, maxChars));
  }
  return finalParts.map(trimSegmentText).filter(Boolean);
}

function shouldForceSemanticSplit(text) {
  const value = String(text || "");
  const entityHits = (value.match(/《[^》]+》|关东州|南满铁路|旅顺港|大连|俄国|日本|宇都宫太郎|租借地|铁路|利权/g) || []).length;
  return entityHits >= 3 || /但|然而|可是|不过|而是|所谓|便是|与/.test(value);
}

function sourceTextsForCaptionCount(sourceBlocks, captions) {
  const count = captions.length;
  if (!count) {
    return [];
  }
  if (sourceBlocks.length === count) {
    return sourceBlocks;
  }
  const sourceText = sourceBlocks.join("");
  const totalSourceLength = Math.max(1, cleanText(sourceText).length);
  const captionLengths = captions.map((caption) => Math.max(1, cleanText(caption.text).length));
  const totalCaptionLength = captionLengths.reduce((sum, length) => sum + length, 0);
  const cleanMap = cleanSourceMap(sourceText);
  const starts = [];
  let consumedCaptionChars = 0;

  for (let captionIndex = 0; captionIndex < count; captionIndex += 1) {
    const fallbackStart = Math.round((consumedCaptionChars / totalCaptionLength) * totalSourceLength);
    consumedCaptionChars += captionLengths[captionIndex];
    const minStart = starts[starts.length - 1] ?? 0;
    const anchored = findCaptionAnchor(cleanMap.clean, cleanText(captions[captionIndex]?.text), minStart);
    starts.push(Math.max(minStart, anchored >= 0 ? anchored : fallbackStart));
  }

  const slices = starts.map((startClean, index) => {
    const endClean = index === starts.length - 1 ? totalSourceLength : starts[index + 1];
    const start = cleanMap.indexes[Math.max(0, Math.min(startClean, cleanMap.indexes.length - 1))] ?? 0;
    const end = cleanMap.indexes[Math.max(0, Math.min(endClean, cleanMap.indexes.length - 1))] ?? sourceText.length;
    return trimSegmentText(sourceText.slice(start, Math.max(end, start + 1)));
  });
  return slices.map((slice, index) => slice || String(captions[index]?.text || "").trim());
}

function cleanSourceMap(text) {
  const chars = [];
  const indexes = [];
  for (let index = 0; index < text.length; index += 1) {
    const clean = cleanText(text[index]);
    if (clean) {
      chars.push(clean);
      indexes.push(index);
    }
  }
  indexes.push(text.length);
  return { clean: chars.join(""), indexes };
}

function findCaptionAnchor(cleanSource, cleanCaption, minStart) {
  const caption = String(cleanCaption || "");
  const searchStart = Math.max(0, minStart - 6);
  const maxOffset = Math.min(10, Math.max(0, caption.length - 2));
  for (let offset = 0; offset <= maxOffset; offset += 1) {
    for (let size = Math.min(10, caption.length - offset); size >= 2; size -= 1) {
      const needle = caption.slice(offset, offset + size);
      const found = cleanSource.indexOf(needle, searchStart);
      if (found >= minStart - 2) {
        return Math.max(0, found);
      }
    }
  }
  return -1;
}

function trimSegmentText(value) {
  return String(value || "")
    .replace(/^[\s，。！？、；：,.!?;:]+/, "")
    .replace(/[\s]+/g, " ")
    .trim();
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

function buildVisualIntentData(sceneType, text, keywords) {
  const value = String(text || "");
  const base = {
    type: sceneType,
    keywords,
    objects: keywords.slice(0, 4),
    action: "explain",
  };
  if (sceneType === "metaphor_visual") {
    return {
      ...base,
      action: /转让|放入|易手|衣袋/.test(value) ? "transfer" : "compare",
      from: /俄国/.test(value) ? "俄国" : "",
      to: /日本/.test(value) ? "日本" : "",
      objects: keywords.filter((keyword) => !["俄国", "日本"].includes(keyword)).slice(0, 3),
    };
  }
  if (sceneType === "geo_context" || sceneType === "establishing_map") {
    return {
      ...base,
      action: /铁路|路线|流向/.test(value) ? "route" : "locate",
      locations: keywords,
    };
  }
  if (sceneType === "document_evidence" || sceneType === "quote_evidence") {
    return {
      ...base,
      action: "show_evidence",
      evidenceType: sceneType === "quote_evidence" ? "quote" : "document",
      highlightWords: keywords.slice(0, 4),
    };
  }
  if (sceneType === "concept_explain") {
    return {
      ...base,
      action: "diagram",
      nodes: buildConceptNodes(value, keywords),
    };
  }
  return base;
}

export function buildSemanticCard(text, sceneType = inferSceneType(text), keywords = extractKeywords(text), visualIntentData = {}) {
  const value = String(text || "");
  const entities = extractEntities(value, keywords);
  const event = inferEvent(value, entities, visualIntentData);
  const visualNeed = inferVisualNeed(sceneType, value, entities, keywords);
  const searchQueries = buildSearchQueries(visualNeed, entities, keywords);
  return {
    summary: summarizeBody(value),
    entities,
    event,
    visualNeed,
    searchQueries,
  };
}

function buildVisualContract(semanticCard) {
  const visualNeed = semanticCard.visualNeed || {};
  const evidence = [
    ...(visualNeed.mustShow || []),
    ...(semanticCard.entities?.documents || []),
    ...(semanticCard.entities?.people || []),
    ...(semanticCard.entities?.locations || []),
  ].filter(Boolean);
  return {
    kind: visualNeed.kind || "fallback",
    mustShow: visualNeed.mustShow || [],
    shouldShow: visualNeed.shouldShow || [],
    mustNotShow: visualNeed.mustNotShow || [],
    evidenceMode: evidence.length ? "explicit_text" : "template_abstraction",
    allowedSources: ["template", "asset_match"],
    evidence,
  };
}

function buildVisualGrounding(semanticCard) {
  const visualNeed = semanticCard.visualNeed || {};
  const evidence = [...new Set([...(visualNeed.mustShow || []), ...(visualNeed.shouldShow || [])])].filter(Boolean);
  const source = evidence.length ? "explicit_text" : "template_abstraction";
  const hallucinationRisk =
    visualNeed.kind === "person" && !semanticCard.entities?.people?.length
      ? "high"
      : evidence.length
        ? "low"
        : "medium";
  return {
    source,
    evidence,
    hallucinationRisk,
  };
}

function extractEntities(text, keywords) {
  const value = String(text || "");
  const quotedDocuments = [...value.matchAll(/《([^》]{2,48})》/g)].map((match) => match[1]);
  const genericDocuments = value.match(/和约|条约|协定|策论|文件|法令|档案/g) || [];
  const documents = [
    ...quotedDocuments,
    ...genericDocuments,
    ...keywords.filter((keyword) => /和约|条约|协定|策论|文件|法令|档案/.test(keyword)),
  ];
  const people = [
    ...value.matchAll(/[\u4e00-\u9fa5]{2,5}(?:太郎|将军|大臣|首相|伯爵|侯爵|课长)/g),
  ].map((match) => match[0]);
  const locations = [
    ...keywords.filter((keyword) => /港|铁路|关东州|南满|旅顺|大连|黄海|霞关|满洲|东京|大陆/.test(keyword)),
    ...(value.match(/俄国/g) || []),
    ...(value.match(/日本/g) || []),
  ];
  const organizations = [
    ...(value.match(/参谋本部|日本|俄国|清国|满铁|外务省|陆军省/g) || []),
    ...keywords.filter((keyword) => /本部|省|政府|官厅/.test(keyword)),
  ];
  const objects = [
    ...keywords.filter((keyword) => /利权|权益|租借地|铁路附属地|怀表|衣袋|刃|牛|港口|铁路/.test(keyword)),
    ...(value.match(/转让|租借地|铁路权益|军政控制|势力范围/g) || []),
  ];
  const dates = [...value.matchAll(/明治[一二三四五六七八九十百零〇\d]+年|\d{4}\s*年?/g)].map((match) => match[0]);
  return {
    people: uniqueClean(people),
    locations: uniqueClean(locations),
    organizations: uniqueClean(organizations),
    documents: uniqueClean(documents),
    objects: uniqueClean(objects),
    dates: uniqueClean(dates),
  };
}

function inferEvent(text, entities, visualIntentData) {
  const value = String(text || "");
  const action =
    visualIntentData.action ||
    (/转让|易手|移交|放入|流向/.test(value)
      ? "transfer"
      : /占领|作战|战争/.test(value)
        ? "conflict"
        : /连接|路线|铁路/.test(value)
          ? "route"
          : /写道|引用|圈点/.test(value)
            ? "quote"
            : "explain");
  return {
    action,
    subject: entities.people[0] || entities.organizations[0] || "",
    object: entities.objects[0] || entities.documents[0] || entities.locations[0] || "",
    from: visualIntentData.from || (/俄国/.test(value) ? "俄国" : ""),
    to: visualIntentData.to || (/日本/.test(value) ? "日本" : ""),
  };
}

function inferVisualNeed(sceneType, text, entities, keywords) {
  const kindBySceneType = {
    document_evidence: "document",
    quote_evidence: "quote",
    character_focus: "person",
    concept_explain: "concept",
    metaphor_visual: "metaphor",
    geo_context: "map",
    establishing_map: "map",
    footage_context: "atmosphere",
    narration_bridge: "fallback",
  };
  const kind = kindBySceneType[sceneType] || "fallback";
  const entityByKind = {
    document: entities.documents,
    quote: [...entities.documents, ...keywords],
    person: entities.people,
    concept: entities.objects,
    metaphor: entities.objects,
    map: entities.locations,
    atmosphere: keywords,
    fallback: keywords,
  };
  const mustShow = uniqueClean(entityByKind[kind] || keywords).slice(0, 4);
  const shouldShow = uniqueClean([
    ...entities.documents,
    ...entities.people,
    ...entities.locations,
    ...entities.objects,
    ...keywords,
  ]).filter((item) => !mustShow.includes(item)).slice(0, 6);
  const mustNotShow = [];
  if (kind === "document" || kind === "quote") mustNotShow.push("战场爆炸", "现代城市", "现代办公室");
  if (kind === "map") mustNotShow.push("现代城市", "抽象光效", "无地名素材");
  if (kind === "person") mustNotShow.push("真实肖像照片", "现代人物照片");
  if (!/战争|战役|硝烟|炮火|作战/.test(text)) mustNotShow.push("战场爆炸", "炮火");
  return {
    kind,
    mustShow,
    shouldShow,
    mustNotShow: uniqueClean(mustNotShow),
  };
}

function buildSearchQueries(visualNeed, entities, keywords) {
  const entityQuery = [...entities.documents, ...entities.people, ...entities.locations].slice(0, 4).join(" ");
  const visualQuery = [visualNeed.kind, ...(visualNeed.mustShow || []), ...(visualNeed.shouldShow || [])].slice(0, 6).join(" ");
  const moodQuery = "历史 严肃 档案";
  return uniqueClean([entityQuery, visualQuery, moodQuery, keywords.slice(0, 5).join(" ")]).filter(Boolean);
}

function scoreTemplateHandshake(beat, template, previousScene) {
  const scoreBase = scoreTemplate(beat, template, previousScene);
  const card = beat.semanticCard || buildSemanticCard(beat.narrationText, beat.sceneType, beat.keywords || [], beat.visualIntentData || {});
  const kind = card.visualNeed?.kind || "fallback";
  const reasons = [];
  let score = scoreBase;
  const rejectReason = rejectTemplateForCard(template, card);
  if (rejectReason) {
    return { template, score: -1000 + scoreBase, accepted: false, reasons, rejectReason };
  }

  if (template.category === kind || (template.category === "map" && kind === "map")) {
    score += 40;
    reasons.push(`画面类型=${kind}`);
  }
  if (template.category === "document" && card.entities.documents.length) {
    score += 30;
    reasons.push(`文档实体=${card.entities.documents[0]}`);
  }
  if (template.category === "person" && card.entities.people.length) {
    score += 30;
    reasons.push(`人物实体=${card.entities.people[0]}`);
  }
  if (template.category === "map" && card.entities.locations.length) {
    score += 24;
    reasons.push(`地点=${card.entities.locations.slice(0, 2).join("、")}`);
  }
  if (template.category === "concept" && card.entities.objects.length) {
    score += 18;
    reasons.push(`对象=${card.entities.objects[0]}`);
  }
  if (template.category === "metaphor" && card.event?.action === "transfer") {
    score += 18;
    reasons.push("动作=transfer");
  }
  for (const must of card.visualNeed?.mustShow || []) {
    if (template.bestFor?.some((keyword) => keyword.includes(must) || must.includes(keyword))) {
      score += 6;
      reasons.push(`mustShow=${must}`);
    }
  }
  if (!reasons.length) {
    reasons.push(`${template.displayName}: ${template.visualMetaphor}`);
  }
  return { template, score, accepted: true, reasons, rejectReason: "" };
}

function rejectTemplateForCard(template, card) {
  const kind = card.visualNeed?.kind || "fallback";
  const accepts = template.accepts || {};
  const requiredEntities = accepts.requiredEntities || [];
  for (const entityGroup of requiredEntities) {
    if (Array.isArray(card.entities?.[entityGroup]) && card.entities[entityGroup].length === 0) {
      return `缺少必需实体：${entityGroup}`;
    }
  }
  if (accepts.visualKinds?.length && !accepts.visualKinds.includes(kind) && template.id !== "NarratedScene") {
    return `模板不接受画面类型：${kind}`;
  }
  if (template.id === "FootageScene") return "FootageScene 只能由素材检索阶段启用";
  if (template.category === "person" && !card.entities.people.length) return "缺少人物实体，禁止生造肖像";
  if (template.category === "document" && !["document", "quote"].includes(kind) && !card.entities.documents.length) {
    return "不是文件/引文需求";
  }
  if (template.category === "map" && !["map", "atmosphere"].includes(kind) && !card.entities.locations.length) {
    return "缺少地点或路线需求";
  }
  if (template.category === "quote" && !["quote", "metaphor"].includes(kind) && !card.entities.documents.length) {
    return "不是引文需求";
  }
  if (template.category === "metaphor" && kind !== "metaphor" && card.event?.action !== "transfer") {
    return "不是隐喻/转移动作";
  }
  return "";
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

function uniqueClean(values) {
  return [...new Set((values || []).map(cleanKeyword).filter(Boolean))];
}

function cleanText(value) {
  return String(value || "").replace(/[\s，。！？、；：,.!?;:"“”《》]/g, "");
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
