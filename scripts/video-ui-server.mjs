#!/usr/bin/env node
import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const runtimeRoot = path.join(projectRoot, ".runtime", "text-to-video");
const jobsRoot = path.join(runtimeRoot, "jobs");
const pagePath = path.join(projectRoot, "frontend", "video-generator.html");
const pluginScriptPath = path.join(projectRoot, "frontend", "remotion-studio-plugin.js");
const port = Number(process.env.TEXT_TO_VIDEO_PORT || 3037);

const jobs = new Map();

await mkdir(jobsRoot, { recursive: true });

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
    if (req.method === "OPTIONS") {
      return sendJson(res, { success: true });
    }

    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/video-generator")) {
      return sendText(res, await readFile(pagePath, "utf8"), "text/html; charset=utf-8");
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

    if (req.method === "GET" && url.pathname.startsWith("/files/")) {
      const id = decodeURIComponent(url.pathname.slice("/files/".length));
      const job = jobs.get(id);
      if (!job?.result?.videoFile) {
        return sendJson(res, { success: false, error: "视频还没有生成完成" }, 404);
      }
      return sendFile(res, job.result.videoFile);
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
      template: String(body.template || "SinoJapaneseWarDemo").trim(),
      skipSrt: Boolean(body.skipSrt),
      theme: body.theme === "clean" ? "clean" : "historical",
    },
    logs: [],
    result: null,
    error: "",
  };
  jobs.set(id, job);
  return job;
}

function runJob(job) {
  void (async () => {
    job.status = "running";
    job.progress = "生成音频与视频中";
    job.updatedAt = Date.now();

    const textPath = path.join(jobsRoot, `${job.id}.txt`);
    const outputPath = path.join(projectRoot, "out", `text-to-video-${job.id}.mp4`);
    await writeFile(textPath, job.input.text, "utf8");

    const args = [
      path.join(projectRoot, "scripts", "text-to-video.mjs"),
      "--text-file",
      textPath,
      "--title",
      job.input.title,
      "--subtitle",
      job.input.subtitle,
      "--instruction",
      job.input.instruction,
      "--template",
      job.input.template,
      "--output",
      outputPath,
      "--theme",
      job.input.theme,
      "--json=true",
    ];
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
        job.status = "succeeded";
        job.progress = "已完成";
        job.updatedAt = Date.now();
        return;
      }
      failJob(job, `生成进程退出，code=${code}`);
    });
  })().catch((error) => failJob(job, error instanceof Error ? error.message : String(error)));
}

function handleLog(job, text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    job.logs.push(line);
    if (line.startsWith("TEXT_TO_VIDEO_RESULT ")) {
      job.result = JSON.parse(line.slice("TEXT_TO_VIDEO_RESULT ".length));
      continue;
    }
    if (line.includes("[1/5]")) job.progress = "生成旁白音频";
    if (line.includes("[2/5]")) job.progress = "读取音频时长";
    if (line.includes("[3/5]")) job.progress = "生成字幕";
    if (line.includes("[4/5]")) job.progress = "渲染视频";
    if (line.includes("[5/5]")) job.progress = "收尾";
  }
  job.logs = job.logs.slice(-80);
  job.updatedAt = Date.now();
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

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, value, statusCode = 200) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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
