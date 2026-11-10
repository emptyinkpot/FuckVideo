#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "../../pipeline/local-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..", "..");
const remotionCli = path.join(projectRoot, "node_modules", "@remotion", "cli", "remotion-cli.js");

loadLocalEnv(projectRoot);

const children = [];

const videoUiReady = await isReady("http://127.0.0.1:3037/api/projects");
const pluginReady = await isReady("http://127.0.0.1:3057");

if (videoUiReady) {
  process.stdout.write("[video-ui] 已检测到 3037 服务，复用现有文本生成视频 API。\n");
} else {
  start("video-ui", process.execPath, [path.join(projectRoot, "videolab", "server", "server.mjs")]);
}
start("studio", process.execPath, [remotionCli, "studio", "src/index.ts", "--port=3000", "--no-open"]);
if (pluginReady) {
  process.stdout.write("[studio-plugin] 已检测到 3057 服务，复用现有 Remotion 工作台插件入口。\n");
} else {
  start("studio-plugin", process.execPath, [path.join(projectRoot, "videolab", "server", "studio-plugin-proxy.mjs")]);
}
setTimeout(() => {
  process.stdout.write("\n打开带生成视频扩展的 Remotion 工作台：http://127.0.0.1:3057\n\n");
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
