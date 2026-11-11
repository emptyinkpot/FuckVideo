#!/usr/bin/env node
// Starts the whole FuckVideo workbench (npm run dev:video, or hidden by FuckVideo.exe):
//   - VideoLab server + UI on :3037 (videolab/server/server.mjs)
//   - stock Remotion Studio on :3000, nothing injected into it
// The VideoLab "关闭" button kills this process tree via POST /api/shutdown.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "../../pipeline/local-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..", "..");
const remotionCli = path.join(projectRoot, "node_modules", "@remotion", "cli", "remotion-cli.js");
const viteCli = path.join(projectRoot, "node_modules", "vite", "bin", "vite.js");
const uiDir = path.join(projectRoot, "videolab", "ui");

loadLocalEnv(projectRoot);
buildUiIfStale();

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
  process.stdout.write("\nVideoLab：http://127.0.0.1:3037\nRemotion Studio（原版）：http://localhost:3000\n\n");
}, 1800);

// Rebuild videolab/ui/dist when it is missing or older than any UI source file / the compositions.
function buildUiIfStale() {
  const distIndex = path.join(uiDir, "dist", "index.html");
  const builtAt = existsSync(distIndex) ? statSync(distIndex).mtimeMs : 0;
  const newest = Math.max(
    newestMtime(path.join(uiDir, "src")),
    newestMtime(path.join(projectRoot, "src")),
    statSync(path.join(projectRoot, "package-lock.json")).mtimeMs,
  );
  if (builtAt >= newest) return;
  process.stdout.write("[videolab] 构建界面中…\n");
  const result = spawnSync(process.execPath, [viteCli, "build", "--logLevel", "warn"], { cwd: uiDir, stdio: "inherit", windowsHide: true });
  if (result.status !== 0) process.stderr.write("[videolab] 界面构建失败，继续使用旧版本。\n");
}

function newestMtime(dir) {
  let newest = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "generated") continue;
    const full = path.join(dir, entry.name);
    newest = Math.max(newest, entry.isDirectory() ? newestMtime(full) : statSync(full).mtimeMs);
  }
  return newest;
}

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
