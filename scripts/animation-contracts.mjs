import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ANIMATION_CONTRACT_VERSION = "1.0";

const DEFAULT_PROVIDER_MANIFEST = "src/templates/visual-provider-manifest.json";
const DEFAULT_SCENE_REGISTRY = "src/templates/sceneRegistry.tsx";
const DEFAULT_ROOT = "src/Root.tsx";

export function loadAnimationContracts(options = {}) {
  const manifestPath = options.providerManifest || DEFAULT_PROVIDER_MANIFEST;
  const providers = loadJson(manifestPath, []);
  return normalizeAnimationProviders(providers);
}

export function normalizeAnimationProviders(providers) {
  return (Array.isArray(providers) ? providers : []).map(normalizeAnimationProvider);
}

export function normalizeAnimationProvider(provider) {
  const runtimeTemplateId = provider.templateId || provider.renderTemplateId || provider.id;
  const compositionId = provider.compositionId || provider.runtime?.compositionId || runtimeTemplateId;
  return {
    ...provider,
    contractVersion: provider.contractVersion || ANIMATION_CONTRACT_VERSION,
    templateId: runtimeTemplateId,
    runtime: {
      templateId: runtimeTemplateId,
      sceneRegistryId: provider.runtime?.sceneRegistryId || runtimeTemplateId,
      compositionId,
      componentId: provider.runtime?.componentId || compositionId,
      renderMode: provider.runtime?.renderMode || (provider.providerType === "footage" ? "material" : "remotion_component"),
    },
    design: normalizeDesignSource(provider.design),
  };
}

export function validateAnimationContracts(options = {}) {
  const providers = loadAnimationContracts(options);
  const sceneRegistryIds = extractSceneRegistryTemplateIds(options.sceneRegistryPath || DEFAULT_SCENE_REGISTRY);
  const compositionIds = extractCompositionIds(options.rootPath || DEFAULT_ROOT);
  const issues = [];
  const seen = new Set();

  for (const provider of providers) {
    const label = provider.id || "(missing id)";
    if (!provider.id) {
      issues.push(error(label, "provider 缺少 id"));
      continue;
    }
    if (seen.has(provider.id)) {
      issues.push(error(label, "provider id 重复"));
    }
    seen.add(provider.id);

    if (!provider.providerType) issues.push(error(label, "缺少 providerType"));
    if (!provider.category) issues.push(warn(label, "缺少 category"));
    if (!provider.accepts?.visualKinds?.length) issues.push(error(label, "缺少 accepts.visualKinds"));
    if (!provider.capabilities?.length) issues.push(error(label, "缺少 capabilities"));
    if (!provider.duration) issues.push(warn(label, "缺少 duration"));

    if (["programmatic", "template", "fallback"].includes(provider.providerType)) {
      const sceneId = provider.runtime?.sceneRegistryId || provider.templateId;
      const compositionId = provider.runtime?.compositionId || provider.templateId;
      if (sceneId && !sceneRegistryIds.has(sceneId)) {
        issues.push(error(label, `runtime.sceneRegistryId 未注册：${sceneId}`));
      }
      if (compositionId && !compositionIds.has(compositionId) && provider.providerType !== "fallback") {
        issues.push(warn(label, `composition 未单独注册：${compositionId}`));
      }
      if (!provider.propMapping || Object.keys(provider.propMapping).length === 0) {
        issues.push(error(label, "缺少 propMapping，Resolver 无法统一填参"));
      }
    }

    if (provider.design?.sourceType === "pencil") {
      const filePath = provider.design.pencil?.filePath;
      const nodeIds = provider.design.pencil?.nodeIds || [];
      if (!filePath) issues.push(warn(label, "Pencil design 缺少 filePath"));
      if (!nodeIds.length) issues.push(warn(label, "Pencil design 缺少 nodeIds"));
    }
  }

  return {
    ok: issues.every((item) => item.level !== "error"),
    providers,
    issues,
    sceneRegistryIds: [...sceneRegistryIds],
    compositionIds: [...compositionIds],
  };
}

export function extractSceneRegistryTemplateIds(filePath = DEFAULT_SCENE_REGISTRY) {
  const source = readText(filePath);
  const ids = new Set();
  for (const match of source.matchAll(/\|\s*"([^"]+)"/g)) ids.add(match[1]);
  for (const match of source.matchAll(/case\s+"([^"]+)"/g)) ids.add(match[1]);
  return ids;
}

export function extractCompositionIds(filePath = DEFAULT_ROOT) {
  const source = readText(filePath);
  const ids = new Set();
  for (const match of source.matchAll(/<Composition\s+id="([^"]+)"/g)) ids.add(match[1]);
  for (const match of source.matchAll(/id="([^"]+)"\s+component=/g)) ids.add(match[1]);
  return ids;
}

function normalizeDesignSource(design = {}) {
  if (!design || typeof design !== "object") {
    return { sourceType: "none", status: "unlinked" };
  }
  return {
    sourceType: design.sourceType || "none",
    status: design.status || (design.sourceType ? "linked" : "unlinked"),
    intent: design.intent || "",
    layerModel: Array.isArray(design.layerModel) ? design.layerModel : [],
    pencil: design.pencil || { filePath: "", nodeIds: [] },
    notes: design.notes || "",
  };
}

function loadJson(filePath, fallback) {
  const full = path.resolve(process.cwd(), filePath);
  if (!existsSync(full)) return fallback;
  return JSON.parse(readFileSync(full, "utf8"));
}

function readText(filePath) {
  const full = path.resolve(process.cwd(), filePath);
  return existsSync(full) ? readFileSync(full, "utf8") : "";
}

function error(providerId, message) {
  return { level: "error", providerId, message };
}

function warn(providerId, message) {
  return { level: "warn", providerId, message };
}

function isDirectRun() {
  return process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
}

if (isDirectRun()) {
  const json = process.argv.includes("--json");
  const strict = process.argv.includes("--strict");
  const result = validateAnimationContracts();
  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(`ANIMATION_CONTRACT_VERSION ${ANIMATION_CONTRACT_VERSION}`);
    console.log(`PROVIDERS ${result.providers.length}`);
    console.log(`ERRORS ${result.issues.filter((item) => item.level === "error").length}`);
    console.log(`WARNINGS ${result.issues.filter((item) => item.level === "warn").length}`);
    for (const issue of result.issues) {
      console.log(`${issue.level.toUpperCase()} ${issue.providerId}: ${issue.message}`);
    }
  }
  if (!result.ok || (strict && result.issues.length)) {
    process.exitCode = 1;
  }
}
