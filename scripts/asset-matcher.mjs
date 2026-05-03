import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

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
    if (!best) {
      return {
        ...scene,
        visualLayer: {
          type: "template",
          templateId: scene.templateId,
          confidence: 0,
          reason: "没有匹配到足够相关的素材，使用模板镜头",
        },
      };
    }

    used.add(best.asset.id);
    const useFootage = shouldPreferFootage(scene, best.score);
    return {
      ...scene,
      visualLayer: useFootage
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
          },
    };
  });
}

export function matchAssetsForScene(scene, assets, options = {}) {
  const minScore = Number(options.minScore ?? 8);
  const limit = Number(options.limit ?? 5);
  const query = sceneQuery(scene);
  return assets
    .map((asset) => ({
      asset,
      score: lexicalScore(query, asset, scene),
      reason: buildReason(query, asset, scene),
    }))
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
  let score = 0;

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
  return score;
}

function shouldPreferFootage(scene, score) {
  const text = `${scene.narrationText || scene.text || ""} ${scene.visualIntent || ""}`;
  if (score < 14) return false;
  if (["establishing_map", "geo_context", "war_context"].includes(scene.sceneType)) return true;
  return /战争|硝烟|焦土|港口|城市|铁路/.test(text);
}

function buildReason(query, asset, scene) {
  const hits = [];
  for (const tag of asset.tags || []) {
    if (query.includes(tag)) hits.push(tag);
  }
  if ((asset.bestFor || []).includes(scene.sceneType)) hits.push(scene.sceneType);
  return hits.length ? `命中：${hits.slice(0, 4).join("、")}` : "描述与镜头语义相近";
}

function sceneQuery(scene) {
  return [
    scene.narrationText,
    scene.text,
    scene.visualIntent,
    scene.sceneType,
    ...(scene.keywords || []),
    ...(scene.props?.keywords || []),
    scene.props?.title,
    scene.props?.body,
  ]
    .filter(Boolean)
    .join(" ");
}

function assetText(asset) {
  return [asset.title, asset.description, ...(asset.tags || []), ...(asset.bestFor || []), ...(asset.mood || [])]
    .filter(Boolean)
    .join(" ");
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
