import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { attachAssetsToScenes, loadAssetIndex, matchAssetsForScene } from "./asset-matcher.mjs";
import { patchSceneEvidence } from "./evidence-resolver.mjs";
import { planScenesFromCaptions } from "./scene-planner.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(__dirname, "..");
export const projectsRoot = path.join(projectRoot, ".runtime", "video-projects");
const DEFAULT_CAPTION_LAYOUT = {
  left: 78,
  right: 78,
  bottom: 34,
  minHeight: 0,
  paddingX: 24,
  paddingY: 4,
  fontSize: 30,
  borderRadius: 0,
  textColor: "#f8fafc",
  backgroundColor: "transparent",
  fontWeight: 850,
  lineHeight: 1.22,
};
const DEFAULT_PROGRESS_LAYOUT = {
  left: 0,
  right: 0,
  bottom: 0,
  height: 30,
  gap: 4,
  paddingX: 0,
  labelFontSize: 14,
  minSegmentWidth: 36,
};
const MAX_DISPLAY_CAPTION_CHARS = 22;

export async function listProjects() {
  await mkdir(projectsRoot, { recursive: true });
  const files = await readdir(projectsRoot, { withFileTypes: true });
  const projects = [];
  for (const file of files) {
    if (!file.isFile() || !file.name.endsWith(".json")) continue;
    try {
      const project = JSON.parse(await readFile(path.join(projectsRoot, file.name), "utf8"));
      projects.push({
        id: project.id,
        title: project.title || "未命名项目",
        updatedAt: Number(project.updatedAt || project.source?.createdAt || 0),
        createdAt: Number(project.source?.createdAt || project.updatedAt || 0),
        sceneCount: Array.isArray(project.scenes) ? project.scenes.length : 0,
        videoUrl: project.source?.videoFile ? `/project-files/${encodeURIComponent(project.id)}` : project.source?.videoUrl || "",
      });
    } catch {
      // Ignore partially written or manually edited invalid project files.
    }
  }
  return projects.sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function createBlankProject(input = {}) {
  const id = `project-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const now = Date.now();
  const title = String(input.title || "未命名视频项目").trim() || "未命名视频项目";
  const project = {
    id,
    title,
    audioSrc: "",
    captions: [],
    captionStyle: normalizeCaptionStyle(input.captionStyle),
    progressStyle: normalizeProgressStyle(input.progressStyle),
    captionLayout: normalizeCaptionLayout(input.captionLayout || input),
    progressLayout: normalizeProgressLayout(input.progressLayout || input),
    scenes: [],
    assets: loadAssetIndex(),
    history: [],
    source: {
      jobId: "",
      text: "",
      propsPath: "",
      scenesPath: "",
      videoFile: "",
      videoUrl: "",
      createdAt: now,
    },
    updatedAt: now,
  };
  return saveProject(project);
}

export async function createProjectFromJob(job) {
  const result = job.result || {};
  const props = result.propsPath && existsSync(result.propsPath) ? JSON.parse(await readFile(result.propsPath, "utf8")) : {};
  const scenePayload =
    result.scenesPath && existsSync(result.scenesPath) ? JSON.parse(await readFile(result.scenesPath, "utf8")) : {};
  const scenes = props.scenes || scenePayload.scenes || [];
  const assets = loadAssetIndex();
  const timelineScenes = scenes.map((scene, index) => sceneToTimelineScene(scene, index));
  const captionLayoutInput = {
    ...(job.input?.captionLayout || job.input || {}),
    ...(props.captionLayout || props || {}),
  };
  const progressLayoutInput = {
    ...(job.input?.progressLayout || job.input || {}),
    ...(props.progressLayout || props || {}),
  };
  const project = {
    id: job.id,
    title: props.title || job.input?.title || "视频项目",
    audioSrc: props.audioSrc || toPublicPath(result.audioFile || ""),
    captions: props.captions || [],
    captionStyle: normalizeCaptionStyle(props.captionStyle || job.input?.captionStyle),
    progressStyle: normalizeProgressStyle(props.progressStyle || job.input?.progressStyle),
    captionLayout: normalizeCaptionLayout(captionLayoutInput),
    progressLayout: normalizeProgressLayout(progressLayoutInput),
    scenes: timelineScenes,
    assets,
    history: [],
    source: {
      jobId: job.id,
      text: job.input?.text || "",
      propsPath: result.propsPath || "",
      scenesPath: result.scenesPath || "",
      videoFile: result.videoFile || "",
      videoUrl: `/files/${encodeURIComponent(job.id)}`,
      createdAt: Date.now(),
    },
    updatedAt: Date.now(),
  };
  const repaired = repairProjectTimeline(project);
  await saveProject(repaired.project);
  return repaired.project;
}

export async function loadProject(id) {
  const file = projectPath(id);
  if (!existsSync(file)) {
    return null;
  }
  return JSON.parse(await readFile(file, "utf8"));
}

export async function saveProject(project) {
  await mkdir(projectsRoot, { recursive: true });
  const next = { ...project, updatedAt: Date.now() };
  await writeFile(projectPath(project.id), JSON.stringify(next, null, 2), "utf8");
  return next;
}

export function projectToMultiSceneProps(project) {
  const timeline = repairProjectTimeline(project, { strict: true });
  if (!timeline.ok) {
    throw new Error(`项目时间轴不一致：${timeline.diagnostics.join("；")}`);
  }
  const stableProject = timeline.project;
  const scenes = stableProject.scenes.map((scene, index) => {
    const fromFrame = Math.max(0, Math.round((Number(scene.startMs || 0) / 1000) * 30));
    const durationInFrames = Math.max(1, Math.round(((Number(scene.endMs || 0) - Number(scene.startMs || 0)) / 1000) * 30));
    return {
      id: scene.id,
      index,
      text: scene.voiceText,
      sceneType: scene.sceneType,
      narrationText: scene.voiceText,
      visualIntent: scene.visualIntent || "",
      visualIntentData: scene.visualIntentData || {},
      semanticCard: scene.semanticCard || {},
      visualContract: scene.visualContract || {},
      visualGrounding: scene.visualGrounding || {},
      visualCandidates: scene.visualCandidates || [],
      decisionTrace: scene.decisionTrace || {},
      visualProviderId: scene.visualProviderId || scene.visualLayer?.templateId || scene.templateId,
      providerType: scene.providerType || scene.visualLayer?.providerType || "",
      templateId: scene.templateId,
      category: scene.category,
      durationSec: Math.round((durationInFrames / 30) * 100) / 100,
      fromFrame,
      durationInFrames,
      audioStartMs: scene.startMs,
      audioEndMs: scene.endMs,
      captionIndex: scene.captionIndex,
      parentCaptionId: scene.parentCaptionId,
      parentCaptionIndex: scene.parentCaptionIndex,
      estimatedTiming: Boolean(scene.estimatedTiming),
      timingSource: scene.timingSource || "project",
      keywords: scene.keywords || [],
      decisionReason: scene.decisionReason || "",
      visualLayer: scene.visualLayer,
      evidenceNeeds: scene.evidenceNeeds || [],
      evidence: scene.evidence || {},
      props: {
        ...scene.props,
        title: scene.props?.title || scene.subtitle || scene.voiceText.slice(0, 18),
        body: scene.props?.body || scene.subtitle || scene.voiceText,
      },
    };
  });
  const displayCaptions = buildDisplayCaptionsFromScenes(stableProject.scenes, stableProject.captions);
  return {
    title: stableProject.title,
    audioSrc: stableProject.audioSrc,
    captions: displayCaptions,
    captionStyle: normalizeCaptionStyle(stableProject.captionStyle),
    progressStyle: normalizeProgressStyle(stableProject.progressStyle),
    captionLayout: normalizeCaptionLayout(stableProject.captionLayout || {}),
    progressLayout: normalizeProgressLayout(stableProject.progressLayout || {}),
    ...layoutToSchemaProps(
      normalizeCaptionLayout(stableProject.captionLayout || {}),
      normalizeProgressLayout(stableProject.progressLayout || {}),
    ),
    enableAudio: true,
    showCaptions: true,
    showSceneLabels: false,
    scenes,
  };
}

export function repairProjectTimeline(project, options = {}) {
  const diagnostics = [];
  const sourceText = String(project?.source?.text || project?.sourceText || project?.text || "").trim();
  let changed = false;
  let captions = normalizeTimelineCaptions(project?.captions || []);
  let scenes = Array.isArray(project?.scenes) ? project.scenes : [];

  if (captions.length && sourceText && captionsDriftFromSource(captions, sourceText)) {
    captions = rewriteCaptionTextFromSource(captions, sourceText);
    diagnostics.push("字幕文本已按原文重建，保留原字幕时间戳");
    changed = true;
  }

  const sceneCheck = validateSceneCaptionLockstep(scenes, captions);
  if (captions.length && !sceneCheck.ok) {
    const plannedScenes = planScenesFromCaptions(captions, {
      fps: Number(options.fps || 30),
      sourceText,
      maxChars: Number(options.maxChars || project?.source?.maxChars || 130),
      assets: project?.assets || loadAssetIndex(),
    });
    scenes = plannedScenes.map((scene, index) => sceneToTimelineScene(scene, index));
    diagnostics.push(`片段时间轴已按 captions 重建：${sceneCheck.reason}`);
    changed = true;
  }

  const finalCheck = validateSceneCaptionLockstep(scenes, captions);
  const ok = !captions.length || finalCheck.ok;
  if (!ok) {
    diagnostics.push(finalCheck.reason || "片段和字幕时间轴仍不一致");
  }

  return {
    ok,
    changed,
    project: {
      ...project,
      captions,
      scenes,
      timelineIntegrity: {
        ok,
        source: captions.length ? "captions" : "scenes",
        diagnostics,
        checkedAt: Date.now(),
      },
    },
    diagnostics,
  };
}

function normalizeCaptionStyle(value) {
  return ["typewriter", "classic", "none"].includes(String(value || ""))
    ? String(value)
    : "typewriter";
}

function normalizeProgressStyle(value) {
  return ["gradient", "thin", "none"].includes(String(value || ""))
    ? String(value)
    : "gradient";
}

function buildDisplayCaptionsFromScenes(scenes, captions) {
  const sceneCaptions = (Array.isArray(scenes) ? scenes : [])
    .map((scene, index) => {
      const startMs = Number(scene.startMs ?? scene.audioStartMs ?? 0);
      const endMs = Number(scene.endMs ?? scene.audioEndMs ?? startMs);
      const text = String(scene.voiceText || scene.narrationText || scene.text || "").replace(/\s+/g, " ").trim();
      if (!text || !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
        return null;
      }
      return {
        index: index + 1,
        startMs,
        endMs,
        text,
        parentCaptionIndex: scene.parentCaptionIndex,
        source: "segment",
      };
    })
    .filter(Boolean);
  return sceneCaptions.length ? sceneCaptions : normalizeTimelineCaptions(captions);
}

function normalizeCaptionLayout(value = {}) {
  return {
    ...DEFAULT_CAPTION_LAYOUT,
    ...pickNumberFields(value, {
    left: "captionLeft",
    right: "captionRight",
    bottom: "captionBottom",
    minHeight: "captionMinHeight",
    paddingX: "captionPaddingX",
    paddingY: "captionPaddingY",
    fontSize: "captionFontSize",
    borderRadius: "captionBorderRadius",
    fontWeight: "captionFontWeight",
    lineHeight: "captionLineHeight",
    }),
    ...pickStringFields(value, {
      textColor: "captionTextColor",
      backgroundColor: "captionBackgroundColor",
    }),
  };
}

function normalizeProgressLayout(value = {}) {
  return {
    ...DEFAULT_PROGRESS_LAYOUT,
    ...pickNumberFields(value, {
    left: "progressLeft",
    right: "progressRight",
    bottom: "progressBottom",
    height: "progressHeight",
    gap: "progressGap",
    paddingX: "progressPaddingX",
    labelFontSize: "progressLabelFontSize",
    minSegmentWidth: "progressMinSegmentWidth",
    }),
  };
}

function layoutToSchemaProps(captionLayout, progressLayout) {
  return {
    captionLeft: captionLayout.left,
    captionRight: captionLayout.right,
    captionBottom: captionLayout.bottom,
    captionMinHeight: captionLayout.minHeight,
    captionPaddingX: captionLayout.paddingX,
    captionPaddingY: captionLayout.paddingY,
    captionFontSize: captionLayout.fontSize,
    captionBorderRadius: captionLayout.borderRadius,
    captionTextColor: captionLayout.textColor,
    captionBackgroundColor: captionLayout.backgroundColor,
    captionFontWeight: captionLayout.fontWeight,
    captionLineHeight: captionLayout.lineHeight,
    progressLeft: progressLayout.left,
    progressRight: progressLayout.right,
    progressBottom: progressLayout.bottom,
    progressHeight: progressLayout.height,
    progressGap: progressLayout.gap,
    progressPaddingX: progressLayout.paddingX,
    progressLabelFontSize: progressLayout.labelFontSize,
    progressMinSegmentWidth: progressLayout.minSegmentWidth,
  };
}

function pickNumberFields(source, aliases) {
  const out = {};
  for (const [key, alias] of Object.entries(aliases)) {
    const value = source?.[key] ?? source?.[alias];
    if (value !== "" && value != null && Number.isFinite(Number(value))) {
      out[key] = Number(value);
    }
  }
  return out;
}

function pickStringFields(source, aliases) {
  const out = {};
  for (const [key, alias] of Object.entries(aliases)) {
    const value = source?.[key] ?? source?.[alias];
    if (typeof value === "string" && value.trim()) {
      out[key] = value.trim();
    }
  }
  return out;
}

export function projectToTracks(project) {
  const scenes = Array.isArray(project.scenes) ? project.scenes : [];
  const captions = Array.isArray(project.captions) ? project.captions : [];
  const durationMs = Math.max(
    0,
    ...scenes.map((scene) => Number(scene.endMs || 0)),
    ...captions.map((caption) => Number(caption.endMs || 0)),
  );
  return [
    {
      id: "audio",
      type: "audio",
      name: "旁白",
      clips: project.audioSrc
        ? [
            {
              id: "main-audio",
              trackId: "audio",
              type: "audio",
              startMs: 0,
              endMs: durationMs,
              src: project.audioSrc,
              title: "旁白音频",
              locked: true,
            },
          ]
        : [],
    },
    {
      id: "material",
      type: "material",
      name: "素材",
      clips: scenes
        .filter((scene) => scene.visualLayer?.path)
        .map((scene) => ({
          id: `${scene.id}-material`,
          trackId: "material",
          type: "material",
          startMs: Number(scene.startMs || 0),
          endMs: Number(scene.endMs || 0),
          sourceStartMs: Number(scene.visualLayer?.startMs || 0),
          sourceEndMs: Number(scene.visualLayer?.endMs || 0),
          src: scene.visualLayer.path,
          title: scene.visualLayer.title || scene.props?.title || scene.subtitle || "素材片段",
          sceneId: scene.id,
          locked: Boolean(scene.locked),
        })),
    },
    {
      id: "scene",
      type: "scene",
      name: "镜头",
      clips: scenes.map((scene) => ({
        id: scene.id,
        trackId: "scene",
        type: "scene",
        startMs: Number(scene.startMs || 0),
        endMs: Number(scene.endMs || 0),
        title: scene.props?.title || scene.subtitle || scene.sceneType || "镜头",
        text: scene.voiceText || scene.subtitle || "",
        templateId: scene.templateId,
        props: scene.props || {},
        sceneId: scene.id,
        locked: Boolean(scene.locked),
      })),
    },
    {
      id: "subtitle",
      type: "subtitle",
      name: "字幕",
      clips: captions.map((caption) => ({
        id: `caption-${caption.index}`,
        trackId: "subtitle",
        type: "subtitle",
        startMs: Number(caption.startMs || 0),
        endMs: Number(caption.endMs || 0),
        title: caption.text || "字幕",
        text: caption.text || "",
        locked: true,
      })),
    },
  ];
}

export function projectToSegments(project) {
  const scenes = Array.isArray(project.scenes) ? project.scenes : [];
  return scenes.map((scene, index) => {
    const startMs = Number(scene.startMs || 0);
    const endMs = Number(scene.endMs || startMs);
    const visualLayer = scene.visualLayer || {};
    const confidence = Number(visualLayer.confidence || 0);
    const source = visualLayer.type === "footage" ? "footage" : scene.providerType || visualLayer.providerType || "template";
    const status =
      scene.evidence?.status === "missing_evidence"
        ? "missing_evidence"
        : scene.status === "fallback_used"
          ? "fallback_used"
          : visualLayer.type === "footage" && !visualLayer.path
            ? "missing_visual"
            : confidence > 0 && confidence < 12
              ? "low_confidence"
              : "ok";
    return {
      id: scene.id,
      order: Number(scene.order ?? index),
      text: scene.voiceText || scene.narrationText || scene.subtitle || "",
      narrationText: scene.voiceText || scene.narrationText || scene.subtitle || "",
      subtitleText: scene.subtitle || scene.voiceText || scene.narrationText || "",
      audioStartMs: startMs,
      audioEndMs: endMs,
      startMs,
      endMs,
      durationMs: Math.max(0, endMs - startMs),
      voice: {
        instruction: scene.voice?.instruction || "",
        audioSrc: project.audioSrc || "",
      },
      visual: {
        source,
        type: source,
        templateId: scene.templateId || visualLayer.templateId || "NarratedScene",
        materialId: visualLayer.clipId || "",
        src: visualLayer.path || "",
        props: scene.props || {},
        confidence,
        reason: visualLayer.reason || scene.decisionReason || "",
        evidenceId: scene.evidence?.selected?.id || "",
        evidenceSourceUrl: scene.evidence?.selected?.url || visualLayer.sourceUrl || "",
      },
      visualProviderId: scene.visualProviderId || visualLayer.templateId || visualLayer.clipId || scene.templateId,
      providerType: scene.providerType || visualLayer.providerType || source,
      semanticCard: scene.semanticCard || {},
      visualContract: scene.visualContract || {},
      visualGrounding: scene.visualGrounding || {},
      evidenceNeeds: scene.evidenceNeeds || [],
      evidence: scene.evidence || {},
      visualCandidates: scene.visualCandidates || [],
      decisionTrace: scene.decisionTrace || {},
      alternatives: scene.alternatives || scene.visualCandidates || [],
      status,
      locked: Boolean(scene.locked),
      sceneType: scene.sceneType || "",
    };
  });
}

export function patchEvidence(project, sceneId, patch) {
  const before = clone(project);
  return withHistory(patchSceneEvidence(project, sceneId, patch), "updateEvidence", { sceneId, patch }, before);
}

export function patchScene(project, sceneId, patch) {
  const before = clone(project);
  const scenes = project.scenes.map((scene) => {
    if (scene.id !== sceneId) return scene;
    return {
      ...scene,
      ...patch,
      props: patch.props ? { ...scene.props, ...patch.props } : scene.props,
      visualLayer: patch.visualLayer ? { ...scene.visualLayer, ...patch.visualLayer } : scene.visualLayer,
    };
  });
  return withHistory({ ...project, scenes }, "updateScene", { sceneId, patch }, before);
}

export function patchProjectInfrastructure(project, patch = {}) {
  const before = clone(project);
  return withHistory(
    {
      ...project,
      captionStyle: normalizeCaptionStyle(patch.captionStyle ?? project.captionStyle),
      progressStyle: normalizeProgressStyle(patch.progressStyle ?? project.progressStyle),
      captionLayout: normalizeCaptionLayout({
        ...(project.captionLayout || {}),
        ...(patch.captionLayout || {}),
        ...patch,
      }),
      progressLayout: normalizeProgressLayout({
        ...(project.progressLayout || {}),
        ...(patch.progressLayout || {}),
        ...patch,
      }),
    },
    "updateInfrastructure",
    patch,
    before,
  );
}

export function setSceneLocked(project, sceneId, locked) {
  return patchScene(project, sceneId, { locked: Boolean(locked) });
}

export function reorderScenes(project, sceneIds) {
  const before = clone(project);
  const byId = new Map(project.scenes.map((scene) => [scene.id, scene]));
  const ordered = sceneIds.map((id) => byId.get(id)).filter(Boolean);
  const rest = project.scenes.filter((scene) => !sceneIds.includes(scene.id));
  const scenes = [...ordered, ...rest].map((scene, index) => ({ ...scene, order: index }));
  return withHistory({ ...project, scenes }, "reorderScene", { sceneIds }, before);
}

export function rematchScene(project, sceneId) {
  const scene = project.scenes.find((item) => item.id === sceneId);
  if (!scene) {
    return [];
  }
  const autoScene = timelineSceneToAutoScene(scene);
  return matchAssetsForScene(autoScene, project.assets || loadAssetIndex(), { minScore: 1, limit: 8 }).map((item) => ({
    id: item.asset.id,
    path: item.asset.path,
    title: item.asset.title,
    durationMs: Math.round(Number(item.asset.durationSec || 0) * 1000),
    tags: item.asset.tags || [],
    score: item.score,
    reason: item.reason,
    copyright: item.asset.license === "local" ? "local" : "unknown",
    source: item.asset.source || "local-library",
  }));
}

export function replaceSceneMaterial(project, sceneId, candidate) {
  const before = clone(project);
  const scenes = project.scenes.map((scene) => {
    if (scene.id !== sceneId) return scene;
    return {
      ...scene,
      visualLayer: {
        type: "footage",
        providerType: "footage",
        clipId: candidate.id,
        path: candidate.path,
        title: candidate.title,
        startMs: candidate.startMs || 0,
        endMs: candidate.endMs || Math.max(0, Number(candidate.durationMs || 0)),
        confidence: candidate.score || 0,
        reason: candidate.reason || "手动替换素材",
        fallbackTemplateId: scene.templateId,
      },
      visualProviderId: candidate.id,
      providerType: "footage",
      alternatives: [candidate, ...(scene.alternatives || []).filter((item) => item.id !== candidate.id)].slice(0, 12),
    };
  });
  return withHistory({ ...project, scenes }, "replaceMaterial", { sceneId, candidate }, before);
}

function normalizeTimelineCaptions(captions) {
  return (Array.isArray(captions) ? captions : [])
    .map((caption, index) => {
      const startMs = Math.max(0, Number(caption.startMs || 0));
      const endMs = Math.max(startMs, Number(caption.endMs || startMs));
      return {
        ...caption,
        index: Number(caption.index || index + 1),
        startMs,
        endMs,
        text: String(caption.text || "").trim(),
      };
    })
    .filter((caption) => caption.text && caption.endMs > caption.startMs)
    .sort((a, b) => a.startMs - b.startMs);
}

function captionsDriftFromSource(captions, sourceText) {
  const sourceClean = cleanTimelineText(sourceText);
  const captionClean = cleanTimelineText(captions.map((caption) => caption.text).join(""));
  if (!sourceClean || !captionClean) {
    return false;
  }
  if (sourceClean === captionClean) {
    return false;
  }
  const captionTextsMostlyFromSource = captions.every((caption) => {
    const clean = cleanTimelineText(caption.text);
    if (!clean) return true;
    if (sourceClean.includes(clean)) return true;
    const probe = clean.slice(0, Math.min(clean.length, 12));
    return probe.length >= 6 && sourceClean.includes(probe);
  });
  if (captionTextsMostlyFromSource) {
    return false;
  }
  return textSimilarity(sourceClean, captionClean) < 0.92;
}

function rewriteCaptionTextFromSource(captions, sourceText) {
  const chunks = splitSourceByCaptionTiming(sourceText, captions);
  return captions.map((caption, index) => ({
    ...caption,
    text: chunks[index] || caption.text,
    textSource: "source_text",
  }));
}

function splitSourceByCaptionTiming(sourceText, captions) {
  const chars = Array.from(String(sourceText || "").replace(/\s+/g, " ").trim());
  if (!chars.length || !captions.length) {
    return [];
  }
  const totalWeight = captions.reduce(
    (sum, caption) => sum + Math.max(1, Number(caption.endMs || 0) - Number(caption.startMs || 0)),
    0,
  );
  const breakpoints = collectTextBreakpoints(chars);
  const chunks = [];
  let charStart = 0;
  let consumedWeight = 0;

  for (let index = 0; index < captions.length; index += 1) {
    const isLast = index === captions.length - 1;
    if (isLast) {
      chunks.push(chars.slice(charStart).join("").trim());
      break;
    }
    consumedWeight += Math.max(1, Number(captions[index].endMs || 0) - Number(captions[index].startMs || 0));
    const target = Math.round((consumedWeight / totalWeight) * chars.length);
    const minEnd = Math.min(chars.length, charStart + 6);
    const maxEnd = Math.max(minEnd, chars.length - (captions.length - index - 1) * 6);
    const charEnd = chooseNearestBreakpoint(breakpoints, target, minEnd, maxEnd);
    chunks.push(chars.slice(charStart, charEnd).join("").trim());
    charStart = charEnd;
  }
  return chunks;
}

function collectTextBreakpoints(chars) {
  const points = [];
  chars.forEach((char, index) => {
    if (/[，。！？；：、,.!?;:》”]/.test(char)) {
      points.push(index + 1);
    }
  });
  return points;
}

function chooseNearestBreakpoint(points, target, minEnd, maxEnd) {
  const candidates = points.filter((point) => point >= minEnd && point <= maxEnd);
  if (!candidates.length) {
    return Math.max(minEnd, Math.min(maxEnd, target));
  }
  return candidates.reduce((best, point) => (Math.abs(point - target) < Math.abs(best - target) ? point : best), candidates[0]);
}

function validateSceneCaptionLockstep(scenes, captions) {
  if (!Array.isArray(captions) || captions.length === 0) {
    return { ok: true, reason: "" };
  }
  if (!Array.isArray(scenes) || scenes.length === 0) {
    return { ok: false, reason: "项目没有片段" };
  }
  if (scenes.some((scene) => !String(scene.voiceText || scene.narrationText || scene.text || "").trim())) {
    return { ok: false, reason: "存在空文本片段" };
  }
  if (
    scenes.some(
      (scene) =>
        Array.from(String(scene.voiceText || scene.narrationText || scene.text || "").replace(/\s+/g, "").trim()).length >
        MAX_DISPLAY_CAPTION_CHARS,
    )
  ) {
    return { ok: false, reason: `存在超过 ${MAX_DISPLAY_CAPTION_CHARS} 字的显示字幕片段` };
  }
  if (scenes.some((scene) => !Number.isFinite(Number(scene.startMs)) || !Number.isFinite(Number(scene.endMs)))) {
    return { ok: false, reason: "存在无效片段时间" };
  }
  const hasCaptionParents = scenes.some((scene) => scene.parentCaptionIndex != null || scene.captionIndex != null);
  if (!hasCaptionParents) {
    return { ok: false, reason: "片段缺少 parentCaptionIndex，无法证明来自字幕时间轴" };
  }

  for (let index = 0; index < captions.length; index += 1) {
    const caption = captions[index];
    const captionIndex = Number(caption.index || index + 1);
    const group = scenes
      .filter((scene) => Number(scene.parentCaptionIndex || scene.captionIndex) === captionIndex)
      .sort((a, b) => Number(a.startMs || 0) - Number(b.startMs || 0));
    if (!group.length) {
      return { ok: false, reason: `字幕 ${captionIndex} 没有对应片段` };
    }
    const startDrift = Math.abs(Number(group[0].startMs) - Number(caption.startMs));
    const endDrift = Math.abs(Number(group[group.length - 1].endMs) - Number(caption.endMs));
    if (startDrift > 2 || endDrift > 2) {
      return { ok: false, reason: `字幕 ${captionIndex} 的片段覆盖时间不一致` };
    }
  }
  return { ok: true, reason: "" };
}

function sceneToTimelineScene(scene, index) {
  const startMs = Number(scene.audioStartMs ?? Math.round((Number(scene.fromFrame || 0) / 30) * 1000));
  const endMs = Number(
    scene.audioEndMs ?? Math.round(((Number(scene.fromFrame || 0) + Number(scene.durationInFrames || 1)) / 30) * 1000),
  );
  return {
    id: scene.id || `scene-${index + 1}`,
    order: index,
    startMs,
    endMs: Math.max(endMs, startMs + 500),
    voiceText: scene.narrationText || scene.text || "",
    subtitle: scene.props?.body || scene.narrationText || scene.text || "",
    sceneType: scene.sceneType || "narration_bridge",
    templateId: scene.templateId || "NarratedScene",
    category: scene.category || "",
    visualIntent: scene.visualIntent || "",
    visualIntentData: scene.visualIntentData || {},
    semanticCard: scene.semanticCard || {},
    visualContract: scene.visualContract || {},
    visualGrounding: scene.visualGrounding || {},
    visualCandidates: scene.visualCandidates || [],
    decisionTrace: scene.decisionTrace || {},
    visualProviderId: scene.visualProviderId || scene.visualLayer?.templateId || scene.templateId,
    providerType: scene.providerType || scene.visualLayer?.providerType || "",
    keywords: scene.keywords || [],
    decisionReason: scene.decisionReason || "",
    props: scene.props || {},
    visualLayer: scene.visualLayer || { type: "template", templateId: scene.templateId || "NarratedScene" },
    evidenceNeeds: scene.evidenceNeeds || [],
    evidence: scene.evidence || {},
    captionIndex: scene.captionIndex,
    parentCaptionId: scene.parentCaptionId,
    parentCaptionIndex: scene.parentCaptionIndex,
    estimatedTiming: Boolean(scene.estimatedTiming),
    timingSource: scene.timingSource || "",
    alternatives: [],
    locked: false,
  };
}

function timelineSceneToAutoScene(scene) {
  return {
    id: scene.id,
    index: scene.order,
    text: scene.voiceText,
    sceneType: scene.sceneType,
    narrationText: scene.voiceText,
    visualIntent: scene.visualIntent,
    visualIntentData: scene.visualIntentData,
    semanticCard: scene.semanticCard,
    visualContract: scene.visualContract,
    visualGrounding: scene.visualGrounding,
    visualCandidates: scene.visualCandidates || [],
    decisionTrace: scene.decisionTrace,
    visualProviderId: scene.visualProviderId,
    providerType: scene.providerType,
    templateId: scene.templateId,
    keywords: scene.keywords || [],
    props: scene.props || {},
  };
}

function withHistory(project, type, patch, before) {
  return {
    ...project,
    history: [
      ...(project.history || []),
      {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        type,
        patch,
        snapshotBefore: before,
        createdAt: Date.now(),
      },
    ].slice(-80),
  };
}

function projectPath(id) {
  return path.join(projectsRoot, `${safeName(id)}.json`);
}

function safeName(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_.-]/g, "_");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toPublicPath(filePath) {
  if (!filePath) {
    return "";
  }
  return path.relative(path.join(projectRoot, "public"), filePath).replace(/\\/g, "/");
}

function cleanTimelineText(value) {
  return String(value || "").replace(/[\s，。！？、；：,.!?;:"“”《》\-—]/g, "");
}

function textSimilarity(a, b) {
  const left = String(a || "");
  const right = String(b || "");
  if (!left || !right) {
    return 0;
  }
  const maxLength = Math.max(left.length, right.length);
  if (maxLength > 1200) {
    return sampledSimilarity(left, right);
  }
  return 1 - levenshteinDistance(left, right) / maxLength;
}

function sampledSimilarity(a, b) {
  const left = a.slice(0, 600) + a.slice(-600);
  const right = b.slice(0, 600) + b.slice(-600);
  return 1 - levenshteinDistance(left, right) / Math.max(left.length, right.length);
}

function levenshteinDistance(a, b) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  const current = Array.from({ length: b.length + 1 }, () => 0);
  for (let i = 1; i <= a.length; i += 1) {
    current[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    for (let j = 0; j <= b.length; j += 1) {
      previous[j] = current[j];
    }
  }
  return previous[b.length];
}
