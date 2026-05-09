import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { evaluateAssetQuality, qualityScoreBonus } from "./asset-quality.mjs";

export function loadAssetIndex(indexPath = "public/generated/asset-index.json") {
  const full = path.resolve(process.cwd(), indexPath);
  if (!existsSync(full)) {
    return [];
  }
  const payload = JSON.parse(readFileSync(full, "utf8"));
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload.assets)) {
    return payload.assets;
  }
  return [];
}

export function attachAssetsToScenes(scenes, assets, options = {}) {
  const list = Array.isArray(assets) ? assets : [];
  const used = new Set();
  return scenes.map((scene) => {
    const ranked = matchAssetsForScene(scene, list, options);
    const best = ranked.find((item) => !used.has(item.asset.id)) || ranked[0];
    const assetCandidates = ranked.map((item) => materialCandidateFromAsset(item));
    const decisionTrace = {
      ...(scene.decisionTrace || {}),
      candidateAssets: assetCandidates.map((item) => ({
        id: item.id,
        score: item.score,
        reason: item.reason,
      })),
    };
    if (!best) {
      return {
        ...scene,
        visualLayer: {
          type: "template",
          templateId: scene.templateId,
          confidence: 0,
          reason: "没有匹配到足够相关的素材，使用模板镜头",
        },
        visualCandidates: [...(scene.visualCandidates || []), ...assetCandidates],
        decisionTrace: {
          ...decisionTrace,
          finalChoice: scene.decisionTrace?.finalChoice || {
            type: "template",
            id: scene.templateId,
            reason: "没有匹配到足够相关的素材，使用模板镜头",
          },
        },
      };
    }

    used.add(best.asset.id);
    const useFootage = shouldPreferFootage(scene, best.score);
    const visualLayer = useFootage
      ? {
          type: "footage",
          clipId: best.asset.id,
          path: best.asset.path,
          title: best.asset.title,
          confidence: best.score,
          reason: best.reason,
          fallbackTemplateId: scene.templateId,
        }
      : {
          type: "template_with_footage_hint",
          templateId: scene.templateId,
          clipId: best.asset.id,
          path: best.asset.path,
          title: best.asset.title,
          confidence: best.score,
          reason: `主用模板，素材作备选：${best.reason}`,
        };
    return {
      ...scene,
      visualLayer,
      visualCandidates: [...(scene.visualCandidates || []), ...assetCandidates],
      decisionTrace: {
        ...decisionTrace,
        finalChoice: useFootage
          ? {
              type: "footage",
              id: best.asset.id,
              score: best.score,
              reason: best.reason,
            }
          : scene.decisionTrace?.finalChoice || {
              type: "template",
              id: scene.templateId,
              reason: "模板为主，素材作为备选提示",
            },
      },
    };
  });
}

export function matchAssetsForScene(scene, assets, options = {}) {
  const minScore = Number(options.minScore ?? 8);
  const limit = Number(options.limit ?? 5);
  const query = sceneQuery(scene);
  return assets
    .map((asset) => {
      const rejected = rejectAssetForScene(query, asset, scene);
      if (rejected) {
        return { asset, score: -1000, reason: rejected, rejected: true };
      }
      const score = lexicalScore(query, asset, scene);
      return {
        asset,
        score,
        reason: buildReason(query, asset, scene),
        rejected: false,
      };
    })
    .filter((item) => !item.rejected)
    .filter((item) => item.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export async function optionalEmbeddingRerank({ scene, candidates, embedText }) {
  if (!embedText || candidates.length <= 1) {
    return candidates;
  }
  const queryVector = await embedText(sceneQuery(scene));
  const reranked = [];
  for (const candidate of candidates) {
    const assetVector = await embedText(assetText(candidate.asset));
    const embeddingScore = cosine(queryVector, assetVector);
    reranked.push({ ...candidate, embeddingScore, score: candidate.score + embeddingScore * 20 });
  }
  return reranked.sort((a, b) => b.score - a.score);
}

function lexicalScore(query, asset, scene) {
  const assetBlob = assetText(asset);
  const tokens = tokenize(query);
  const card = scene.semanticCard || {};
  const entities = card.entities || {};
  const visualNeed = card.visualNeed || {};
  let score = 0;

  for (const group of [entities.documents, entities.people, entities.locations, entities.organizations, entities.objects]) {
    for (const entity of group || []) {
      if (!entity) continue;
      if (assetBlob.includes(entity)) score += 22;
      if ((asset.semantic?.entities || []).includes(entity)) score += 28;
    }
  }
  for (const must of visualNeed.mustShow || []) {
    if (assetBlob.includes(must)) score += 18;
  }
  for (const should of visualNeed.shouldShow || []) {
    if (assetBlob.includes(should)) score += 8;
  }
  if (visualNeed.kind && (asset.kind === visualNeed.kind || asset.semantic?.kind === visualNeed.kind)) score += 18;
  for (const object of asset.semantic?.visualObjects || []) {
    if ((visualNeed.mustShow || []).some((must) => object.includes(must) || must.includes(object))) score += 12;
  }
  for (const token of tokens) {
    if (assetBlob.includes(token)) score += token.length >= 3 ? 3 : 1;
  }
  for (const keyword of scene.keywords || []) {
    if ((asset.tags || []).some((tag) => tag.includes(keyword) || keyword.includes(tag))) score += 8;
    if (asset.description?.includes(keyword)) score += 5;
  }
  if ((asset.bestFor || []).includes(scene.sceneType)) score += 12;
  if ((asset.avoidFor || []).some((avoid) => query.includes(avoid) || avoid === scene.sceneType)) score -= 10;
  if (/条约|和约|文件|策论|转让/.test(query) && /条约|文件|档案|印章/.test(assetBlob)) score += 10;
  if (/战争|硝烟|战场|焦土|铁锈/.test(query) && /战争|硝烟|战场|炮火/.test(assetBlob)) score += 10;
  if (/铁路|地图|路线|港口|南满|关东州/.test(query) && /铁路|地图|路线|港口/.test(assetBlob)) score += 10;
  if (/人物|课长|大臣|将军|太郎|参谋/.test(query) && /人物|肖像|身份/.test(assetBlob)) score += 10;
  return score + qualityScoreBonus(asset);
}

function shouldPreferFootage(scene, score) {
  const text = `${scene.narrationText || scene.text || ""} ${scene.visualIntent || ""}`;
  if (score < 14) return false;
  if (["establishing_map", "geo_context", "war_context"].includes(scene.sceneType)) return true;
  return /战争|硝烟|焦土|港口|城市|铁路/.test(text);
}

function buildReason(query, asset, scene) {
  const hits = [];
  const card = scene.semanticCard || {};
  for (const entity of [
    ...(card.entities?.documents || []),
    ...(card.entities?.people || []),
    ...(card.entities?.locations || []),
    ...(card.entities?.objects || []),
  ]) {
    if (assetText(asset).includes(entity)) hits.push(`实体:${entity}`);
  }
  for (const must of card.visualNeed?.mustShow || []) {
    if (assetText(asset).includes(must)) hits.push(`必须:${must}`);
  }
  for (const tag of asset.tags || []) {
    if (query.includes(tag)) hits.push(tag);
  }
  if ((asset.bestFor || []).includes(scene.sceneType)) hits.push(scene.sceneType);
  return hits.length ? `命中：${hits.slice(0, 4).join("、")}` : "描述与镜头语义相近";
}

function sceneQuery(scene) {
  const card = scene.semanticCard || {};
  return [
    scene.narrationText,
    scene.text,
    scene.visualIntent,
    scene.sceneType,
    ...(scene.keywords || []),
    ...(scene.props?.keywords || []),
    scene.props?.title,
    scene.props?.body,
    card.summary,
    card.event?.action,
    ...(card.visualNeed?.mustShow || []),
    ...(card.visualNeed?.shouldShow || []),
    ...(card.searchQueries || []),
  ]
    .filter(Boolean)
    .join(" ");
}

function assetText(asset) {
  return [
    asset.title,
    asset.description,
    asset.kind,
    asset.era,
    ...(asset.tags || []),
    ...(asset.bestFor || []),
    ...(asset.mood || []),
    ...(asset.semantic?.entities || []),
    ...(asset.semantic?.visualObjects || []),
    ...(asset.semantic?.actions || []),
    ...(asset.semantic?.mood || []),
    ...(asset.semantic?.location || []),
  ]
    .filter(Boolean)
    .join(" ");
}

function rejectAssetForScene(query, asset, scene) {
  const blob = assetText(asset);
  const visualNeed = scene.semanticCard?.visualNeed || {};
  const qualityGate = asset.qualityGate || evaluateAssetQuality(asset);
  if (qualityGate.reject) return `素材质量门控：${qualityGate.reason}`;
  if (asset.copyright === "restricted" || asset.license === "restricted") return "版权受限";
  for (const forbidden of visualNeed.mustNotShow || []) {
    if (forbidden && blob.includes(forbidden)) return `命中禁止画面：${forbidden}`;
  }
  for (const avoid of asset.avoidFor || []) {
    if (avoid && (query.includes(avoid) || avoid === scene.sceneType)) return `素材 avoidFor 命中：${avoid}`;
  }
  const kind = asset.kind || asset.semantic?.kind || "";
  if (kind && visualNeed.kind && kind !== visualNeed.kind && !["atmosphere", "fallback"].includes(visualNeed.kind)) {
    const compatible = visualNeed.kind === "map" && ["footage", "atmosphere"].includes(kind);
    if (!compatible) return `素材类型 ${kind} 与需求 ${visualNeed.kind} 冲突`;
  }
  return "";
}

function materialCandidateFromAsset(item) {
  return {
    source: "footage",
    materialId: item.asset.id,
    id: item.asset.id,
    path: item.asset.path,
    title: item.asset.title,
    score: item.score,
    reason: item.reason,
    mappedProps: {
      src: item.asset.path,
      title: item.asset.title,
    },
  };
}

function tokenize(text) {
  const value = String(text || "");
  const quoted = [...value.matchAll(/[《“"]([^》”"]{2,40})[》”"]/g)].map((match) => match[1]);
  const words = value.replace(/[，。！？、；：,.!?;:\n\r]/g, " ").split(/\s+/).filter((word) => word.length >= 2);
  const grams = [];
  for (let index = 0; index < value.length - 1; index += 1) {
    const gram = value.slice(index, index + 2);
    if (/^[\u4e00-\u9fa5]{2}$/.test(gram)) grams.push(gram);
  }
  return [...new Set([...quoted, ...words, ...grams])];
}

function cosine(a, b) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    dot += a[index] * b[index];
    na += a[index] * a[index];
    nb += b[index] * b[index];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}
