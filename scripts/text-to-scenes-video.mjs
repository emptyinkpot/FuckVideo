#!/usr/bin/env node
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { planScenesFromCaptions, writeScenesFile } from "./scene-planner.mjs";
import { attachAssetsToScenes, loadAssetIndex } from "./asset-matcher.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const generatedDir = path.join(projectRoot, "public", "generated");

const defaults = {
  title: "自动片段视频",
  output: path.join(projectRoot, "out", "auto-scenes-video.mp4"),
  composition: "MultiSceneVideo",
  fps: 30,
  maxChars: 130,
  render: true,
  showSceneLabels: false,
  showCaptions: true,
  matchAssets: true,
  assetIndex: "public/generated/asset-index.json",
};

const args = parseArgs(process.argv.slice(2));

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

async function main() {
  const input = { ...defaults, ...args };
  if (input.noRender) {
    input.render = false;
  }
  const text = input.textFile
    ? await readFile(path.resolve(projectRoot, input.textFile), "utf8")
    : String(input.text || "");

  if (!text.trim()) {
    throw new Error("缺少文本。请传入 --text 或 --text-file。");
  }

  await mkdir(generatedDir, { recursive: true });
  await mkdir(path.dirname(path.resolve(projectRoot, input.output)), { recursive: true });

  const stamp = safeStamp();
  const scenesPath = path.join(generatedDir, `scenes-${stamp}.json`);
  const plan = await writeScenesFile({
    text,
    outputPath: scenesPath,
    options: { fps: Number(input.fps), maxChars: Number(input.maxChars) },
  });
  const captions = input.captionsFile ? parseSrt(await readFile(path.resolve(projectRoot, input.captionsFile), "utf8")) : [];
  let scenes = captions.length
    ? planScenesFromCaptions(captions, { fps: Number(input.fps), sourceText: text, maxChars: Number(input.maxChars) })
    : plan.scenes;
  assertCaptionSceneLockstep(scenes, captions);
  if (input.matchAssets !== false) {
    const assets = loadAssetIndex(input.assetIndex);
    if (assets.length) {
      scenes = attachAssetsToScenes(scenes, assets);
    }
  }
  await writeFile(scenesPath, JSON.stringify({ ...plan, scenes, totalFrames: sceneEndFrame(scenes) }, null, 2), "utf8");

  const props = {
    title: input.title,
    scenes,
    audioSrc: input.audioSrc || "",
    captions,
    showCaptions: Boolean(input.showCaptions),
    showSceneLabels: Boolean(input.showSceneLabels),
  };
  const propsPath = path.join(generatedDir, `props-scenes-${stamp}.json`);
  await writeFile(propsPath, JSON.stringify(props, null, 2), "utf8");

  console.log(`SCENES_FILE ${scenesPath}`);
  console.log(`PROPS_FILE ${propsPath}`);
  console.log(`SCENE_COUNT ${scenes.length}`);

  if (!input.render) {
    return;
  }

  await runRemotionRender(propsPath, path.resolve(projectRoot, input.output), input.composition);
  console.log(`VIDEO_FILE ${path.resolve(projectRoot, input.output)}`);
}

function runRemotionRender(propsPath, outputPath, composition) {
  const remotionBin = path.join(projectRoot, "node_modules", "@remotion", "cli", "remotion-cli.js");
  const renderArgs = ["render", "src/index.ts", composition, outputPath, `--props=${propsPath}`, "--codec=h264"];
  return new Promise((resolve, reject) => {
    const child = execFile(
      process.execPath,
      [remotionBin, ...renderArgs],
      {
        cwd: projectRoot,
        windowsHide: true,
        maxBuffer: 1024 * 1024 * 20,
      },
      (error, stdout, stderr) => {
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

function sceneEndFrame(scenes) {
  return Math.max(0, ...scenes.map((scene) => Number(scene.fromFrame || 0) + Number(scene.durationInFrames || 0)));
}

function assertCaptionSceneLockstep(scenes, captions) {
  if (!Array.isArray(captions) || captions.length === 0) {
    return;
  }
  if (scenes.length !== captions.length) {
    throw new Error(`片段数量必须等于字幕数量：scenes=${scenes.length}, captions=${captions.length}`);
  }
  for (let index = 0; index < captions.length; index += 1) {
    const scene = scenes[index];
    const caption = captions[index];
    if (Number(scene.audioStartMs) !== Number(caption.startMs) || Number(scene.audioEndMs) !== Number(caption.endMs)) {
      throw new Error(`片段 ${index + 1} 与字幕时间不一致。`);
    }
    if (!String(scene.narrationText || scene.text || "").trim()) {
      throw new Error(`片段 ${index + 1} 缺少文本。`);
    }
  }
}

function parseSrt(value) {
  return String(value || "")
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block, index) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      const timeLineIndex = lines.findIndex((line) => line.includes("-->"));
      if (timeLineIndex < 0) {
        return null;
      }
      const [startRaw, endRaw] = lines[timeLineIndex].split("-->").map((part) => part.trim());
      return {
        index: Number(lines[0]) || index + 1,
        startMs: parseSrtTime(startRaw),
        endMs: parseSrtTime(endRaw),
        text: lines.slice(timeLineIndex + 1).join(""),
      };
    })
    .filter(Boolean);
}

function parseSrtTime(value) {
  const match = String(value || "").match(/(\d+):(\d+):(\d+),(\d+)/);
  if (!match) {
    return 0;
  }
  const [, h, m, s, ms] = match.map(Number);
  return h * 3600000 + m * 60000 + s * 1000 + ms;
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) {
      continue;
    }
    const eq = arg.indexOf("=");
    const key = toCamel(eq >= 0 ? arg.slice(2, eq) : arg.slice(2));
    const rawValue =
      eq >= 0
        ? arg.slice(eq + 1)
        : index + 1 >= argv.length || argv[index + 1].startsWith("--")
          ? "true"
          : argv[++index];
    parsed[key] = rawValue === "false" ? false : rawValue === "true" ? true : rawValue;
  }
  return parsed;
}

function toCamel(value) {
  return value.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
}

function safeStamp() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}
