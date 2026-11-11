#!/usr/bin/env node
// Starts FuckVideo (npm run dev:video, or hidden by FuckVideo.exe):
//   - Remotion Studio on :3000; the FuckVideo workbench mounts itself inside it (src/index.ts)
//   - VideoLab API on :3037 (videolab/server/server.mjs) for generation and projects
// The workbench's "关闭" button kills this process tree via POST /api/shutdown.
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "../../pipeline/local-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..", "..");
const remotionCli = path.join(projectRoot, "node_modules", "@remotion", "cli", "remotion-cli.js");

loadLocalEnv(projectRoot);

const children = [];

if (await isReady("http://127.0.0.1:3037/api/projects")) {
  process.stdout.write("[videolab] 已检测到 3037 服务，复用现有实例。\n");
} else {
  start("videolab", process.execPath, [path.join(projectRoot, "videolab", "server", "server.mjs")]);
}
if (await isReady("http://127.0.0.1:3000")) {
  process.stdout.write("[studio] 已检测到 3000 服务，复用现有 Remotion Studio。\n");
} else {
  start("studio", process.execPath, [remotionCli, "studio", "src/index.ts", "--port=3000", "--no-open"]);
}
setTimeout(() => {
  process.stdout.write("\nRemotion Studio：http://localhost:3000（右下角 FV 按钮打开 FuckVideo 工作台）\n\n");
}, 1800);

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("exit", shutdown);

function start(name, command, args) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
    // Lets video-ui-server's /api/shutdown stop this launcher and every sibling it started.
    env: { ...process.env, FUCKVIDEO_LAUNCHER_PID: String(process.pid) },
  });
  children.push(child);
  child.stdout.on("data", (chunk) => process.stdout.write(prefix(name, chunk)));
  child.stderr.on("data", (chunk) => process.stderr.write(prefix(name, chunk)));
  child.on("exit", (code) => {
    if (code && code !== 0) {
      process.stderr.write(`[${name}] 已退出，退出码 ${code}\n`);
    }
  });
}

function prefix(name, chunk) {
  return chunk
    .toString()
    .split(/\r?\n/)
    .map((line) => (line ? `[${name}] ${line}` : line))
    .join("\n");
}

async function isReady(url) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 900);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    return response.ok;
  } catch {
    return false;
  }
}

function shutdown() {
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
}
