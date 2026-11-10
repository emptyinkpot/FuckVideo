#!/usr/bin/env node
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadAssetIndex } from "./asset-matcher.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(__dirname, "..");
const evidenceCacheRoot = path.join(projectRoot, "public", "evidence-cache");

export const EVIDENCE_HARD_RULES = {
  noFakeDocument: true,
  noFakePortrait: true,
  noFakeHistoricalPhoto: true,
  evidenceFirst: true,
  fallbackMustBeMarked: true,
};

const EVIDENCE_KINDS = new Set(["document", "person", "place", "event", "map", "newspaper"]);

const GENERIC_DOCUMENT_TERMS = new Set(["条约", "和约", "协定", "策论", "文件", "档案", "电文", "电报", "报告", "公告"]);

const ENTITY_QUERY_ALIASES = new Map([
  ["朴茨茅斯和约", "Treaty of Portsmouth original document scan"],
  ["日俄战后经营策论", "日俄战后经营策论 原文 史料"],
  ["南满铁路", "South Manchuria Railway historical map"],
  ["满铁", "South Manchuria Railway Company historical photograph"],
  ["旅顺港", "Port Arthur Lushun historical map"],
  ["关东州", "Kwantung Leased Territory historical map"],
  ["东京霞关", "Kasumigaseki Tokyo historical photograph"],
  ["宇都宫太郎", "Taro Utsunomiya Japanese general portrait"],
]);

export function extractEvidenceNeedsForProject(project) {
  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
  return scenes.flatMap((scene) => extractEvidenceNeedsForScene(scene));
}

export function extractEvidenceNeedsForScene(scene) {
  const card = scene.semanticCard || {};
  const entities = card.entities || {};
  const visualKind = scene.visualContract?.kind || card.visualNeed?.kind || "";
  const needs = [];

  const pushNeed = (kind, entitiesForNeed, query, mustFind = true) => {
    const cleanEntities = uniqueClean(entitiesForNeed);
    const cleanQuery = String(query || cleanEntities.join(" ")).trim();
    if (!EVIDENCE_KINDS.has(kind) || !cleanQuery) return;
    const mustNotShow = cleanEvidenceMustNotShow(
      kind,
      uniqueClean([...(scene.visualContract?.mustNotShow || []), ...(card.visualNeed?.mustNotShow || [])]),
    );
    needs.push({
      id: `${scene.id || "segment"}-${kind}-${needs.length + 1}`,
      segmentId: scene.id,
      kind,
      query: cleanQuery,
      mustFind,
      entities: cleanEntities,
      mustNotShow,
      reason: evidenceReason(kind, scene, cleanEntities),
    });
  };

  if (entities.documents?.length || ["document", "quote", "telegram"].includes(visualKind)) {
    const docs = cleanDocumentEntities([...(entities.documents || []), ...(scene.keywords || []).filter((item) => /条约|和约|协定|策论|文件|档案|电文|电报/.test(item))]);
    if (docs.length) pushNeed("document", docs, evidenceQuery("document", docs));
  }
  if (entities.people?.length || visualKind === "person") {
    const people = cleanPersonEntities(entities.people || []);
    if (people.length) pushNeed("person", people, evidenceQuery("person", people));
  }
  if (shouldRequireLocationEvidence(scene, visualKind, entities)) {
    const locations = cleanLocationEntities(entities.locations || [], scene);
    if (locations.length) pushNeed("map", locations, evidenceQuery("map", locations), true);
  }
  if (visualKind === "newspaper") {
    const keywords = uniqueClean([...(card.visualNeed?.mustShow || []), ...(scene.keywords || [])]);
    pushNeed("newspaper", keywords, `${keywords.join(" ")} newspaper archive`, true);
  }
  if (["explosion", "battle"].includes(visualKind) || entities.events?.length) {
    const events = uniqueClean([...(entities.events || []), ...(card.visualNeed?.mustShow || [])]);
    if (events.length) pushNeed("event", events, evidenceQuery("event", events), true);
  }

  return dedupeNeeds(needs);
}

export async function resolveEvidenceForProject(project, options = {}) {
  const scenes = Array.isArray(project?.scenes) ? project.scenes : [];
  const assets = options.assets || project.assets || loadAssetIndex();
  const resolvedScenes = [];
  const projectEvidence = [];

  for (const scene of scenes) {
    const needs = extractEvidenceNeedsForScene(scene);
    const resolvedNeeds = [];
    for (const need of needs) {
      const resolved = await resolveEvidenceNeed(need, { assets, fetchRemote: options.fetchRemote !== false });
      resolvedNeeds.push(resolved);
      projectEvidence.push(resolved);
    }
    resolvedScenes.push(applyEvidenceToScene(scene, resolvedNeeds));
  }

  return {
    ...project,
    scenes: resolvedScenes,
    evidence: {
      version: 1,
      hardRules: EVIDENCE_HARD_RULES,
      resolvedAt: Date.now(),
      items: projectEvidence,
      stats: evidenceStats(projectEvidence),
    },
  };
}

export async function resolveEvidenceNeed(need, options = {}) {
  const candidates = [];
  const local = resolveLocalEvidence(need, options.assets || []);
  if (local) candidates.push(local);

  if (options.fetchRemote !== false) {
    const commons = await searchWikimediaCommons(need).catch((error) => [
      missingCandidate(need, "wikimedia", `Wikimedia 查询失败：${formatError(error)}`),
    ]);
    candidates.push(...commons);

    if (need.kind === "person" || need.kind === "place" || need.kind === "event" || need.kind === "document" || need.kind === "map") {
      const wiki = await searchWikipediaPageImage(need).catch((error) => [
        missingCandidate(need, "wikipedia", `Wikipedia 查询失败：${formatError(error)}`),
      ]);
      candidates.push(...wiki);
    }
  }

  const ranked = candidates
    .filter((candidate) => candidate.status !== "error")
    .sort((a, b) => b.confidence - a.confidence);
  const selected = ranked.find((candidate) => candidate.mediaUrl || candidate.localPath || candidate.path) || null;
  const cached = selected ? await cacheEvidenceMedia(selected).catch(() => null) : null;
  const finalSelected = renderableEvidenceSource(cached || selected) ? (cached || selected) : null;

  return {
    need,
    status: finalSelected ? "found" : need.mustFind ? "missing_required" : "missing_optional",
    selected: finalSelected,
    candidates: ranked.slice(0, 8),
    fallbackAllowed: !finalSelected,
    reason: finalSelected ? finalSelected.reason : "没有找到可信真实素材",
  };
}

export function applyEvidenceToScene(scene, resolvedNeeds) {
  const found = resolvedNeeds.find((item) => item.status === "found" && item.selected);
  const missingRequired = resolvedNeeds.some((item) => item.status === "missing_required");
  const evidenceStatus = found ? "ok" : missingRequired ? "missing_evidence" : "not_required";

  if (!found) {
    return {
      ...scene,
      evidenceNeeds: resolvedNeeds.map((item) => item.need),
      evidence: {
        status: evidenceStatus,
        selected: null,
        candidates: resolvedNeeds.flatMap((item) => item.candidates || []),
        hardRules: EVIDENCE_HARD_RULES,
      },
      status: missingRequired ? "fallback_used" : scene.status,
    };
  }

  const source = found.selected;
  const src = source.localPath || source.path || source.mediaUrl || source.thumbnail || "";
  return {
    ...scene,
    templateId: "FootageScene",
    providerType: source.provider === "local" ? "footage" : "static",
    visualProviderId: source.id,
    props: {
      ...(scene.props || {}),
      src,
      title: source.title || scene.props?.title || scene.voiceText || scene.text,
      subtitle: source.credit || source.provider,
      fit: found.need.kind === "document" || found.need.kind === "map" ? "contain" : "cover",
      darken: found.need.kind === "document" || found.need.kind === "map" ? 0.08 : 0.22,
      zoom: 1.08,
      showTitle: true,
    },
    visualLayer: {
      type: "footage",
      providerType: source.provider === "local" ? "footage" : "static",
      clipId: source.id,
      path: src,
      title: source.title,
      confidence: source.confidence,
      reason: source.reason,
      sourceUrl: source.url,
      license: source.license,
      evidenceKind: found.need.kind,
      fallbackTemplateId: scene.templateId,
    },
    evidenceNeeds: resolvedNeeds.map((item) => item.need),
    evidence: {
      status: "ok",
      level: evidenceLevelForNeed(found.need),
      selected: source,
      candidates: resolvedNeeds.flatMap((item) => item.candidates || []),
      hardRules: EVIDENCE_HARD_RULES,
    },
    decisionTrace: {
      ...(scene.decisionTrace || {}),
      finalChoice: {
        type: "evidence",
        id: source.id,
        score: source.confidence,
        reason: source.reason,
      },
    },
    status: "ok",
  };
}

export function patchSceneEvidence(project, sceneId, patch = {}) {
  const scenes = (project.scenes || []).map((scene) => {
    if (scene.id !== sceneId) return scene;
    const current = scene.evidence || {};
    const selected = patch.evidenceOverrideUrl
      ? manualEvidenceSource(scene, patch.evidenceOverrideUrl, patch)
      : patch.selected || current.selected || null;
    const resolved = selected
      ? [{ need: patch.need || current.need || extractEvidenceNeedsForScene(scene)[0] || manualNeed(scene), status: "found", selected, candidates: [selected] }]
      : [];
    return resolved.length ? applyEvidenceToScene(scene, resolved) : { ...scene, evidence: { ...current, ...patch } };
  });
  return { ...project, scenes };
}

function resolveLocalEvidence(need, assets) {
  const scored = (Array.isArray(assets) ? assets : [])
    .map((asset) => {
      const blob = [
        asset.id,
        asset.title,
        asset.description,
        asset.kind,
        ...(asset.tags || []),
        ...(asset.bestFor || []),
        ...(asset.semantic?.entities || []),
        ...(asset.semantic?.visualObjects || []),
      ].filter(Boolean).join(" ");
      let confidence = 0;
      for (const entity of need.entities || []) if (blob.includes(entity)) confidence += 30;
      for (const token of tokenize(need.query)) if (blob.includes(token)) confidence += token.length >= 3 ? 8 : 3;
      if (asset.kind === need.kind || asset.semantic?.kind === need.kind) confidence += 20;
      return { asset, confidence };
    })
    .filter((item) => item.confidence >= 45)
    .sort((a, b) => b.confidence - a.confidence);
  const best = scored[0];
  if (!best) return null;
  return {
    id: best.asset.id,
    provider: "local",
    title: best.asset.title || best.asset.id,
    url: best.asset.sourceUrl || best.asset.path,
    path: best.asset.path,
    mediaUrl: best.asset.path,
    thumbnail: best.asset.thumbnail || best.asset.path,
    license: best.asset.license || "local",
    confidence: best.confidence,
    reason: `本地素材命中：${need.entities.join("、") || need.query}`,
    evidenceKind: need.kind,
    credit: best.asset.source || "local",
  };
}

async function searchWikimediaCommons(need) {
  const pages = [];
  for (const query of evidenceSearchQueries(need)) {
    const url = new URL("https://commons.wikimedia.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("generator", "search");
    url.searchParams.set("gsrsearch", query);
    url.searchParams.set("gsrnamespace", "6");
    url.searchParams.set("gsrlimit", "6");
    url.searchParams.set("prop", "imageinfo");
    url.searchParams.set("iiprop", "url|mime|extmetadata");
    url.searchParams.set("iiurlwidth", "1280");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");
    const payload = await fetchJson(url);
    pages.push(...Object.values(payload.query?.pages || {}));
  }
  return uniqueBy(pages, (page) => page.pageid)
    .map((page) => {
      const info = page.imageinfo?.[0] || {};
      const metadata = info.extmetadata || {};
      const mediaUrl = info.url || "";
      const mime = info.mime || "";
      const title = String(page.title || "").replace(/^File:/, "");
      const confidence = scoreEvidenceResult(need, `${title} ${metadata.ImageDescription?.value || ""} ${metadata.ObjectName?.value || ""}`, mime);
      return {
        id: `wikimedia-${page.pageid}`,
        provider: "wikimedia",
        title,
        url: metadata.FilePageURL?.value || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title || "")}`,
        thumbnail: info.thumburl,
        mediaUrl,
        mime,
        license: metadata.LicenseShortName?.value || metadata.UsageTerms?.value || "Wikimedia Commons",
        confidence,
        reason: `Wikimedia Commons 命中：${title}`,
        evidenceKind: need.kind,
        credit: metadata.Credit?.value || metadata.Artist?.value || "Wikimedia Commons",
      };
    })
    .filter((candidate) => candidate.mediaUrl && candidate.confidence >= 30 && /^image\//.test(candidate.mime || ""))
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 8);
}

async function searchWikipediaPageImage(need) {
  const pages = [];
  for (const query of evidenceSearchQueries(need)) {
    const url = new URL("https://en.wikipedia.org/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("generator", "search");
    url.searchParams.set("gsrsearch", query);
    url.searchParams.set("gsrlimit", "4");
    url.searchParams.set("prop", "pageimages|info");
    url.searchParams.set("piprop", "thumbnail|original");
    url.searchParams.set("pithumbsize", "1280");
    url.searchParams.set("inprop", "url");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");
    const payload = await fetchJson(url);
    pages.push(...Object.values(payload.query?.pages || {}));
  }
  return uniqueBy(pages, (page) => page.pageid)
    .map((page) => {
      const mediaUrl = page.original?.source || page.thumbnail?.source || "";
      const confidence = scoreEvidenceResult(need, String(page.title || ""), "image");
      return {
        id: `wikipedia-${page.pageid}`,
        provider: "wikipedia",
        title: page.title,
        url: page.fullurl,
        thumbnail: page.thumbnail?.source,
        mediaUrl,
        mime: "image/unknown",
        license: "see source page",
        confidence,
        reason: `Wikipedia page image 命中：${page.title}`,
        evidenceKind: need.kind,
        credit: "Wikipedia",
      };
    })
    .filter((candidate) => candidate.mediaUrl && candidate.confidence >= 35)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 8);
}

async function cacheEvidenceMedia(source) {
  if (source.localPath || source.path || source.provider === "local") return source;
  const urls = uniqueClean([source.mediaUrl, source.thumbnail]);
  if (!urls.length) return source;
  const mediaUrl = urls[0];
  const extension = extensionFromUrl(mediaUrl);
  if (![".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"].includes(extension)) return source;
  await mkdir(evidenceCacheRoot, { recursive: true });
  const fileName = `${safeName(source.id)}${extension}`;
  const outPath = path.join(evidenceCacheRoot, fileName);
  if (!existsSync(outPath)) {
    let lastError = null;
    for (const candidateUrl of urls) {
      try {
        const res = await fetch(candidateUrl, {
          headers: { "User-Agent": "remotion-project-evidence-resolver/1.0" },
          signal: AbortSignal.timeout(30000),
        });
        if (!res.ok) throw new Error(`下载素材失败 ${res.status}`);
        await writeFile(outPath, Buffer.from(await res.arrayBuffer()));
        lastError = null;
        break;
      } catch (error) {
        lastError = error;
      }
    }
    if (lastError) throw lastError;
  }
  return {
    ...source,
    localPath: `evidence-cache/${fileName}`,
  };
}

function renderableEvidenceSource(source) {
  if (!source) return false;
  if (source.provider === "local" && (source.path || source.localPath)) return true;
  return Boolean(source.localPath || source.path);
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { "User-Agent": "remotion-project-evidence-resolver/1.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function scoreEvidenceResult(need, text, mime) {
  const blob = stripHtml(`${text || ""}`).toLowerCase();
  if (candidateConflictsWithNeed(need, blob)) return 0;
  let score = 20;
  for (const entity of need.entities || []) {
    const clean = entity.toLowerCase();
    if (clean && blob.includes(clean)) score += 35;
  }
  for (const token of tokenize(need.query)) {
    const clean = token.toLowerCase();
    if (clean && blob.includes(clean)) score += token.length >= 4 ? 8 : 3;
  }
  if (/image\//.test(mime || "")) score += 15;
  if (need.kind === "document" && /document|treaty|scan|archive|file|manuscript|条约|和约|档案/.test(blob)) score += 20;
  if (need.kind === "person" && /portrait|photo|photograph|人物|肖像/.test(blob)) score += 18;
  if (need.kind === "map" && /map|地图|railway|route/.test(blob)) score += 18;
  if (need.kind === "map" && !/map|地图|railway|railroad|route|territory|leased|carte|kaart|plan|survey|manchuria|port arthur/.test(blob)) score -= 28;
  return Math.min(100, score);
}

function candidateConflictsWithNeed(need, blob) {
  const mustNotShow = (need.mustNotShow || []).join(" ");
  if (/现代|modern|当前|当代/.test(mustNotShow) && /\b(20\d{2}|201\d|202\d)\b|modern|current|present day/.test(blob)) return true;
  if (/战场爆炸|炮火/.test(mustNotShow) && /explosion|battle|artillery|炮|爆炸/.test(blob)) return true;
  return false;
}

function evidenceLevelForNeed(need) {
  if (need.kind === "document" || need.kind === "newspaper") return "primary";
  if (need.kind === "person" || need.kind === "map" || need.kind === "place" || need.kind === "event") return "secondary";
  return "reconstruction";
}

function evidenceReason(kind, scene, entities) {
  if (kind === "document") return `出现可考据文档：${entities.join("、")}`;
  if (kind === "person") return `出现人物实体：${entities.join("、")}`;
  if (kind === "map") return `出现地点/路线实体：${entities.join("、")}`;
  if (kind === "newspaper") return "出现报纸/号外/舆论类证据需求";
  if (kind === "event") return `出现历史事件：${entities.join("、")}`;
  return scene.voiceText || scene.text || "";
}

function evidenceStats(items) {
  return {
    totalNeeds: items.length,
    found: items.filter((item) => item.status === "found").length,
    missingRequired: items.filter((item) => item.status === "missing_required").length,
  };
}

function missingCandidate(need, provider, reason) {
  return {
    id: `${provider}-missing-${safeName(need.id)}`,
    provider,
    title: need.query,
    url: "",
    confidence: 0,
    reason,
    status: "error",
  };
}

function manualEvidenceSource(scene, url, patch) {
  return {
    id: `manual-${safeName(scene.id)}-${Date.now()}`,
    provider: "manual",
    title: patch.title || scene.props?.title || scene.voiceText || scene.text || "手动素材",
    url,
    mediaUrl: url,
    localPath: normalizeManualPath(url),
    license: patch.license || "manual",
    confidence: 100,
    reason: "手动指定真实素材",
    evidenceKind: patch.kind || "document",
    credit: patch.credit || "manual",
  };
}

function manualNeed(scene) {
  return {
    id: `${scene.id}-manual`,
    segmentId: scene.id,
    kind: "document",
    query: scene.voiceText || scene.text || "",
    mustFind: true,
    entities: [],
  };
}

function normalizeManualPath(url) {
  const value = String(url || "").trim().replace(/\\/g, "/");
  if (/^https?:\/\//i.test(value)) return "";
  return value.startsWith("public/") ? value.slice("public/".length) : value;
}

function dedupeNeeds(needs) {
  const seen = new Set();
  return needs.filter((need) => {
    const key = `${need.kind}:${need.query}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function evidenceQuery(kind, entities) {
  const cleaned = uniqueClean(entities);
  const alias = cleaned.map((entity) => ENTITY_QUERY_ALIASES.get(entity)).find(Boolean);
  if (alias) return alias;
  const joined = cleaned.join(" ");
  if (kind === "document") return `${joined} original document scan`;
  if (kind === "person") return `${cleaned[0]} portrait photograph`;
  if (kind === "map" || kind === "place") return `${joined} historical map`;
  if (kind === "newspaper") return `${joined} newspaper archive`;
  if (kind === "event") return `${joined} historical photograph`;
  return joined;
}

function evidenceSearchQueries(need) {
  const queries = [need.query];
  for (const entity of need.entities || []) {
    const alias = ENTITY_QUERY_ALIASES.get(entity);
    if (alias) {
      queries.push(alias);
      queries.push(alias.replace(/\b(original document scan|historical map|historical photograph|portrait photograph|Japanese general portrait)\b/gi, "").trim());
    }
    queries.push(entity);
  }
  return uniqueClean(queries).filter((query) => query.length >= 2).slice(0, 3);
}

function cleanDocumentEntities(values) {
  const cleaned = uniqueClean(values)
    .map((value) => value.replace(/^《|》$/g, "").trim())
    .filter((value) => value.length >= 2)
    .filter((value) => !GENERIC_DOCUMENT_TERMS.has(value));
  return preferSpecificEntities(cleaned);
}

function cleanEvidenceMustNotShow(kind, values) {
  return uniqueClean(values).filter((value) => {
    if (kind === "person" && /真实肖像照片|真人照片|肖像照片/.test(value)) return false;
    if (kind === "document" && /真实扫描|原始文件|档案扫描/.test(value)) return false;
    return true;
  });
}

function cleanPersonEntities(values) {
  const rolePattern = /参谋|本部|作战|课长|司令|大臣|首相|总裁|记者|学者|将军|大佐|少佐|官厅|气味|这气味|味对/;
  const cleaned = uniqueClean(values)
    .map((value) => value.replace(/^[这那其在对把将和与及、，。；：\s]+/, "").trim())
    .filter((value) => value.length >= 2 && value.length <= 8)
    .filter((value) => !rolePattern.test(value) || /^[\u4e00-\u9fff]{2,5}(太郎|次郎|三郎|一郎|之助|介|男|雄|夫)$/.test(value));
  return preferSpecificEntities(cleaned);
}

function cleanLocationEntities(values, scene) {
  const text = `${scene?.voiceText || ""} ${scene?.text || ""}`;
  const metaphorPattern = /游刃|筋骨|衣袋|怀表|床头柜|考卷|开篇|气味|余味|焦土|铁锈|硝烟|海风|大陆$/;
  const cleaned = uniqueClean(values)
    .map((value) => value.replace(/^[与和及在从到向沿]+/, "").replace(/两港$|两地$|一带$|附近$/g, "").trim())
    .filter((value) => value.length >= 2 && value.length <= 12)
    .filter((value) => !metaphorPattern.test(value))
    .filter((value) => text.includes(value) || ENTITY_QUERY_ALIASES.has(value));
  return preferSpecificEntities(cleaned, { preferShorter: true });
}

function shouldRequireLocationEvidence(scene, visualKind, entities) {
  if (!entities.locations?.length) return false;
  const role = scene?.semanticCard?.narrativeRole || "";
  if (["map", "route", "place"].includes(visualKind)) return true;
  if (["geo_explain", "opening_atmosphere", "event_action", "climax"].includes(role)) return true;
  return false;
}

function preferSpecificEntities(values, options = {}) {
  const cleaned = uniqueClean(values);
  return cleaned.filter((value) => {
    if (options.preferShorter) {
      return !cleaned.some((other) => other !== value && value.includes(other) && other.length >= 2);
    }
    return !cleaned.some((other) => other !== value && other.includes(value) && other.length > value.length);
  });
}

function uniqueClean(values) {
  return [...new Set((values || []).map((value) => String(value || "").trim()).filter(Boolean))];
}

function uniqueBy(values, keyFn) {
  const seen = new Set();
  return values.filter((value) => {
    const key = keyFn(value);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function tokenize(text) {
  return String(text || "")
    .replace(/[，。！？、；：,.!?;:"“”《》()\[\]\n\r]/g, " ")
    .split(/\s+/)
    .filter((item) => item.length >= 2);
}

function extensionFromUrl(value) {
  try {
    const ext = path.extname(new URL(value).pathname).toLowerCase();
    return ext && ext.length <= 6 ? ext : ".jpg";
  } catch {
    return ".jpg";
  }
}

function safeName(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_.-]/g, "_").slice(0, 120);
}

function stripHtml(value) {
  return String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function formatError(error) {
  return error instanceof Error ? error.message : String(error);
}

function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    const key = eq >= 0 ? arg.slice(2, eq) : arg.slice(2);
    const value = eq >= 0 ? arg.slice(eq + 1) : argv[index + 1]?.startsWith("--") ? true : argv[++index];
    out[key] = value;
  }
  return out;
}

function isDirectRun() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isDirectRun()) {
  const args = parseArgs(process.argv.slice(2));
  const projectPath = args.project ? path.resolve(projectRoot, args.project) : "";
  const text = args.text || "";
  if (projectPath) {
    const project = JSON.parse(await readFile(projectPath, "utf8"));
    const resolved = await resolveEvidenceForProject(project);
    console.log(JSON.stringify(resolved.evidence, null, 2));
  } else {
    const fakeScene = { id: "manual", text, voiceText: text, semanticCard: {}, visualContract: {}, keywords: [] };
    console.log(JSON.stringify(extractEvidenceNeedsForScene(fakeScene), null, 2));
  }
}
