import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const DEFAULT_PROVIDER_MANIFEST = "src/templates/visual-provider-manifest.json";
const DEFAULT_ASSET_INDEX = "public/generated/asset-index.json";

export const DEFAULT_RESOLVER_CONFIG = {
  thresholds: { autoAccept: 70, lowConfidence: 45, needsReview: 44 },
  providerPriority: { programmatic: 25, template: 14, footage: 12, static: 8, fallback: 0 },
  kindProviderPreference: {
    document: ["programmatic", "static", "footage"],
    quote: ["programmatic", "static"],
    person: ["programmatic", "static"],
    concept: ["programmatic"],
    map: ["programmatic", "static"],
    route: ["programmatic"],
    atmosphere: ["programmatic", "footage"],
    explosion: ["programmatic", "footage"],
    battle: ["footage", "programmatic"],
    crowd: ["footage", "programmatic"],
    newspaper: ["programmatic", "static"],
    telegram: ["programmatic", "static"],
    train: ["programmatic", "footage"],
    ruins: ["footage", "programmatic"],
    ending: ["programmatic", "footage"],
    fallback: ["fallback"],
  },
  hardRules: {
    forbidHallucinatedEntities: true,
    forbidMustNotShowConflict: true,
    forbidMissingRequiredEntities: true,
    forbidWeakSemanticAutoVisual: true,
    forbidCrossSegmentMatching: true,
  },
  scoringWeights: {
    kindMatch: 40,
    actionMatch: 15,
    entityMatch: 25,
    mustShowMatch: 25,
    capabilityMatch: 15,
    durationFit: 8,
    groundingFit: 15,
    providerPriority: 10,
  },
};

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
  const config = mergeConfig(DEFAULT_RESOLVER_CONFIG, options.config || {});
  const previous = options.previous || null;
  const semanticCard = segment.semanticCard || {};
  const visualContract = segment.visualContract || buildContractFromSemantic(semanticCard);
  const trace = createTrace();
  const normalized = {
    ...segment,
    semanticCard,
    visualContract,
  };

  validateMinimumSemantic(normalized, trace, config);
  if (trace.blocked) {
    return unresolved(normalized, trace);
  }

  const programmaticCandidates = rankProgrammaticProviders({ segment: normalized, providers, previous, trace, config });
  const footageCandidates = rankFootageAssets({ segment: normalized, assets, trace, config });
  const finalChoice = chooseFinalVisual({ segment: normalized, programmaticCandidates, footageCandidates, config });
  return applyVisualChoice(normalized, finalChoice, trace, config);
}

function buildContractFromSemantic(card) {
  const visualNeed = card.visualNeed || {};
  return {
    kind: visualNeed.kind || "fallback",
    required: { capabilities: [] },
    mustShow: arr(visualNeed.mustShow),
    shouldShow: arr(visualNeed.shouldShow),
    mustNotShow: arr(visualNeed.mustNotShow),
    allowedProviderTypes: ["programmatic", "footage", "static", "fallback"],
    grounding: {
      mode: arr(visualNeed.mustShow).length ? "explicit_text" : "programmatic_abstraction",
      evidence: [...arr(visualNeed.mustShow), ...arr(visualNeed.shouldShow)].filter(Boolean),
      hallucinationRisk: arr(visualNeed.mustShow).length ? "low" : "medium",
    },
    timing: { minSec: 4, idealSec: 7, maxSec: 12, canHoldLonger: true, canLoop: true },
    style: {},
    evidenceMode: "explicit_text",
    allowedSources: ["programmatic", "footage", "static", "fallback", "template"],
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

function validateMinimumSemantic(segment, trace, config) {
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

  if (config.hardRules?.forbidWeakSemanticAutoVisual && (!kind || kind === "fallback")) {
    if (!allEntities.length && !hasAction && !hasMustShow) {
      trace.blocked = true;
      trace.blockedReason = "语义卡信息不足，禁止自动生造画面";
    }
  }
  if (contract.grounding?.hallucinationRisk === "high" && !allEntities.length && !hasMustShow) {
    trace.blocked = true;
    trace.blockedReason = "画面合约幻觉风险过高";
  }
}

function rankProgrammaticProviders({ segment, providers, previous, trace, config }) {
  const candidates = [];

  for (const provider of providers) {
    if (!["programmatic", "template", "fallback"].includes(provider.providerType)) continue;
    const rejected = rejectProvider(segment, provider, config);
    if (rejected) {
      trace.rejectedProviders.push({ id: provider.id, providerType: provider.providerType, reason: rejected });
      continue;
    }

    const score = scoreProvider(segment, provider, previous, config);
    if (score <= 0) {
      trace.rejectedProviders.push({ id: provider.id, providerType: provider.providerType, reason: "score <= 0" });
      continue;
    }

    const renderTemplateId = provider.templateId || provider.renderTemplateId || provider.id;
    const candidate = {
      source: provider.providerType,
      providerType: provider.providerType,
      providerId: provider.id,
      templateId: renderTemplateId,
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

function rejectProvider(segment, provider, config = DEFAULT_RESOLVER_CONFIG) {
  const contract = segment.visualContract || {};
  const card = segment.semanticCard || {};
  const kind = contract.kind;
  const accepts = provider.accepts || {};
  const rejectIf = provider.rejectIf || {};
  const rejects = provider.rejects || {};

  if (contract.allowedProviderTypes?.length) {
    const normalizedType = provider.providerType === "template" ? "fallback" : provider.providerType;
    if (!contract.allowedProviderTypes.includes(provider.providerType) && !contract.allowedProviderTypes.includes(normalizedType)) {
      return `providerType 不允许：${provider.providerType}`;
    }
  }

  if (accepts.visualKinds?.length && !accepts.visualKinds.includes(kind)) {
    return `visualKind 不匹配：${kind}`;
  }

  if (rejects.visualKinds?.includes(kind)) return `provider 显式拒绝 kind：${kind}`;

  if (
    (rejectIf.mustNotShowConflicts || rejects.mustNotShowConflicts || config.hardRules?.forbidMustNotShowConflict) &&
    hasConflict(contract.mustNotShow, provider)
  ) {
    return "命中 mustNotShow";
  }

  for (const group of [...arr(accepts.requiredEntityGroups), ...arr(accepts.requiredAllEntityGroups)]) {
    if (!arr(card.entities?.[group]).length) return `缺少必需实体组：${group}`;
  }

  for (const group of arr(rejectIf.missingEntityGroups)) {
    if (!arr(card.entities?.[group]).length) return `缺少必需实体组：${group}`;
  }

  const requiredAny = [...arr(accepts.requiredAny), ...arr(accepts.requiredAnyEntityGroups)];
  if (requiredAny.length) {
    const ok = requiredAny.some((group) => arr(card.entities?.[group]).length > 0);
    if (!ok) return `缺少任一必需实体：${requiredAny.join("/")}`;
  }

  for (const capability of arr(accepts.requiredCapabilities)) {
    if (!providerCapabilities(provider).includes(capability)) return `缺少能力：${capability}`;
  }

  if (accepts.allowedActions?.length) {
    const action = card.event?.action;
    if (action && !accepts.allowedActions.includes(action)) return `action 不匹配：${action}`;
  }

  return "";
}

function scoreProvider(segment, provider, previous, config = DEFAULT_RESOLVER_CONFIG) {
  const card = segment.semanticCard || {};
  const contract = segment.visualContract || {};
  const accepts = provider.accepts || {};
  const caps = providerCapabilities(provider);
  const base = provider.scoring || provider.score || {};
  let score = 0;

  if (accepts.visualKinds?.includes(contract.kind)) score += base.kindMatch ?? 40;

  for (const group of [
    ...arr(accepts.requiredEntityGroups),
    ...arr(accepts.requiredAllEntityGroups),
    ...arr(accepts.requiredAnyEntityGroups),
    ...arr(accepts.requiredAny),
  ]) {
    if (arr(card.entities?.[group]).length) score += base.requiredEntityMatch ?? 25;
  }

  for (const group of ["people", "locations", "organizations", "documents", "objects", "dates", "events"]) {
    const values = arr(card.entities?.[group]);
    const hits = values.filter((value) => includesAny(value, contract.mustShow));
    score += hits.length * (base.entityMatch ?? 8);
  }

  if (accepts.allowedActions?.includes(card.event?.action)) score += base.actionMatch ?? 10;
  if (arr(contract.mustShow).length && caps.includes("render_text")) score += base.mustShowMatch ?? 8;
  for (const capability of arr(contract.required?.capabilities)) {
    if (caps.includes(capability)) score += base.capabilityMatch ?? 6;
  }
  if (contract.kind === "map" && caps.includes("show_map")) score += 20;
  if (["transfer", "route", "transform", "expand", "occupy"].includes(card.event?.action) && caps.includes("show_movement")) score += 15;
  if (caps.includes("show_relationship") && ["concept", "metaphor"].includes(contract.kind)) score += base.relationMatch ?? 10;
  if (contract.grounding?.mode === "programmatic_abstraction" && provider.providerType === "programmatic") score += 6;
  if (previous?.templateId === provider.id) score -= 8;
  score += config.providerPriority?.[provider.providerType] ?? 0;
  score += durationFitScore(segment, provider);

  return Math.round(score);
}

function rankFootageAssets({ segment, assets, trace, config = DEFAULT_RESOLVER_CONFIG }) {
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
    for (const query of searchQueryList(card.searchQueries)) {
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
    score += config.providerPriority?.[asset.providerType === "static" ? "static" : "footage"] ?? 0;

    if (score > 0) {
      const candidate = {
        source: asset.providerType === "static" ? "static" : "footage",
        providerType: asset.providerType === "static" ? "static" : "footage",
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
  const providerType = asset.providerType === "static" ? "static" : "footage";
  if (contract.allowedProviderTypes?.length && !contract.allowedProviderTypes.includes(providerType)) {
    return `providerType 不允许：${providerType}`;
  }
  if (asset.copyright === "restricted" || asset.license === "restricted") return "素材版权受限";

  for (const forbidden of arr(contract.mustNotShow)) {
    if (forbidden && blob.includes(forbidden)) return `命中 mustNotShow：${forbidden}`;
  }
  for (const avoid of arr(asset.avoidFor)) {
    if (avoid && includesAny(avoid, [segment.sceneType, contract.kind, ...arr(contract.mustShow)])) return `命中 avoidFor：${avoid}`;
  }
  return "";
}

function chooseFinalVisual({ segment, programmaticCandidates, footageCandidates, config = DEFAULT_RESOLVER_CONFIG }) {
  const contract = segment.visualContract || {};
  const topProgram = programmaticCandidates[0];
  const topFootage = footageCandidates[0];
  const exactKinds = ["document", "quote", "concept", "metaphor", "map", "geo", "person", "route", "newspaper", "telegram", "train", "ending", "explosion"];

  if (contract.kind === "fallback" && topProgram && topProgram.providerType === "template" && topProgram.score >= 5) return topProgram;
  if (exactKinds.includes(contract.kind) && topProgram && topProgram.score >= config.thresholds.lowConfidence) return topProgram;
  if (["atmosphere", "war", "battle", "place", "object", "crowd", "ruins", "industry"].includes(contract.kind)) {
    if (topFootage && topFootage.score >= config.thresholds.lowConfidence) return topFootage;
    if (topProgram && topProgram.score >= 38) return topProgram;
  }
  if (topFootage && topProgram && topFootage.score >= topProgram.score + 20) return topFootage;
  if (topProgram && topProgram.score >= 35) return topProgram;
  if (topFootage && topFootage.score >= 35) return topFootage;
  return null;
}

function applyVisualChoice(segment, choice, trace, config = DEFAULT_RESOLVER_CONFIG) {
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
    id: choice.providerId || choice.materialId || choice.templateId,
    templateId: choice.templateId,
    score: choice.score,
    reason: Array.isArray(choice.reason) ? choice.reason.join("；") : choice.reason,
    mappedProps: choice.mappedProps,
  };

  if (["footage", "static"].includes(choice.source)) {
    return {
      ...segment,
      templateId: "FootageScene",
      category: choice.source,
      visualProviderId: choice.materialId,
      providerType: choice.source,
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
        providerType: choice.source,
        clipId: choice.materialId,
        path: choice.path,
        confidence: choice.score,
        reason: choice.reason,
      },
      visualCandidates: [...trace.candidateProviders, ...trace.candidateAssets],
      decisionTrace: toLegacyTrace(trace),
      visualDecision: buildVisualDecision(choice),
      status: choice.score >= config.thresholds.autoAccept ? "ok" : "low_confidence",
      durationRangeSec: [4, 8],
    };
  }

  return {
    ...segment,
      templateId: choice.templateId,
      category: choice.category,
      visualProviderId: choice.providerId || choice.templateId,
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
    visualDecision: buildVisualDecision(choice),
    status: choice.score >= config.thresholds.autoAccept ? "ok" : "low_confidence",
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

function buildVisualDecision(choice) {
  return {
    providerType: choice.providerType,
    providerId: choice.providerId || choice.materialId || choice.id || choice.templateId,
    templateId: choice.templateId,
    materialId: choice.materialId,
    props: choice.mappedProps || {},
    score: choice.score,
    reason: choice.reason,
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
    quotedText: extractQuote(segment.text || segment.narrationText || ""),
    snippetFromSegment: summarizeSnippet(segment.text || segment.narrationText || "", arr(contract.mustShow)[0]),
    "semanticCard.summary": card.summary,
    "semanticCard.tone": card.tone,
    "semanticCard.narrativeRole": card.narrativeRole,
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
    "semanticCard.entities.events": card.entities?.events,
    "semanticCard.entities.events[0]": card.entities?.events?.[0],
    "semanticCard.visualNeed.mustShow[0]": card.visualNeed?.mustShow?.[0],
    "visualContract.mustShow": contract.mustShow,
    "visualContract.mustShow[0]": contract.mustShow?.[0],
  };
  return table[raw] ?? "";
}

function providerCapabilities(provider) {
  const caps = Array.isArray(provider.capabilities) ? provider.capabilities : [];
  const normalized = caps.flatMap((cap) => legacyCapabilityMap[cap] || cap);
  if (!Array.isArray(provider.capabilities) && provider.capabilities && typeof provider.capabilities === "object") {
    for (const [key, value] of Object.entries(provider.capabilities)) {
      if (value && legacyCapabilityMap[key]) normalized.push(...arr(legacyCapabilityMap[key]));
    }
  }
  return [...new Set(normalized)];
}

const legacyCapabilityMap = {
  canRenderText: "render_text",
  canHighlightWords: "highlight_text",
  canShowMovement: "show_movement",
  canShowMap: "show_map",
  canShowRelationship: "show_relationship",
  canLoop: "loopable",
  canShowDocument: "show_document",
  canShowQuote: "show_quote",
  canShowPerson: "show_person",
  canShowRoute: "show_route",
  canShowExplosion: "show_explosion",
  canShowCrowd: "show_crowd",
  canShowTrain: "show_train",
  canShowRuins: "show_ruins",
};

function durationFitScore(segment, provider) {
  const duration = provider.duration || {};
  const seconds = Number(segment.durationSec || segment.durationMs / 1000 || 0);
  if (!seconds || !duration.idealSec) return 0;
  const delta = Math.abs(seconds - Number(duration.idealSec));
  if (delta <= 1) return 8;
  if (seconds >= Number(duration.minSec || 0) && seconds <= Number(duration.maxSec || Number.POSITIVE_INFINITY)) return 4;
  return -4;
}

function searchQueryList(searchQueries) {
  if (!searchQueries) return [];
  if (Array.isArray(searchQueries)) return searchQueries;
  if (typeof searchQueries === "object") {
    return [...arr(searchQueries.entity), ...arr(searchQueries.visual), ...arr(searchQueries.mood)];
  }
  return [searchQueries];
}

function summarizeSnippet(text, highlight, maxChars = 120) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  const target = String(highlight || "").trim();
  if (!target || !value.includes(target)) return value.slice(0, maxChars);
  const index = value.indexOf(target);
  const side = Math.max(20, Math.floor((maxChars - target.length) / 2));
  const start = Math.max(0, index - side);
  const end = Math.min(value.length, index + target.length + side);
  return `${start > 0 ? "…" : ""}${value.slice(start, end)}${end < value.length ? "…" : ""}`;
}

function mergeConfig(base, override) {
  return {
    ...base,
    ...override,
    thresholds: { ...base.thresholds, ...(override.thresholds || {}) },
    providerPriority: { ...base.providerPriority, ...(override.providerPriority || {}) },
    kindProviderPreference: { ...base.kindProviderPreference, ...(override.kindProviderPreference || {}) },
    hardRules: { ...base.hardRules, ...(override.hardRules || {}) },
    scoringWeights: { ...base.scoringWeights, ...(override.scoringWeights || {}) },
  };
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
