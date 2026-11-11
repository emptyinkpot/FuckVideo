/**
 * Speech timeline orchestration.
 * Library-form port of FuckVideo root pipeline/speech-timeline-tts.mjs.
 *
 * Responsibility:
 *   Given a Scene[] (text per scene), synthesize each segment via the
 *   DashScope client, optionally concat them into one MP3 (using ffmpeg
 *   if available), and emit a unified subtitle timeline.
 *
 * Stage 1 design choice: we do NOT concatenate audio. Each scene keeps its
 * own audio file and Remotion stitches them via <Sequence>+<Audio>. This
 * removes the ffmpeg dependency from the MVP critical path.
 *
 * Stage 2b can opt-in to concat by calling `concatScenesToSingleAudio()`,
 * which requires ffmpeg+ffprobe on PATH (the same prerequisite the
 * original .mjs script had).
 */
import { execFile } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Scene, TtsVoice } from '@huasheng-clone/schemas';
import { synthesize } from './client.js';
import { buildEstimatedCaptionsFromText, captionsToSrt, type Caption } from './aligner.js';

export interface SynthesizeScenesOptions {
  /** Default voice when a scene does not specify one. */
  defaultVoice?: TtsVoice;
  /** Directory to write per-scene audio + manifest. */
  outputDir?: string;
}

export interface SynthesizedScene {
  sceneId: string;
  text: string;
  audioPath: string;
  durationMs: number;
  /** Subtitles within this scene, ms relative to the scene start. */
  subtitles: Caption[];
}

export interface SynthesizedTimeline {
  scenes: SynthesizedScene[];
  totalDurationMs: number;
  /** Cumulative subtitles in absolute timeline ms (useful for one SRT). */
  globalSubtitles: Caption[];
  manifestPath: string;
  srtPath: string;
}

/**
 * Synthesize every scene's narration into its own audio file and assemble a
 * unified subtitle timeline. The Remotion worker can then mount each scene's
 * audio file via <Audio> inside the corresponding <Sequence>.
 */
export async function renderTimeline(
  scenes: Pick<Scene, 'id' | 'text'>[],
  options: SynthesizeScenesOptions = {}
): Promise<SynthesizedTimeline> {
  const outputDir = options.outputDir ?? path.join(process.cwd(), 'storage', 'tts');
  await mkdir(outputDir, { recursive: true });

  const stamp = safeStamp();
  const synthesized: SynthesizedScene[] = [];
  let cursorMs = 0;
  const globalSubtitles: Caption[] = [];

  for (const scene of scenes) {
    const audioPath = path.join(outputDir, `scene-${stamp}-${scene.id}.mp3`);

    const result = await synthesize(
      { text: scene.text, voice: options.defaultVoice ?? 'audiobook_male_1' },
      { outputPath: audioPath }
    );

    const sceneSubs = buildEstimatedCaptionsFromText(scene.text, result.durationMs / 1000);

    synthesized.push({
      sceneId: scene.id,
      text: scene.text,
      audioPath,
      durationMs: result.durationMs,
      subtitles: sceneSubs,
    });

    for (const sub of sceneSubs) {
      globalSubtitles.push({
        index: globalSubtitles.length + 1,
        startMs: cursorMs + sub.startMs,
        endMs: cursorMs + sub.endMs,
        text: sub.text,
      });
    }
    cursorMs += result.durationMs;
  }

  const srtPath = path.join(outputDir, `timeline-${stamp}.srt`);
  const manifestPath = path.join(outputDir, `timeline-${stamp}.json`);
  await writeFile(srtPath, `${captionsToSrt(globalSubtitles)}\n`, 'utf8');
  await writeFile(
    manifestPath,
    JSON.stringify(
      {
        version: 'speech-timeline.v2',
        totalDurationMs: cursorMs,
        scenes: synthesized,
        subtitles: globalSubtitles,
      },
      null,
      2
    ),
    'utf8'
  );

  return {
    scenes: synthesized,
    totalDurationMs: cursorMs,
    globalSubtitles,
    manifestPath,
    srtPath,
  };
}

/**
 * Optional Stage 2b utility — concatenate per-scene audio into one MP3.
 * Requires ffmpeg on PATH. Stage 1 pipeline doesn't call this.
 */
export async function concatScenesToSingleAudio(
  scenes: SynthesizedScene[],
  outputPath: string
): Promise<{ outputPath: string; durationMs: number }> {
  const dir = path.dirname(outputPath);
  await mkdir(dir, { recursive: true });
  const listPath = path.join(dir, `concat-${randomUUID()}.txt`);
  const lines = scenes.map((s) => `file '${escapeConcatPath(s.audioPath)}'`);
  await writeFile(listPath, `${lines.join('\n')}\n`, 'utf8');

  await runFfmpeg([
    '-y',
    '-f',
    'concat',
    '-safe',
    '0',
    '-i',
    listPath,
    '-vn',
    '-ac',
    '2',
    '-ar',
    '44100',
    '-codec:a',
    'libmp3lame',
    '-b:a',
    '192k',
    outputPath,
  ]);

  const durationMs = scenes.reduce((sum, s) => sum + s.durationMs, 0);
  return { outputPath, durationMs };
}

function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile('ffmpeg', args, { windowsHide: true }, (error, _stdout, stderr) => {
      if (error) reject(new Error(stderr || error.message));
      else resolve();
    });
  });
}

function escapeConcatPath(value: string): string {
  return path.resolve(value).replace(/\\/g, '/').replace(/'/g, "'\\''");
}

function safeStamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}
