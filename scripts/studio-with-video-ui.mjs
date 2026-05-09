#!/usr/bin/env node
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadLocalEnv } from "./local-env.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const remotionCli = path.join(projectRoot, "node_modules", "@remotion", "cli", "remotion-cli.js");

loadLocalEnv(projectRoot);

const children = [];

start("video-ui", process.execPath, [path.join(projectRoot, "scripts", "video-ui-server.mjs")]);
start("studio", process.execPath, [remotionCli, "studio", "src/index.ts", "--port=3000", "--no-open"]);
start("studio-plugin", process.execPath, [path.join(projectRoot, "scripts", "studio-plugin-proxy.mjs")]);
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

function shutdown() {
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
}
