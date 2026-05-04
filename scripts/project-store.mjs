import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { attachAssetsToScenes, loadAssetIndex, matchAssetsForScene } from "./asset-matcher.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(__dirname, "..");
export const projectsRoot = path.join(projectRoot, ".runtime", "video-projects");

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
  const project = {
    id: job.id,
    title: props.title || job.input?.title || "视频项目",
    audioSrc: props.audioSrc || toPublicPath(result.audioFile || ""),
    captions: props.captions || [],
    scenes: scenes.map((scene, index) => sceneToTimelineScene(scene, index)),
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
  await saveProject(project);
  return project;
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
  const scenes = project.scenes.map((scene, index) => {
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
      timingSource: "project",
      keywords: scene.keywords || [],
      decisionReason: scene.decisionReason || "",
      visualLayer: scene.visualLayer,
      props: {
        ...scene.props,
        title: scene.props?.title || scene.subtitle || scene.voiceText.slice(0, 18),
        body: scene.props?.body || scene.subtitle || scene.voiceText,
      },
    };
  });
  return {
    title: project.title,
    audioSrc: project.audioSrc,
    captions: project.captions,
    showCaptions: true,
    showSceneLabels: false,
    scenes,
  };
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
    const status = visualLayer.type === "footage" && !visualLayer.path
      ? "missing_visual"
      : confidence > 0 && confidence < 12
        ? "low_confidence"
        : scene.locked
          ? "ok"
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
      },
      visualProviderId: scene.visualProviderId || visualLayer.templateId || visualLayer.clipId || scene.templateId,
      providerType: scene.providerType || visualLayer.providerType || source,
      semanticCard: scene.semanticCard || {},
      visualContract: scene.visualContract || {},
      visualGrounding: scene.visualGrounding || {},
      visualCandidates: scene.visualCandidates || [],
      decisionTrace: scene.decisionTrace || {},
      alternatives: scene.alternatives || scene.visualCandidates || [],
      status,
      locked: Boolean(scene.locked),
      sceneType: scene.sceneType || "",
    };
  });
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
