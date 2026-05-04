import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const DEFAULT_PROVIDER_MANIFEST = "src/templates/visual-provider-manifest.json";
const DEFAULT_ASSET_INDEX = "public/generated/asset-index.json";

export function loadJsonSafe(filePath, fallback = []) {
  const full = path.resolve(process.cwd(), filePath);
  if (!existsSync(full)) return fallback;
  return JSON.parse(readFileSync(full, "utf8"));
}

export function loadVisualProviders(filePath = DEFAULT_PROVIDER_MANIFEST) {
  return loadJsonSafe(filePath, []);
}

export function resolveVisualForSegment(segment, options = {}) {
  const providers = options.providers || loadVisualProviders(options.providerManifest || DEFAULT_PROVIDER_MANIFEST);
  const assets = options.assets || loadJsonSafe(options.assetIndex || DEFAULT_ASSET_INDEX, []);
  const previous = options.previous || null;
  const semanticCard = segment.semanticCard || {};
  const visualContract = segment.visualContract || buildContractFromSemantic(semanticCard);
  const trace = createTrace();
  const normalized = {
    ...segment,
    semanticCard,
    visualContract,
  };

  validateMinimumSemantic(normalized, trace);
  if (trace.blocked) {
    return unresolved(normalized, trace);
  }

  const programmaticCandidates = rankProgrammaticProviders({ segment: normalized, providers, previous, trace });
  const footageCandidates = rankFootageAssets({ segment: normalized, assets, trace });
  const finalChoice = chooseFinalVisual({ segment: normalized, programmaticCandidates, footageCandidates });
  return applyVisualChoice(normalized, finalChoice, trace);
}

function buildContractFromSemantic(card) {
  const visualNeed = card.visualNeed || {};
  return {
    kind: visualNeed.kind || "fallback",
    mustShow: arr(visualNeed.mustShow),
    shouldShow: arr(visualNeed.shouldShow),
    mustNotShow: arr(visualNeed.mustNotShow),
    evidenceMode: "explicit_text",
    allowedSources: ["programmatic", "footage", "template"],
  };
}

function createTrace() {
  return {
    blocked: false,
    blockedReason: "",
    rejectedProviders: [],
    rejectedAssets: [],
    candidateProviders: [],
    candidateAssets: [],
    finalChoice: null,
  };
}

function validateMinimumSemantic(segment, trace) {
  const card = segment.semanticCard || {};
  const contract = segment.visualContract || {};
  const entities = card.entities || {};
  const allEntities = [
    ...arr(entities.people),
    ...arr(entities.locations),
    ...arr(entities.organizations),
    ...arr(entities.documents),
    ...arr(entities.objects),
    ...arr(entities.dates),
  ];
  const hasAction = Boolean(card.event?.action);
  const hasMustShow = arr(contract.mustShow).length > 0;
  const kind = contract.kind;

  if (!segment.text && !segment.narrationText) {
    trace.blocked = true;
    trace.blockedReason = "片段缺少文本";
    return;
  }

  if (!kind || kind === "fallback") {
    if (!allEntities.length && !hasAction && !hasMustShow) {
      trace.blocked = true;
      trace.blockedReason = "语义卡信息不足，禁止自动生造画面";
    }
  }
}

function rankProgrammaticProviders({ segment, providers, previous, trace }) {
  const candidates = [];

  for (const provider of providers) {
    if (!["programmatic", "template"].includes(provider.providerType)) continue;
    const rejected = rejectProvider(segment, provider);
    if (rejected) {
      trace.rejectedProviders.push({ id: provider.id, providerType: provider.providerType, reason: rejected });
      continue;
    }

    const score = scoreProvider(segment, provider, previous);
    if (score <= 0) {
      trace.rejectedProviders.push({ id: provider.id, providerType: provider.providerType, reason: "score <= 0" });
      continue;
    }

    const candidate = {
      source: provider.providerType,
      providerType: provider.providerType,
      templateId: provider.id,
      id: provider.id,
      category: provider.category,
      score,
      reason: explainProviderScore(segment, provider, score),
      mappedProps: mapProviderProps(segment, provider),
      duration: provider.duration,
    };
    trace.candidateProviders.push(candidate);
    candidates.push(candidate);
  }

  return candidates.sort((a, b) => b.score - a.score);
}

function rejectProvider(segment, provider) {
  const contract = segment.visualContract || {};
  const card = segment.semanticCard || {};
  const kind = contract.kind;
  const accepts = provider.accepts || {};
  const rejectIf = provider.rejectIf || {};

  if (accepts.visualKinds?.length && !accepts.visualKinds.includes(kind)) {
    return `visualKind 不匹配：${kind}`;
  }

  if (rejectIf.mustNotShowConflicts && hasConflict(contract.mustNotShow, provider)) {
    return "命中 mustNotShow";
  }

  for (const group of arr(accepts.requiredEntityGroups)) {
    if (!arr(card.entities?.[group]).length) return `缺少必需实体组：${group}`;
  }

  for (const group of arr(rejectIf.missingEntityGroups)) {
    if (!arr(card.entities?.[group]).length) return `缺少必需实体组：${group}`;
  }

  if (accepts.requiredAny?.length) {
    const ok = accepts.requiredAny.some((group) => arr(card.entities?.[group]).length > 0);
    if (!ok) return `缺少任一必需实体：${accepts.requiredAny.join("/")}`;
  }

  if (accepts.allowedActions?.length) {
    const action = card.event?.action;
    if (action && !accepts.allowedActions.includes(action)) return `action 不匹配：${action}`;
  }

  return "";
}

function scoreProvider(segment, provider, previous) {
  const card = segment.semanticCard || {};
  const contract = segment.visualContract || {};
  const accepts = provider.accepts || {};
  const caps = provider.capabilities || {};
  const base = provider.score || {};
  let score = 0;

  if (accepts.visualKinds?.includes(contract.kind)) score += base.kindMatch ?? 40;

  for (const group of arr(accepts.requiredEntityGroups)) {
    if (arr(card.entities?.[group]).length) score += base.requiredEntityMatch ?? 25;
  }

  for (const group of ["people", "locations", "organizations", "documents", "objects", "dates"]) {
    const values = arr(card.entities?.[group]);
    const hits = values.filter((value) => includesAny(value, contract.mustShow));
    score += hits.length * (base.entityMatch ?? 8);
  }

  if (accepts.allowedActions?.includes(card.event?.action)) score += base.actionMatch ?? 10;
  if (arr(contract.mustShow).length && caps.canRenderText) score += base.mustShowMatch ?? 8;
  if (contract.kind === "map" && caps.canShowMap) score += 20;
  if (["transfer", "route", "transform"].includes(card.event?.action) && caps.canShowMovement) score += 15;
  if (caps.canShowRelationship && ["concept", "metaphor"].includes(contract.kind)) score += base.relationMatch ?? 10;
  if (previous?.templateId === provider.id) score -= 8;
  if (provider.providerType === "programmatic") score += 12;

  return Math.round(score);
}

function rankFootageAssets({ segment, assets, trace }) {
  const contract = segment.visualContract || {};
  const card = segment.semanticCard || {};
  const candidates = [];

  for (const asset of assets) {
    const rejected = rejectAsset(segment, asset);
    if (rejected) {
      trace.rejectedAssets.push({ id: asset.id, reason: rejected });
      continue;
    }

    let score = 0;
    const blob = assetBlob(asset);

    for (const word of arr(contract.mustShow)) {
      if (blob.includes(word)) score += 30;
    }
    for (const query of arr(card.searchQueries)) {
      if (blob.includes(query)) score += 8;
      for (const token of tokenize(query)) {
        if (blob.includes(token)) score += token.length >= 3 ? 5 : 2;
      }
    }
    for (const group of Object.keys(card.entities || {})) {
      for (const entity of arr(card.entities[group])) {
        if (blob.includes(entity)) score += 18;
      }
    }
    if (arr(asset.bestFor).includes(segment.sceneType)) score += 12;
    if (arr(asset.semantic?.visualKinds).includes(contract.kind)) score += 20;

    if (score > 0) {
      const candidate = {
        source: "footage",
        providerType: "footage",
        materialId: asset.id,
        id: asset.id,
        path: asset.path,
        title: asset.title,
        score,
        reason: explainAssetScore(segment, asset, score),
        mappedProps: {
          src: asset.path,
          title: asset.title || card.summary,
          subtitle: arr(contract.mustShow).slice(0, 3).join(" · "),
        },
      };
      trace.candidateAssets.push(candidate);
      candidates.push(candidate);
    }
  }

  return candidates.sort((a, b) => b.score - a.score);
}

function rejectAsset(segment, asset) {
  const contract = segment.visualContract || {};
  const blob = assetBlob(asset);
  if (asset.copyright === "restricted" || asset.license === "restricted") return "素材版权受限";

  for (const forbidden of arr(contract.mustNotShow)) {
    if (forbidden && blob.includes(forbidden)) return `命中 mustNotShow：${forbidden}`;
  }
  for (const avoid of arr(asset.avoidFor)) {
    if (avoid && includesAny(avoid, [segment.sceneType, contract.kind, ...arr(contract.mustShow)])) return `命中 avoidFor：${avoid}`;
  }
  return "";
}

function chooseFinalVisual({ segment, programmaticCandidates, footageCandidates }) {
  const contract = segment.visualContract || {};
  const topProgram = programmaticCandidates[0];
  const topFootage = footageCandidates[0];
  const exactKinds = ["document", "quote", "concept", "metaphor", "map", "geo", "person"];

  if (contract.kind === "fallback" && topProgram && topProgram.providerType === "template" && topProgram.score >= 5) return topProgram;
  if (exactKinds.includes(contract.kind) && topProgram && topProgram.score >= 45) return topProgram;
  if (["atmosphere", "war", "place", "object"].includes(contract.kind)) {
    if (topFootage && topFootage.score >= 45) return topFootage;
    if (topProgram && topProgram.score >= 38) return topProgram;
  }
  if (topFootage && topProgram && topFootage.score >= topProgram.score + 20) return topFootage;
  if (topProgram && topProgram.score >= 35) return topProgram;
  if (topFootage && topFootage.score >= 35) return topFootage;
  return null;
}

function applyVisualChoice(segment, choice, trace) {
  if (!choice) {
    trace.finalChoice = {
      type: "none",
      id: "needs_review",
      reason: "没有通过握手的程序动画或素材",
    };
    return {
      ...segment,
      status: "needs_review",
      visualLayer: null,
      visualProviderId: "",
      providerType: "",
      visualCandidates: [...trace.candidateProviders, ...trace.candidateAssets],
      decisionTrace: toLegacyTrace(trace),
    };
  }

  trace.finalChoice = {
    type: choice.source,
    providerType: choice.providerType,
    id: choice.templateId || choice.materialId,
    score: choice.score,
    reason: Array.isArray(choice.reason) ? choice.reason.join("；") : choice.reason,
    mappedProps: choice.mappedProps,
  };

  if (choice.source === "footage") {
    return {
      ...segment,
      templateId: "FootageScene",
      category: "footage",
      visualProviderId: choice.materialId,
      providerType: "footage",
      props: {
        src: choice.path,
        title: choice.mappedProps?.title || segment.semanticCard?.summary,
        subtitle: choice.mappedProps?.subtitle || "",
        fit: "cover",
        darken: 0.22,
        zoom: 1.06,
        showTitle: true,
      },
      visualLayer: {
        type: "footage",
        providerType: "footage",
        clipId: choice.materialId,
        path: choice.path,
        confidence: choice.score,
        reason: choice.reason,
      },
      visualCandidates: [...trace.candidateProviders, ...trace.candidateAssets],
      decisionTrace: toLegacyTrace(trace),
      status: choice.score >= 50 ? "ok" : "low_confidence",
      durationRangeSec: [4, 8],
    };
  }

  return {
    ...segment,
    templateId: choice.templateId,
    category: choice.category,
    visualProviderId: choice.templateId,
    providerType: choice.providerType,
    props: choice.mappedProps || {},
    visualLayer: {
      type: "template",
      providerType: choice.providerType,
      templateId: choice.templateId,
      confidence: choice.score,
      reason: choice.reason,
    },
    visualCandidates: [...trace.candidateProviders, ...trace.candidateAssets],
    decisionTrace: toLegacyTrace(trace),
    status: choice.score >= 50 ? "ok" : "low_confidence",
    durationRangeSec: choice.duration ? [choice.duration.minSec, choice.duration.maxSec] : undefined,
  };
}

function unresolved(segment, trace) {
  trace.finalChoice = {
    type: "none",
    id: "needs_review",
    reason: trace.blockedReason,
  };
  return {
    ...segment,
    templateId: "NarratedScene",
    category: "fallback",
    visualProviderId: "NarratedScene",
    providerType: "template",
    props: {
      title: "需要人工确认",
      bodyText: segment.text || segment.narrationText || "",
      body: segment.text || segment.narrationText || "",
    },
    visualLayer: null,
    visualCandidates: [],
    decisionTrace: toLegacyTrace(trace),
    status: "needs_review",
    durationRangeSec: [4, 7],
  };
}

function toLegacyTrace(trace) {
  return {
    blocked: trace.blocked,
    blockedReason: trace.blockedReason,
    rejectedProviders: trace.rejectedProviders,
    rejectedAssets: trace.rejectedAssets,
    candidateProviders: trace.candidateProviders,
    candidateAssets: trace.candidateAssets,
    rejectedTemplates: trace.rejectedProviders,
    candidateTemplates: trace.candidateProviders
      .filter((candidate) => ["programmatic", "template"].includes(candidate.providerType))
      .map((candidate) => ({
        id: candidate.templateId,
        providerType: candidate.providerType,
        score: candidate.score,
        reason: candidate.reason,
      })),
    finalChoice: trace.finalChoice,
  };
}

function mapProviderProps(segment, provider) {
  const out = {};
  for (const [key, expr] of Object.entries(provider.propMapping || {})) {
    out[key] = evalMapping(expr, segment);
  }
  return out;
}

function evalMapping(expr, segment) {
  if (typeof expr !== "string") return expr;
  const raw = expr.trim();
  if (raw.startsWith("'") && raw.endsWith("'")) return raw.slice(1, -1);

  const card = segment.semanticCard || {};
  const contract = segment.visualContract || {};
  if (raw.includes("||")) {
    for (const part of raw.split("||").map((item) => item.trim())) {
      const value = evalMapping(part, segment);
      if (value && (!Array.isArray(value) || value.length)) return value;
    }
    return "";
  }
  if (raw.includes("+")) {
    return raw
      .split("+")
      .flatMap((part) => arr(evalMapping(part.trim(), segment)))
      .filter(Boolean);
  }
  if (raw === "semanticCard.entities.locations.join(' · ')") return arr(card.entities?.locations).join(" · ");
  if (raw === "visualContract.mustShow.join(',')") return arr(contract.mustShow).join(",");

  const table = {
    "segment.text": segment.text,
    "segment.narrationText": segment.narrationText,
    quote: extractQuote(segment.text || segment.narrationText || ""),
    "semanticCard.summary": card.summary,
    "semanticCard.event.subject": card.event?.subject,
    "semanticCard.event.object": card.event?.object,
    "semanticCard.event.from": card.event?.from,
    "semanticCard.event.to": card.event?.to,
    "semanticCard.entities.documents": card.entities?.documents,
    "semanticCard.entities.documents[0]": card.entities?.documents?.[0],
    "semanticCard.entities.people": card.entities?.people,
    "semanticCard.entities.people[0]": card.entities?.people?.[0],
    "semanticCard.entities.locations": card.entities?.locations,
    "semanticCard.entities.locations[0]": card.entities?.locations?.[0],
    "semanticCard.entities.organizations": card.entities?.organizations,
    "semanticCard.entities.organizations[0]": card.entities?.organizations?.[0],
    "semanticCard.entities.objects": card.entities?.objects,
    "semanticCard.entities.objects[0]": card.entities?.objects?.[0],
    "semanticCard.entities.dates[0]": card.entities?.dates?.[0],
    "semanticCard.visualNeed.mustShow[0]": card.visualNeed?.mustShow?.[0],
    "visualContract.mustShow": contract.mustShow,
    "visualContract.mustShow[0]": contract.mustShow?.[0],
  };
  return table[raw] ?? "";
}

function explainProviderScore(segment, provider, score) {
  const card = segment.semanticCard || {};
  const contract = segment.visualContract || {};
  const reasons = [`kind=${contract.kind}`, `provider=${provider.id}`];
  if (provider.providerType === "programmatic") reasons.push("程序动画优先");
  if (card.event?.action) reasons.push(`action=${card.event.action}`);
  if (arr(contract.mustShow).length) reasons.push(`mustShow=${arr(contract.mustShow).slice(0, 3).join("、")}`);
  reasons.push(`score=${score}`);
  return reasons;
}

function explainAssetScore(segment, asset, score) {
  const contract = segment.visualContract || {};
  const hits = arr(contract.mustShow).filter((word) => assetBlob(asset).includes(word));
  return `素材命中：${hits.slice(0, 4).join("、") || asset.title || asset.id}；score=${score}`;
}

function hasConflict(mustNotShow, provider) {
  const blob = JSON.stringify(provider);
  return arr(mustNotShow).some((item) => item && blob.includes(item));
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

function tokenize(text) {
  return String(text || "")
    .replace(/[，。！？、；：,.!?;:\n\r]/g, " ")
    .split(/\s+/)
    .filter((item) => item.length >= 2);
}

function includesAny(value, list) {
  const current = String(value || "");
  return arr(list).some((item) => item && (current.includes(item) || String(item).includes(current)));
}

function extractQuote(text) {
  const match = String(text || "").match(/[“"]([^”"]{2,120})[”"]/);
  return match?.[1] || "";
}

function arr(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}
