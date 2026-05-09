#!/usr/bin/env node
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { shouldUseDashScopeTts, synthesizeDashScopeTtsToFile } from "./dashscope-tts.mjs";
import { loadLocalEnv } from "./local-env.mjs";
import { buildEstimatedCaptionsFromText, captionsToSrt } from "./subtitle-aligner.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const generatedDir = path.join(projectRoot, "public", "generated");
const rawAudioDir = path.join(projectRoot, ".runtime", "text-to-video", "raw-audio");
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

loadLocalEnv(projectRoot);

const defaults = {
  apiBase: "",
  text: "欢迎使用一键文本生成视频和语音系统。脚本会先生成旁白，再把音频和字幕送入 Remotion 渲染。",
  title: "一键文本生成视频和语音",
  subtitle: "Qwen TTS 旁白 + Remotion 动画渲染",
  language: "Chinese",
  voice: "my-clone",
  ttsProvider: "dashscope",
  instruction: "标准播音风格，吐字清晰，语速平稳，停顿自然",
  output: path.join(projectRoot, "out", "text-to-video.mp4"),
  composition: "GeneratedTemplateVideo",
  template: "SinoJapaneseWarDemo",
  theme: "historical",
  skipSrt: false,
  captionStyle: "typewriter",
  progressStyle: "gradient",
  captionBottom: "",
  captionLeft: "",
  captionRight: "",
  captionMinHeight: "",
  captionPaddingX: "",
  captionPaddingY: "",
  captionFontSize: "",
  captionBorderRadius: "",
  captionTextColor: "",
  captionBackgroundColor: "",
  captionFontWeight: "",
  captionLineHeight: "",
  progressBottom: "",
  progressLeft: "",
  progressRight: "",
  progressHeight: "",
  progressGap: "",
  progressPaddingX: "",
  progressLabelFontSize: "",
  progressMinSegmentWidth: "",
  render: true,
  json: false,
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

  console.log("[1/5] 正在生成千问 TTS 旁白音频...");
  const stamp = safeStamp();
  const tts = await generateTts(input, stamp);
  const audioUrl = absolutizeUrl(input.apiBase, tts.audio?.url);
  const directAudioFile = tts.audio?.filePath ? path.resolve(projectRoot, tts.audio.filePath) : "";
  if (!audioUrl && !directAudioFile) {
    throw new Error("千问 TTS 没有返回 audio.url 或本地音频文件。");
  }

  const audioExt = directAudioFile ? path.extname(directAudioFile) || ".mp3" : extensionFromUrl(audioUrl) || ".wav";
  const rawAudioFile = directAudioFile || path.join(rawAudioDir, `tts-raw-${stamp}${audioExt}`);
  if (!directAudioFile) {
    await downloadToFile(audioUrl, rawAudioFile);
  }
  const audioFile = path.join(generatedDir, `tts-${stamp}.mp3`);
  await normalizeAudioForRemotion(rawAudioFile, audioFile);
  const audioSrc = toPublicPath(audioFile);

  console.log("[2/5] 正在读取音频时长...");
  const durationSeconds = Math.max(5, Math.ceil((await getAudioDuration(audioFile)) + 1));

  let srtText = "";
  let captions = [];
  if (input.skipSrt) {
    console.log("[3/5] 已按要求跳过字幕。");
  } else {
    console.log("[3/5] 正在用原文和音频时长生成估算字幕...");
    captions = buildEstimatedCaptionsFromText(input.text, durationSeconds, {
      maxChars: Number(input.subtitleMaxChars || 22),
    });
    srtText = captionsToSrt(captions);
    if (srtText) {
      await writeFile(path.join(generatedDir, `tts-${stamp}.srt`), srtText, "utf8");
    }
  }

  const captionLayout = normalizeCaptionLayout(input);
  const progressLayout = normalizeProgressLayout(input);
  const props = {
    title: input.title,
    subtitle: input.subtitle,
    bodyText: input.text,
    templateId: input.template,
    audioSrc,
    captions,
    durationSeconds,
    showCaptions: !input.skipSrt,
    captionStyle: normalizeCaptionStyle(input.captionStyle),
    progressStyle: normalizeProgressStyle(input.progressStyle),
    captionLayout,
    progressLayout,
    ...layoutToSchemaProps(captionLayout, progressLayout),
    theme: input.theme === "clean" ? "clean" : "historical",
  };
  const propsPath = path.join(generatedDir, `props-${stamp}.json`);
  await writeFile(propsPath, JSON.stringify(props, null, 2), "utf8");

  if (!input.render) {
    console.log("[4/5] 已跳过视频渲染。");
    console.log(`参数文件：${propsPath}`);
    writeJsonSummary(input, {
      audioFile,
      srtFile: srtText ? path.join(generatedDir, `tts-${stamp}.srt`) : "",
      propsPath,
      videoFile: "",
      durationSeconds,
    });
    return;
  }

  console.log("[4/5] 正在渲染 Remotion 视频...");
  await runRemotionRender(propsPath, path.resolve(projectRoot, input.output), input.composition);

  console.log("[5/5] 已完成。");
  console.log(`音频：${audioFile}`);
  if (srtText) {
    console.log(`字幕：${path.join(generatedDir, `tts-${stamp}.srt`)}`);
  }
  console.log(`视频：${path.resolve(projectRoot, input.output)}`);
  writeJsonSummary(input, {
    audioFile,
    srtFile: srtText ? path.join(generatedDir, `tts-${stamp}.srt`) : "",
    propsPath,
    videoFile: path.resolve(projectRoot, input.output),
    durationSeconds,
  });
}

async function generateTts(input, stamp = safeStamp()) {
  const providerVoice = input.voice === "my-clone" ? myCloneVoice : input.voice;
  shouldUseDashScopeTts(input);
  console.log("[TTS] 使用 DashScope 直连接口。");
  return synthesizeDashScopeTtsToFile(
    { ...input, providerVoice },
    path.join(rawAudioDir, `tts-raw-${stamp}.mp3`),
  );
}

async function postJson(url, body, fallbackMessage) {
  const res = await fetchWithRetry(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, fallbackMessage);
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
  const res = await fetchWithRetry(url, {}, "下载音频失败");
  if (!res.ok) {
    throw new Error(`下载失败 ${url}: HTTP ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(filePath, buffer);
}

async function fetchWithRetry(url, init = {}, fallbackMessage = "请求失败") {
  const attempts = Number(process.env.TTV_FETCH_RETRIES || 3);
  let lastError = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fetch(url, init);
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await delay(1200 * attempt);
      }
    }
  }
  throw new Error(`${fallbackMessage}: ${formatFetchError(lastError, url)}`);
}

function formatFetchError(error, url) {
  const target = safeUrlLabel(url);
  const cause = error?.cause || {};
  const code = cause.code || error?.code || "";
  if (code === "UND_ERR_CONNECT_TIMEOUT") {
    return `连接 ${target} 超时。请检查网络、代理/VPN，或稍后重试 TTS 服务`;
  }
  const message = cause.message || error?.message || String(error || "未知错误");
  return `${target} ${code ? `${code}: ` : ""}${message}`;
}

function safeUrlLabel(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return String(url || "unknown-url");
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getAudioDuration(filePath) {
  return new Promise((resolve, reject) => {
    execFile(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        filePath,
      ],
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
      [
        "-y",
        "-i",
        inputPath,
        "-vn",
        "-ac",
        "2",
        "-ar",
        "44100",
        "-codec:a",
        "libmp3lame",
        "-b:a",
        "192k",
        outputPath,
      ],
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

function runRemotionRender(propsPath, outputPath, composition) {
  const remotionBin = path.join(projectRoot, "node_modules", "@remotion", "cli", "remotion-cli.js");
  const renderArgs = [
        "render",
        "src/index.ts",
        composition || "GeneratedTemplateVideo",
    outputPath,
    `--props=${propsPath}`,
    "--codec=h264",
  ];
  const command = process.execPath;
  const args = [remotionBin, ...renderArgs];
  return new Promise((resolve, reject) => {
    const child = execFile(
      command,
      args,
      {
        cwd: projectRoot,
        windowsHide: true,
        maxBuffer: 1024 * 1024 * 20,
      },
      (error, stdout, stderr) => {
        if (stdout) {
          process.stdout.write(stdout);
        }
        if (stderr) {
          process.stderr.write(stderr);
        }
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

function parseSrt(value) {
  const blocks = String(value || "")
    .replace(/\r/g, "")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks
    .map((block, index) => {
      const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
      const timeLineIndex = lines.findIndex((line) => line.includes("-->"));
      if (timeLineIndex < 0) {
        return null;
      }
      const [startRaw, endRaw] = lines[timeLineIndex].split("-->").map((part) => part.trim());
      const text = lines.slice(timeLineIndex + 1).join("");
      return {
        index: Number(lines[0]) || index + 1,
        startMs: parseSrtTime(startRaw),
        endMs: parseSrtTime(endRaw),
        text,
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

function normalizeCaptionLayout(input) {
  return {
    ...DEFAULT_CAPTION_LAYOUT,
    ...pickNumberFields(input, {
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
    ...pickStringFields(input, {
      textColor: "captionTextColor",
      backgroundColor: "captionBackgroundColor",
    }),
  };
}

function normalizeProgressLayout(input) {
  return {
    ...DEFAULT_PROGRESS_LAYOUT,
    ...pickNumberFields(input, {
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

function layoutToSchemaProps(captionLayout, progressLayout) {
  return {
    captionLeft: captionLayout.left,
    captionRight: captionLayout.right,
    captionBottom: captionLayout.bottom,
    captionMinHeight: captionLayout.minHeight,
    captionPaddingX: captionLayout.paddingX,
    captionPaddingY: captionLayout.paddingY,
    captionFontSize: captionLayout.fontSize,
    captionBorderRadius: captionLayout.borderRadius,
    captionTextColor: captionLayout.textColor,
    captionBackgroundColor: captionLayout.backgroundColor,
    captionFontWeight: captionLayout.fontWeight,
    captionLineHeight: captionLayout.lineHeight,
    progressLeft: progressLayout.left,
    progressRight: progressLayout.right,
    progressBottom: progressLayout.bottom,
    progressHeight: progressLayout.height,
    progressGap: progressLayout.gap,
    progressPaddingX: progressLayout.paddingX,
    progressLabelFontSize: progressLayout.labelFontSize,
    progressMinSegmentWidth: progressLayout.minSegmentWidth,
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
  if (!apiBase) {
    return "";
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
