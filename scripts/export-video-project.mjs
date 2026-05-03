#!/usr/bin/env node
import { execFile } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadProject, projectRoot, projectToMultiSceneProps, saveProject } from "./project-store.mjs";

const args = parseArgs(process.argv.slice(2));

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

async function main() {
  const id = String(args.project || args.id || "").trim();
  if (!id) {
    throw new Error("缺少 --project=<id>");
  }
  const project = await loadProject(id);
  if (!project) {
    throw new Error(`项目不存在：${id}`);
  }
  const output = path.resolve(projectRoot, args.output || path.join("out", `video-project-${id}.mp4`));
  const propsPath = path.resolve(projectRoot, "public", "generated", `props-project-${safeStamp()}.json`);
  await mkdir(path.dirname(output), { recursive: true });
  await mkdir(path.dirname(propsPath), { recursive: true });
  await writeFile(propsPath, JSON.stringify(projectToMultiSceneProps(project), null, 2), "utf8");
  await render(propsPath, output);
  const next = {
    ...project,
    source: {
      ...project.source,
      propsPath,
      videoFile: output,
      exportedAt: Date.now(),
    },
  };
  await saveProject(next);
  console.log(`PROJECT_VIDEO ${output}`);
  console.log(`PROJECT_PROPS ${propsPath}`);
}

function render(propsPath, outputPath) {
  const remotionBin = path.join(projectRoot, "node_modules", "@remotion", "cli", "remotion-cli.js");
  return new Promise((resolve, reject) => {
    const child = execFile(
      process.execPath,
      [remotionBin, "render", "src/index.ts", "MultiSceneVideo", outputPath, `--props=${propsPath}`, "--codec=h264"],
      { cwd: projectRoot, windowsHide: true, maxBuffer: 1024 * 1024 * 30 },
      (error) => {
        if (error) {
          reject(new Error(error.message));
          return;
        }
        resolve();
      },
    );
    child.stdout?.pipe(process.stdout);
    child.stderr?.pipe(process.stderr);
  });
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    const key = eq >= 0 ? arg.slice(2, eq) : arg.slice(2);
    const rawValue =
      eq >= 0
        ? arg.slice(eq + 1)
        : index + 1 >= argv.length || argv[index + 1].startsWith("--")
          ? "true"
          : argv[++index];
    parsed[key] = rawValue;
  }
  return parsed;
}

function safeStamp() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}
