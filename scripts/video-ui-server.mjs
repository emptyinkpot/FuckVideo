#!/usr/bin/env node
import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createBlankProject,
  createProjectFromJob,
  listProjects,
  loadProject,
  patchEvidence,
  patchProjectInfrastructure,
  patchScene,
  projectToMultiSceneProps,
  projectToSegments,
  projectToTracks,
  repairProjectTimeline,
  rematchScene,
  reorderScenes,
  replaceSceneMaterial,
  saveProject,
  setSceneLocked,
} from "./project-store.mjs";
import { extractEvidenceNeedsForProject, extractEvidenceNeedsForScene, resolveEvidenceForProject } from "./evidence-resolver.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const runtimeRoot = path.join(projectRoot, ".runtime", "text-to-video");
const jobsRoot = path.join(runtimeRoot, "jobs");
const pagePath = path.join(projectRoot, "frontend", "video-generator.html");
const projectPagePath = path.join(projectRoot, "frontend", "video-project.html");
const pluginScriptPath = path.join(projectRoot, "frontend", "remotion-studio-plugin.js");
const currentStudioPropsPath = path.join(projectRoot, "src", "generated", "currentMultiSceneDefaultProps.ts");
const port = Number(process.env.TEXT_TO_VIDEO_PORT || 3037);
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

const jobs = new Map();

await mkdir(jobsRoot, { recursive: true });

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
    if (req.method === "OPTIONS") {
      return sendJson(res, { success: true });
    }

    if (req.method === "POST" && url.pathname === "/api/shutdown") {
      // Only the local workbench pages may stop the services; other sites the browser
      // visits could otherwise POST here, since every response allows any origin.
      const origin = req.headers.origin;
      if (origin && !shutdownOrigins.has(origin)) {
        return sendJson(res, { success: false, error: "不允许的来源" }, 403);
      }
      sendJson(res, { success: true });
      setTimeout(shutdownAllServices, 300);
      return;
    }

    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/video-generator")) {
      return sendText(res, await readFile(pagePath, "utf8"), "text/html; charset=utf-8");
    }

    if (req.method === "GET" && url.pathname.startsWith("/video-project/")) {
      return sendText(res, await readFile(projectPagePath, "utf8"), "text/html; charset=utf-8");
    }

    if (req.method === "GET" && url.pathname === "/studio-plugin.js") {
      return sendText(res, await readFile(pluginScriptPath, "utf8"), "application/javascript; charset=utf-8");
    }

    if (req.method === "POST" && url.pathname === "/api/jobs") {
      const body = await readJson(req);
      const job = createJob(body);
      runJob(job);
      return sendJson(res, { success: true, data: publicJob(job) });
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/jobs/")) {
      const id = decodeURIComponent(url.pathname.slice("/api/jobs/".length));
      const job = jobs.get(id);
      if (!job) {
        return sendJson(res, { success: false, error: "任务不存在" }, 404);
      }
      return sendJson(res, { success: true, data: publicJob(job) });
    }

    if (req.method === "GET" && url.pathname === "/api/projects") {
      return sendJson(res, { success: true, data: await listProjects() });
    }

    if (req.method === "POST" && url.pathname === "/api/projects") {
      const body = await readJson(req);
      const project = await createBlankProject(body);
      return sendJson(res, { success: true, data: publicProject(project) });
    }

    if (url.pathname.startsWith("/api/projects/")) {
      return handleProjectApi(req, res, url);
    }

    if (req.method === "GET" && url.pathname.startsWith("/files/")) {
      const id = decodeURIComponent(url.pathname.slice("/files/".length));
      const job = jobs.get(id);
      if (!job?.result?.videoFile) {
        return sendJson(res, { success: false, error: "视频还没有生成完成" }, 404);
      }
      return sendFile(res, job.result.videoFile);
    }

    if (req.method === "GET" && url.pathname.startsWith("/project-files/")) {
      const id = decodeURIComponent(url.pathname.slice("/project-files/".length));
      const project = await loadProject(id);
      if (!project?.source?.videoFile) {
        return sendJson(res, { success: false, error: "项目视频还没有导出" }, 404);
      }
      return sendFile(res, project.source.videoFile);
    }

    return sendJson(res, { success: false, error: "路径不存在" }, 404);
  } catch (error) {
    return sendJson(res, { success: false, error: error instanceof Error ? error.message : String(error) }, 500);
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`文本生成视频页面：http://127.0.0.1:${port}/video-generator`);
});

function createJob(body) {
  const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const text = String(body.text || "").trim();
  if (!text) {
    throw new Error("请输入文本");
  }
  const job = {
    id,
    status: "queued",
    progress: "排队中",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    input: {
      text,
      title: String(body.title || "一键文本生成视频和语音").trim(),
      subtitle: String(body.subtitle || "Qwen TTS 旁白 + Remotion 动画渲染").trim(),
      instruction: String(body.instruction || "标准播音风格，吐字清晰，语速平稳，停顿自然").trim(),
      mode: body.mode === "single-template" ? "single-template" : "auto-scenes",
      template: String(body.template || "SinoJapaneseWarDemo").trim(),
      skipSrt: Boolean(body.skipSrt),
      captionStyle: normalizeCaptionStyle(body.captionStyle),
      progressStyle: normalizeProgressStyle(body.progressStyle),
      captionLayout: normalizeCaptionLayout(body),
      progressLayout: normalizeProgressLayout(body),
      theme: body.theme === "clean" ? "clean" : "historical",
    },
    logs: [],
    result: null,
    error: "",
  };
  jobs.set(id, job);
  return job;
}

async function handleProjectApi(req, res, url) {
  const parts = url.pathname.split("/").filter(Boolean);
  const id = decodeURIComponent(parts[2] || "");
  let project = await loadProject(id);
  if (!project) {
    return sendJson(res, { success: false, error: "项目不存在" }, 404);
  }
  const repaired = repairProjectTimeline(project);
  if (repaired.changed) {
    project = await saveProject(repaired.project);
  } else {
    project = repaired.project;
  }

  if (req.method === "GET" && parts.length === 3) {
    return sendJson(res, { success: true, data: publicProject(project) });
  }

  if (req.method === "GET" && parts.length === 4 && parts[3] === "props") {
    return sendJson(res, { success: true, data: projectToMultiSceneProps(project) });
  }

  if (req.method === "POST" && parts.length === 4 && parts[3] === "studio-default-props") {
    const props = projectToMultiSceneProps(project);
    await writeCurrentStudioDefaultProps(props);
    return sendJson(res, { success: true, data: props });
  }

  if (req.method === "POST" && parts.length === 5 && parts[3] === "evidence" && parts[4] === "extract") {
    return sendJson(res, { success: true, data: { needs: extractEvidenceNeedsForProject(project) } });
  }

  if (req.method === "POST" && parts.length === 5 && parts[3] === "evidence" && parts[4] === "resolve") {
    const body = await readJson(req);
    const next = await saveProject(await resolveEvidenceForProject(project, { fetchRemote: body.fetchRemote !== false }));
    return sendJson(res, { success: true, data: publicProject(next) });
  }

  if (req.method === "GET" && parts.length === 6 && parts[3] === "segments" && parts[5] === "evidence") {
    const sceneId = decodeURIComponent(parts[4]);
    const scene = project.scenes?.find((item) => item.id === sceneId);
    if (!scene) return sendJson(res, { success: false, error: "片段不存在" }, 404);
    return sendJson(res, {
      success: true,
      data: {
        needs: scene.evidenceNeeds?.length ? scene.evidenceNeeds : extractEvidenceNeedsForScene(scene),
        evidence: scene.evidence || null,
      },
    });
  }

  if (req.method === "PATCH" && parts.length === 6 && parts[3] === "segments" && parts[5] === "evidence") {
    const sceneId = decodeURIComponent(parts[4]);
    const body = await readJson(req);
    const next = await saveProject(patchEvidence(project, sceneId, body.patch || body));
    return sendJson(res, { success: true, data: publicProject(next) });
  }

  if (req.method === "PATCH" && parts.length === 4 && parts[3] === "infrastructure") {
    const body = await readJson(req);
    const next = await saveProject(patchProjectInfrastructure(project, body.patch || body));
    return sendJson(res, { success: true, data: publicProject(next) });
  }

  if (req.method === "PATCH" && parts.length === 5 && (parts[3] === "scenes" || parts[3] === "segments")) {
    const sceneId = decodeURIComponent(parts[4]);
    const body = await readJson(req);
    const next = await saveProject(patchScene(project, sceneId, body.patch || body));
    return sendJson(res, { success: true, data: publicProject(next) });
  }

  if (req.method === "POST" && parts.length === 6 && (parts[3] === "scenes" || parts[3] === "segments") && parts[5] === "lock") {
    const sceneId = decodeURIComponent(parts[4]);
    const body = await readJson(req);
    const next = await saveProject(setSceneLocked(project, sceneId, body.locked));
    return sendJson(res, { success: true, data: publicProject(next) });
  }

  if (req.method === "POST" && parts.length === 6 && (parts[3] === "scenes" || parts[3] === "segments") && (parts[5] === "rematch-material" || parts[5] === "rematch-visual")) {
    const sceneId = decodeURIComponent(parts[4]);
    return sendJson(res, { success: true, data: { candidates: rematchScene(project, sceneId) } });
  }

  if (req.method === "POST" && parts.length === 6 && (parts[3] === "scenes" || parts[3] === "segments") && (parts[5] === "replace-material" || parts[5] === "replace-visual")) {
    const sceneId = decodeURIComponent(parts[4]);
    const body = await readJson(req);
    const next = await saveProject(replaceSceneMaterial(project, sceneId, body.candidate || body));
    return sendJson(res, { success: true, data: publicProject(next) });
  }

  if (req.method === "POST" && parts.length === 4 && parts[3] === "reorder") {
    const body = await readJson(req);
    const next = await saveProject(reorderScenes(project, body.sceneIds || []));
    return sendJson(res, { success: true, data: publicProject(next) });
  }

  if (req.method === "POST" && parts.length === 4 && parts[3] === "export") {
    return exportProject(req, res, project);
  }

  return sendJson(res, { success: false, error: "项目接口不存在" }, 404);
}

function runJob(job) {
  void (async () => {
    job.status = "running";
    job.progress = "生成音频与视频中";
    job.updatedAt = Date.now();

    const textPath = path.join(jobsRoot, `${job.id}.txt`);
    const outputPath = path.join(projectRoot, "out", `text-to-video-${job.id}.mp4`);
    await writeFile(textPath, job.input.text, "utf8");

    const isAutoScenes = job.input.mode === "auto-scenes";
    const script = isAutoScenes ? "text-to-scenes-tts-video.mjs" : "text-to-video.mjs";
    const args = [
      path.join(projectRoot, "scripts", script),
      "--text-file",
      textPath,
      "--title",
      job.input.title,
      "--instruction",
      job.input.instruction,
      "--caption-style",
      job.input.captionStyle,
      "--progress-style",
      job.input.progressStyle,
      ...layoutArgs(job.input.captionLayout, "caption"),
      ...layoutArgs(job.input.progressLayout, "progress"),
      "--output",
      outputPath,
      "--json=true",
    ];
    if (!isAutoScenes) {
      args.push("--subtitle", job.input.subtitle, "--template", job.input.template, "--theme", job.input.theme);
    }
    if (job.input.skipSrt) {
      args.push("--skip-srt=true");
    }

    const child = execFile(process.execPath, args, {
      cwd: projectRoot,
      windowsHide: true,
      maxBuffer: 1024 * 1024 * 50,
    });

    child.stdout?.on("data", (chunk) => handleLog(job, chunk.toString()));
    child.stderr?.on("data", (chunk) => handleLog(job, chunk.toString()));
    child.on("error", (error) => failJob(job, error.message));
    child.on("exit", (code) => {
      if (code === 0 && job.result?.videoFile) {
        void completeJob(job);
        return;
      }
      failJob(job, job.lastErrorLine || `生成进程退出，code=${code}`);
    });
  })().catch((error) => failJob(job, error instanceof Error ? error.message : String(error)));
}

async function writeCurrentStudioDefaultProps(props) {
  await mkdir(path.dirname(currentStudioPropsPath), { recursive: true });
  const defaultProps = { ...props };
  delete defaultProps.captionLayout;
  delete defaultProps.progressLayout;
  if (!Array.isArray(defaultProps.scenes) || defaultProps.scenes.length === 0) {
    delete defaultProps.scenes;
  }
  const source = [
    'import type {MultiSceneVideoProps} from "../templates/MultiSceneVideo";',
    "",
    `export const currentMultiSceneDefaultProps = ${JSON.stringify(defaultProps, null, 2)} as unknown as Partial<MultiSceneVideoProps>;`,
    "",
  ].join("\n");
  await writeFile(currentStudioPropsPath, source, "utf8");
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

function normalizeCaptionLayout(input = {}) {
  return {
    ...DEFAULT_CAPTION_LAYOUT,
    ...pickNumberFields(input.captionLayout || input, {
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
    ...pickStringFields(input.captionLayout || input, {
      textColor: "captionTextColor",
      backgroundColor: "captionBackgroundColor",
    }),
  };
}

function normalizeProgressLayout(input = {}) {
  return {
    ...DEFAULT_PROGRESS_LAYOUT,
    ...pickNumberFields(input.progressLayout || input, {
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

function layoutArgs(layout, prefix) {
  const args = [];
  for (const [key, value] of Object.entries(layout || {})) {
    if (Number.isFinite(Number(value)) || (typeof value === "string" && value.trim())) {
      args.push(`--${prefix}-${kebab(key)}`, String(value));
    }
  }
  return args;
}

function kebab(value) {
  return String(value).replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`);
}

async function completeJob(job) {
  try {
    const project = await createProjectFromJob(job);
    job.result = {
      ...job.result,
      projectId: project.id,
      projectUrl: `/video-project/${encodeURIComponent(project.id)}`,
    };
    job.status = "succeeded";
    job.progress = "已完成";
    job.updatedAt = Date.now();
    scheduleEvidenceResolve(project.id);
  } catch (error) {
    failJob(job, `项目创建失败：${error instanceof Error ? error.message : String(error)}`);
  }
}

function scheduleEvidenceResolve(projectId) {
  setTimeout(() => {
    resolveEvidenceForCompletedProject(projectId).catch((error) => {
      console.error(`[evidence] 项目 ${projectId} 后台解析失败：${error instanceof Error ? error.message : String(error)}`);
    });
  }, 0);
}

async function resolveEvidenceForCompletedProject(projectId) {
  const project = await loadProject(projectId);
  if (!project) return;
  await saveProject({
    ...project,
    evidence: {
      ...(project.evidence || {}),
      status: "resolving",
      startedAt: Date.now(),
    },
  });

  try {
    const current = (await loadProject(projectId)) || project;
    const resolved = await resolveEvidenceForProject(current);
    await saveProject({
      ...resolved,
      evidence: {
        ...(resolved.evidence || {}),
        status: "resolved",
        resolvedAt: Date.now(),
      },
    });
  } catch (error) {
    const current = (await loadProject(projectId)) || project;
    await saveProject({
      ...current,
      evidence: {
        ...(current.evidence || {}),
        status: "resolve_failed",
        error: error instanceof Error ? error.message : String(error),
        resolvedAt: Date.now(),
      },
    });
  }
}

function handleLog(job, text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    job.logs.push(line);
    if (isLikelyErrorLine(line)) {
      job.lastErrorLine = line;
    }
    if (line.startsWith("TEXT_TO_VIDEO_RESULT ")) {
      job.result = JSON.parse(line.slice("TEXT_TO_VIDEO_RESULT ".length));
      continue;
    }
    if (line.includes("[1/5]") || line.includes("[1/6]")) job.progress = "生成旁白音频";
    if (line.includes("[2/5]") || line.includes("[2/6]")) job.progress = "读取音频时长";
    if (line.includes("[3/5]") || line.includes("[3/6]")) job.progress = "生成字幕";
    if (line.includes("[4/6]")) job.progress = "规划自动片段";
    if (line.includes("[4/5]") || line.includes("[5/6]")) job.progress = "渲染视频";
    if (line.includes("[5/5]") || line.includes("[6/6]")) job.progress = "收尾";
  }
  job.logs = job.logs.slice(-80);
  job.updatedAt = Date.now();
}

function isLikelyErrorLine(line) {
  return /失败|错误|fetch failed|超时|timeout|ECONN|UND_ERR|ENOTFOUND|EAI_AGAIN|请求/.test(String(line || ""));
}

function failJob(job, message) {
  job.status = "failed";
  job.progress = "失败";
  job.error = message;
  job.updatedAt = Date.now();
}

function publicJob(job) {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    input: job.input,
    logs: job.logs,
    result: job.result
      ? {
          ...job.result,
          videoUrl: `/files/${encodeURIComponent(job.id)}`,
        }
      : null,
    error: job.error,
  };
}

function publicProject(project) {
  const tracks = projectToTracks(project);
  const segments = projectToSegments(project);
  const durationMs = Math.max(0, ...tracks.flatMap((track) => track.clips.map((clip) => Number(clip.endMs || 0))));
  return {
    ...project,
    durationMs,
    segments,
    tracks,
    videoUrl: project.source?.videoFile ? `/project-files/${encodeURIComponent(project.id)}` : project.source?.videoUrl || "",
  };
}

function exportProject(req, res, project) {
  const outputPath = path.join(projectRoot, "out", `video-project-${project.id}-${Date.now()}.mp4`);
  const child = execFile(
    process.execPath,
    [path.join(projectRoot, "scripts", "export-video-project.mjs"), "--project", project.id, "--output", outputPath],
    { cwd: projectRoot, windowsHide: true, maxBuffer: 1024 * 1024 * 50 },
  );
  let output = "";
  child.stdout?.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr?.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.on("error", (error) => {
    sendJson(res, { success: false, error: error.message }, 500);
  });
  child.on("exit", async (code) => {
    if (code !== 0) {
      sendJson(res, { success: false, error: output || `导出失败，code=${code}` }, 500);
      return;
    }
    const next = await loadProject(project.id);
    sendJson(res, { success: true, data: publicProject(next || project) });
  });
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

const shutdownOrigins = new Set(
  [3000, 3037, 3057].flatMap((p) => [`http://127.0.0.1:${p}`, `http://localhost:${p}`]),
);

// Started by studio-with-video-ui.mjs (npm run dev:video / FuckVideo.exe): kill the
// launcher's whole process tree (studio, plugin proxy, this server). Started alone:
// just exit this server.
function shutdownAllServices() {
  console.log("收到关闭请求，正在停止所有服务。");
  const launcherPid = Number(process.env.FUCKVIDEO_LAUNCHER_PID);
  if (!launcherPid) {
    process.exit(0);
  }
  if (process.platform === "win32") {
    execFile("taskkill", ["/PID", String(launcherPid), "/T", "/F"], { windowsHide: true }, () => process.exit(0));
  } else {
    try {
      process.kill(launcherPid, "SIGTERM");
    } finally {
      process.exit(0);
    }
  }
}

function sendJson(res, value, statusCode = 200) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, PUT, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  });
  res.end(JSON.stringify(value));
}

function sendText(res, value, contentType) {
  res.writeHead(200, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(value);
}

async function sendFile(res, filePath) {
  const info = await stat(filePath);
  res.writeHead(200, {
    "Content-Type": "video/mp4",
    "Content-Length": info.size,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  });
  createReadStream(filePath).pipe(res);
}
