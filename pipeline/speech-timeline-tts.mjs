#!/usr/bin/env node
import { execFile } from "node:child_process";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { shouldUseDashScopeTts, synthesizeDashScopeTtsToFile } from "./dashscope-tts.mjs";
import { loadLocalEnv } from "./local-env.mjs";
import { captionsToSrt } from "./subtitle-aligner.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const generatedDir = path.join(projectRoot, "public", "generated");
const runtimeDir = path.join(projectRoot, ".runtime", "text-to-video");
const segmentDir = path.join(runtimeDir, "segments");
const rawAudioDir = path.join(runtimeDir, "raw-audio");

loadLocalEnv(projectRoot);

const defaults = {
  text: "",
  title: "speech timeline",
  language: "Chinese",
  ttsProvider: "dashscope",
  instruction: "朗读前先吃透语句内涵。语句连贯，不允许有卡顿停顿，呼吸自然，语气兼具压迫气，整体具备强烈煽动感染力。",
  rate: 0.92,
  pitch: 1.05,
  volume: 85,
  minPauseMs: 180,
  paragraphPauseMs: 520,
  maxSegmentChars: 260,
  maxCaptionChars: 30,
  resumeStamp: "",
  json: false,
};

const args = parseArgs(process.argv.slice(2));

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

async function main() {
  const input = { ...defaults, ...args };
  if (input.textFile) {
    input.text = await readFile(path.resolve(projectRoot, input.textFile), "utf8");
  }
  input.text = String(input.text || "").trim();
  if (!input.text) {
    throw new Error("缺少文本。请传入 --text 或 --text-file。");
  }

  await mkdir(generatedDir, { recursive: true });
  await mkdir(segmentDir, { recursive: true });
  await mkdir(rawAudioDir, { recursive: true });

  const stamp = input.resumeStamp ? String(input.resumeStamp) : safeStamp();
  const segments = buildSpeechSegments(input.text, input);
  shouldUseDashScopeTts(input);

  console.log(`[1/4] 正在按时间线生成千问 TTS：audioSegments=${segments.length}`);
  for (const segment of segments) {
    const file = path.join(segmentDir, `speech-${stamp}-${String(segment.index).padStart(4, "0")}.mp3`);
    if (!(await fileExists(file))) {
      await synthesizeDashScopeTtsToFile(
        {
          ...input,
          text: segment.ttsText,
          enableMarkdownFilter: true,
        },
        file,
      );
    }
    segment.rawAudioFile = file;
    segment.audioDurationMs = Math.round(await getAudioDuration(file) * 1000);
  }

  console.log("[2/4] 正在拼接段级音频...");
  const concatFile = path.join(runtimeDir, `speech-concat-${stamp}.txt`);
  const concatEntries = [];
  for (const segment of segments) {
    concatEntries.push(`file '${escapeConcatPath(segment.rawAudioFile)}'`);
    if (segment.pauseAfterMs > 0) {
      concatEntries.push(`file '${escapeConcatPath(await ensureSilenceFile(segment.pauseAfterMs))}'`);
    }
  }
  await writeFile(concatFile, `${concatEntries.join("\n")}\n`, "utf8");

  const rawAudioFile = path.join(rawAudioDir, `speech-timeline-raw-${stamp}.mp3`);
  await concatAudio(concatFile, rawAudioFile);
  const audioFile = path.join(generatedDir, `speech-timeline-${stamp}.mp3`);
  await normalizeAudioForRemotion(rawAudioFile, audioFile);

  console.log("[3/4] 正在写字幕和 manifest...");
  let cursorMs = 0;
  const captions = [];
  for (const segment of segments) {
    const segmentStartMs = cursorMs;
    const segmentCaptions = distributeCaptionsInSegment(segment.captions, segmentStartMs, segment.audioDurationMs);
    captions.push(...segmentCaptions);
    cursorMs = segmentStartMs + segment.audioDurationMs + segment.pauseAfterMs;
  }
  captions.forEach((caption, index) => {
    caption.index = index + 1;
  });

  const srtFile = path.join(generatedDir, `speech-timeline-${stamp}.srt`);
  const manifestFile = path.join(generatedDir, `speech-timeline-${stamp}.json`);
  await writeFile(srtFile, `${captionsToSrt(captions)}\n`, "utf8");
  await writeFile(
    manifestFile,
    JSON.stringify({
      version: "speech-timeline.v1",
      title: input.title,
      audioFile,
      srtFile,
      durationMs: cursorMs,
      segments,
      captions,
    }, null, 2),
    "utf8",
  );

  console.log("[4/4] 已完成。");
  writeJsonSummary(input, {
    audioFile,
    srtFile,
    manifestFile,
    durationSeconds: Math.round(cursorMs / 1000),
    segmentCount: segments.length,
  });
}

function buildSpeechSegments(text, input) {
  const sourceLines = String(text || "")
    .replace(/\r/g, "")
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const maxSegmentChars = Number(input.maxSegmentChars || 260);
  const maxCaptionChars = Number(input.maxCaptionChars || 30);

  const captions = sourceLines
    .flatMap((line) => splitLongLine(line, maxCaptionChars))
    .map(normalizeCaptionText)
    .filter(Boolean);

  const segments = [];
  let current = [];
  for (const caption of captions) {
    const next = [...current, caption];
    if (current.length && countChars(joinCaptionsForTts(next)) > maxSegmentChars) {
      segments.push(createSpeechSegment(segments.length + 1, current, input));
      current = [caption];
    } else {
      current = next;
    }
  }
  if (current.length) {
    segments.push(createSpeechSegment(segments.length + 1, current, input));
  }
  return segments;
}

function createSpeechSegment(index, captions, input) {
  const captionText = captions[captions.length - 1] || "";
  return {
    index,
    captions: captions.map((text) => ({ text })),
    ttsText: applyProsodyText(joinCaptionsForTts(captions)),
    pauseAfterMs: inferPauseAfterMs(captionText, input),
  };
}

function joinCaptionsForTts(captions) {
  return captions.join("\n");
}

function distributeCaptionsInSegment(captions, startMs, durationMs) {
  const source = captions.length ? captions : [{ text: "" }];
  const weights = source.map((caption) => Math.max(1, countChars(caption.text)));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  let cursorMs = startMs;
  return source.map((caption, index) => {
    const nextMs =
      index === source.length - 1
        ? startMs + durationMs
        : startMs + Math.round((weights.slice(0, index + 1).reduce((sum, value) => sum + value, 0) / totalWeight) * durationMs);
    const item = {
      startMs: cursorMs,
      endMs: Math.max(cursorMs + 1, nextMs),
      text: caption.text,
    };
    cursorMs = item.endMs;
    return item;
  });
}

function splitLongLine(line, maxChars) {
  const limit = Math.max(24, Number(maxChars || 70));
  if (countChars(line) <= limit) return [line];
  const parts = line.split(/(?<=[，、；。！？])/u).map((item) => item.trim()).filter(Boolean);
  const out = [];
  let current = "";
  for (const part of parts.length ? parts : [line]) {
    if (!current || countChars(`${current}${part}`) <= limit) {
      current += part;
    } else {
      out.push(current);
      current = part;
    }
  }
  if (current) out.push(current);
  return out.flatMap((item) => hardSplit(item, limit));
}

function hardSplit(text, maxChars) {
  const chars = Array.from(text);
  if (chars.length <= maxChars) return [text];
  const out = [];
  for (let index = 0; index < chars.length; index += maxChars) {
    out.push(chars.slice(index, index + maxChars).join(""));
  }
  return out;
}

function normalizeCaptionText(value) {
  return String(value || "").replace(/\s+/g, "").trim();
}

function applyProsodyText(text) {
  return text;
}

function inferPauseAfterMs(text, input) {
  const minPause = Number(input.minPauseMs || 180);
  if (/。$/.test(text)) return Math.max(minPause, 320);
  if (/[！？]$/.test(text)) return Math.max(minPause, 420);
  if (/[；]$/.test(text)) return Math.max(minPause, 260);
  if (/[，、]$/.test(text)) return Math.max(minPause, 180);
  return minPause;
}

async function ensureSilenceFile(pauseMs) {
  const rounded = Math.max(80, Math.round(Number(pauseMs || 0) / 20) * 20);
  const file = path.join(rawAudioDir, `silence-${rounded}.mp3`);
  try {
    await readFile(file);
    return file;
  } catch {
    await makeSilence(file, rounded);
    return file;
  }
}

function makeSilence(file, durationMs) {
  return new Promise((resolve, reject) => {
    execFile(
      "ffmpeg",
      ["-y", "-f", "lavfi", "-i", "anullsrc=r=44100:cl=stereo", "-t", String(durationMs / 1000), "-codec:a", "libmp3lame", "-b:a", "192k", file],
      { windowsHide: true },
      (error, _stdout, stderr) => {
        if (error) reject(new Error(stderr || error.message));
        else resolve();
      },
    );
  });
}

function concatAudio(listFile, outputFile) {
  return new Promise((resolve, reject) => {
    execFile(
      "ffmpeg",
      ["-y", "-f", "concat", "-safe", "0", "-i", listFile, "-vn", "-ac", "2", "-ar", "44100", "-codec:a", "libmp3lame", "-b:a", "192k", outputFile],
      { windowsHide: true },
      (error, _stdout, stderr) => {
        if (error) reject(new Error(stderr || error.message));
        else resolve();
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
        if (error) reject(new Error(stderr || error.message));
        else resolve();
      },
    );
  });
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

function escapeConcatPath(value) {
  return path.resolve(value).replace(/\\/g, "/").replace(/'/g, "'\\''");
}

function countChars(value) {
  return Array.from(String(value || "").replace(/\s/g, "")).length;
}

async function fileExists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function safeStamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

function writeJsonSummary(input, result) {
  if (input.json) {
    console.log(`SPEECH_TIMELINE_RESULT ${JSON.stringify(result)}`);
    return;
  }
  console.log(`音频：${result.audioFile}`);
  console.log(`字幕：${result.srtFile}`);
  console.log(`时间线：${result.manifestFile}`);
  console.log(`时长：${result.durationSeconds}s`);
  console.log(`段数：${result.segmentCount}`);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;
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
