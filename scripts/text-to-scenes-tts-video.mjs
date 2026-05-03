#!/usr/bin/env node
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeScenesFile } from "./scene-planner.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const generatedDir = path.join(projectRoot, "public", "generated");
const rawAudioDir = path.join(projectRoot, ".runtime", "text-to-video", "raw-audio");

const defaults = {
  apiBase: "https://<private-tts-relay>/api/qwen3-tts",
  text: "旅顺港的海风吹进东京霞关，战争的尾声并没有带来平静。新的铁路和港口，正在改变东亚的权力地图。",
  title: "自动镜头文本视频",
  language: "Chinese",
  voice: "my-clone",
  instruction: "标准播音风格，吐字清晰，语速平稳，停顿自然",
  output: path.join(projectRoot, "out", "auto-scenes-tts-video.mp4"),
  skipSrt: false,
  render: true,
  json: false,
  showSceneLabels: false,
};

const myCloneVoice =
  "cosyvoice-v3.5-plus-bailian-f04eec5bf9e64f14afeefd3bb09cccfe";

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
  if (input.textFile) {
    input.text = await readFile(path.resolve(projectRoot, input.textFile), "utf8");
  }
  input.text = String(input.text || "").trim();
  if (!input.text) {
    throw new Error("缺少文本。请传入 --text 或 --text-file。");
  }

  await mkdir(generatedDir, { recursive: true });
  await mkdir(rawAudioDir, { recursive: true });
  await mkdir(path.dirname(path.resolve(projectRoot, input.output)), { recursive: true });

  const stamp = safeStamp();
  console.log("[1/6] 正在生成千问 TTS 旁白音频...");
  const tts = await generateTts(input);
  const audioUrl = absolutizeUrl(input.apiBase, tts.audio?.url);
  if (!audioUrl) {
    throw new Error("千问 TTS 没有返回 audio.url。");
  }

  const audioExt = extensionFromUrl(audioUrl) || ".wav";
  const rawAudioFile = path.join(rawAudioDir, `tts-raw-${stamp}${audioExt}`);
  await downloadToFile(audioUrl, rawAudioFile);
  const audioFile = path.join(generatedDir, `tts-${stamp}.mp3`);
  await normalizeAudioForRemotion(rawAudioFile, audioFile);
  const audioSrc = toPublicPath(audioFile);

  console.log("[2/6] 正在读取音频时长...");
  const durationSeconds = Math.max(5, Math.ceil((await getAudioDuration(audioFile)) + 1));

  let srtText = "";
  let captions = [];
  if (!input.skipSrt) {
    console.log("[3/6] 正在请求语音对齐字幕...");
    try {
      const srt = await generateSrt(input, audioUrl);
      srtText = srt.srtText || "";
      captions = parseSrt(srtText);
      if (srtText) {
        await writeFile(path.join(generatedDir, `tts-${stamp}.srt`), srtText, "utf8");
      }
    } catch (error) {
      console.warn(
        `[警告] 字幕生成失败，将继续渲染只有音频的视频：${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  } else {
    console.log("[3/6] 已按要求跳过字幕。");
  }

  console.log("[4/6] 正在规划自动镜头...");
  const scenesPath = path.join(generatedDir, `scenes-${stamp}.json`);
  const plan = await writeScenesFile({
    text: input.text,
    outputPath: scenesPath,
    options: { fps: 30, maxChars: Number(input.maxChars || 130) },
  });
  const sceneFrames = plan.scenes.reduce((sum, scene) => sum + scene.durationInFrames, 0);
  const targetFrames = Math.max(sceneFrames, Math.ceil(durationSeconds * 30));
  const scenes = stretchScenesToFrames(plan.scenes, targetFrames);

  const props = {
    title: input.title,
    scenes,
    audioSrc,
    captions,
    showCaptions: !input.skipSrt,
    showSceneLabels: Boolean(input.showSceneLabels),
  };
  const propsPath = path.join(generatedDir, `props-scenes-tts-${stamp}.json`);
  await writeFile(propsPath, JSON.stringify(props, null, 2), "utf8");

  if (!input.render) {
    console.log("[5/6] 已跳过视频渲染。");
    writeJsonSummary(input, {
      audioFile,
      srtFile: srtText ? path.join(generatedDir, `tts-${stamp}.srt`) : "",
      scenesPath,
      propsPath,
      videoFile: "",
      durationSeconds,
      sceneCount: scenes.length,
    });
    return;
  }

  console.log("[5/6] 正在渲染 Remotion 自动镜头视频...");
  await runRemotionRender(propsPath, path.resolve(projectRoot, input.output));

  console.log("[6/6] 已完成。");
  console.log(`音频：${audioFile}`);
  console.log(`镜头：${scenesPath}`);
  if (srtText) {
    console.log(`字幕：${path.join(generatedDir, `tts-${stamp}.srt`)}`);
  }
  console.log(`视频：${path.resolve(projectRoot, input.output)}`);
  writeJsonSummary(input, {
    audioFile,
    srtFile: srtText ? path.join(generatedDir, `tts-${stamp}.srt`) : "",
    scenesPath,
    propsPath,
    videoFile: path.resolve(projectRoot, input.output),
    durationSeconds,
    sceneCount: scenes.length,
  });
}

async function generateTts(input) {
  const route = countTextUnits(input.text) > 800 ? "/custom-voice/long" : "/custom-voice";
  const providerVoice = input.voice === "my-clone" ? myCloneVoice : input.voice;
  const payload = await postJson(
    `${trimSlash(input.apiBase)}${route}`,
    {
      text: input.text,
      language: input.language,
      providerVoice,
      styleInstruction: input.instruction,
    },
    "TTS 请求失败",
  );
  return payload.data || {};
}

async function generateSrt(input, audioUrl) {
  const payload = await postJson(
    `${trimSlash(input.apiBase)}/srt`,
    { audioUrl, language: input.language },
    "字幕请求失败",
  );
  return payload.data || {};
}

async function postJson(url, body, fallbackMessage) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    const plain = text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    throw new Error(`${fallbackMessage}: ${plain || `HTTP ${res.status}`}`);
  }
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`${fallbackMessage}: 返回内容不是有效 JSON`);
  }
  if (!res.ok || !payload.success) {
    throw new Error(payload.error || `${fallbackMessage}: HTTP ${res.status}`);
  }
  return payload;
}

async function downloadToFile(url, filePath) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`下载失败 ${url}: HTTP ${res.status}`);
  }
  await writeFile(filePath, Buffer.from(await res.arrayBuffer()));
}

function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    execFile(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath],
      { windowsHide: true },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
          return;
        }
        const duration = Number(stdout.trim());
        if (!Number.isFinite(duration) || duration <= 0) {
          reject(new Error(`ffprobe 返回了无效时长：${stdout.trim()}`));
          return;
        }
        resolve(duration);
      },
    );
  });
}

function normalizeAudioForRemotion(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    execFile(
      "ffmpeg",
      ["-y", "-i", inputPath, "-vn", "-ac", "2", "-ar", "44100", "-codec:a", "libmp3lame", "-b:a", "192k", outputPath],
      { windowsHide: true },
      (error, _stdout, stderr) => {
        if (error) {
          reject(new Error(stderr || error.message));
          return;
        }
        resolve();
      },
    );
  });
}

function runRemotionRender(propsPath, outputPath) {
  const remotionBin = path.join(projectRoot, "node_modules", "@remotion", "cli", "remotion-cli.js");
  const renderArgs = ["render", "src/index.ts", "MultiSceneVideo", outputPath, `--props=${propsPath}`, "--codec=h264"];
  return new Promise((resolve, reject) => {
    const child = execFile(
      process.execPath,
      [remotionBin, ...renderArgs],
      { cwd: projectRoot, windowsHide: true, maxBuffer: 1024 * 1024 * 20 },
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

function stretchScenesToFrames(scenes, targetFrames) {
  if (scenes.length === 0) {
    return scenes;
  }
  const sourceFrames = scenes.reduce((sum, scene) => sum + scene.durationInFrames, 0);
  if (sourceFrames >= targetFrames) {
    return scenes;
  }
  const ratio = targetFrames / sourceFrames;
  let cursor = 0;
  return scenes.map((scene, index) => {
    const isLast = index === scenes.length - 1;
    const durationInFrames = isLast ? targetFrames - cursor : Math.max(90, Math.round(scene.durationInFrames * ratio));
    const next = { ...scene, fromFrame: cursor, durationInFrames };
    cursor += durationInFrames;
    return next;
  });
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

function countTextUnits(value) {
  return String(value || "").replace(/\s/g, "").length;
}

function trimSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function absolutizeUrl(apiBase, value) {
  if (!value) {
    return "";
  }
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  const root = new URL(trimSlash(apiBase).replace(/\/api\/qwen3-tts$/, ""));
  return new URL(value, root).toString();
}

function extensionFromUrl(value) {
  const ext = path.extname(new URL(value).pathname);
  return ext && ext.length <= 5 ? ext : "";
}

function safeStamp() {
  return new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
}

function toPublicPath(filePath) {
  return path.relative(path.join(projectRoot, "public"), filePath).replace(/\\/g, "/");
}

function writeJsonSummary(input, summary) {
  if (!input.json) {
    return;
  }
  console.log(`TEXT_TO_VIDEO_RESULT ${JSON.stringify(summary)}`);
}
