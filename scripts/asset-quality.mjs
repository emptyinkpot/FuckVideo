const TEXT_ONLY_PATTERNS = /白布|字幕卡|文字卡|写字|手写|标题卡|whiteboard|text[-_\s]?only|title[-_\s]?card|caption[-_\s]?card|typography/i;
const BLANK_PATTERNS = /空白|白底|纯色|blank|plain[-_\s]?background|solid[-_\s]?color/i;
const HISTORICAL_PATTERNS = /历史|战争|铁路|地图|港口|条约|文件|档案|人物|军队|硝烟|战场|historical|war|battle|rail|map|archive|treaty|port/i;

export function evaluateAssetQuality(asset = {}) {
  const blob = assetBlob(asset);
  const semantic = asset.semantic || {};
  const provided = asset.quality || semantic.quality || {};
  const visualObjects = arr(semantic.visualObjects || semantic.objects);
  const entities = arr(semantic.entities);
  const actions = arr(semantic.actions);
  const tags = arr(asset.tags);

  const textAreaRatio = clamp01(number(provided.textAreaRatio, TEXT_ONLY_PATTERNS.test(blob) ? 0.6 : 0));
  const objectRichness = clamp100(
    number(
      provided.objectRichness,
      Math.min(100, visualObjects.length * 18 + entities.length * 10 + tags.length * 6),
    ),
  );
  const motionScore = clamp100(
    number(
      provided.motionScore,
      number(asset.durationSec, 0) >= 2 || actions.length ? 35 + Math.min(35, actions.length * 12) : 12,
    ),
  );
  const sceneDiversity = clamp100(number(provided.sceneDiversity, Math.min(100, tags.length * 8 + visualObjects.length * 10)));
  const historicalRelevance = clamp100(number(provided.historicalRelevance, HISTORICAL_PATTERNS.test(blob) ? 45 : 0));
  const textOnlyPenalty = clamp100(number(provided.textOnlyPenalty, TEXT_ONLY_PATTERNS.test(blob) ? 55 : Math.round(textAreaRatio * 70)));
  const blankBackgroundPenalty = clamp100(number(provided.blankBackgroundPenalty, BLANK_PATTERNS.test(blob) ? 45 : 0));
  const visualValueScore = Math.round(
    objectRichness * 0.35 +
      motionScore * 0.25 +
      sceneDiversity * 0.2 +
      historicalRelevance * 0.2 -
      textOnlyPenalty * 0.55 -
      blankBackgroundPenalty * 0.45,
  );

  const reject =
    (textAreaRatio > 0.35 && objectRichness < 25 && motionScore < 25) ||
    (textOnlyPenalty >= 45 && objectRichness < 25) ||
    (blankBackgroundPenalty >= 40 && objectRichness < 20);
  const reason = reject
    ? textOnlyPenalty >= blankBackgroundPenalty
      ? "text_only_card"
      : "blank_background"
    : visualValueScore < 8
      ? "low_visual_value"
      : "";

  return {
    reject,
    reason,
    metrics: {
      textAreaRatio,
      objectRichness,
      motionScore,
      sceneDiversity,
      historicalRelevance,
      textOnlyPenalty,
      blankBackgroundPenalty,
      visualValueScore,
    },
  };
}

export function qualityScoreBonus(asset = {}) {
  const gate = asset.qualityGate || evaluateAssetQuality(asset);
  const score = Number(gate.metrics?.visualValueScore ?? 0);
  if (score >= 55) return 12;
  if (score >= 35) return 7;
  if (score >= 18) return 3;
  if (score < 0) return -10;
  return 0;
}

function assetBlob(asset) {
  return [
    asset.id,
    asset.title,
    asset.description,
    asset.kind,
    ...arr(asset.tags),
    ...arr(asset.bestFor),
    ...arr(asset.avoidFor),
    ...arr(asset.mood),
    ...arr(asset.semantic?.entities),
    ...arr(asset.semantic?.objects),
    ...arr(asset.semantic?.visualObjects),
    ...arr(asset.semantic?.actions),
    ...arr(asset.semantic?.locations),
    ...arr(asset.semantic?.location),
    ...arr(asset.semantic?.visualKinds),
  ]
    .filter(Boolean)
    .join(" ");
}

function arr(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function number(value, fallback) {
  const current = Number(value);
  return Number.isFinite(current) ? current : fallback;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

function clamp100(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}
