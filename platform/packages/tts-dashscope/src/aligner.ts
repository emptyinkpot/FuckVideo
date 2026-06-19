/**
 * Subtitle alignment helpers — ported verbatim from
 * remotion-project/scripts/subtitle-aligner.mjs (zero external deps).
 *
 * Two responsibilities:
 *   1. Given a script + estimated TTS duration, slice it into evenly-weighted
 *      subtitle chunks (smart sentence/comma split + hard char cap fallback).
 *   2. Format chunks as SRT.
 */

export interface Caption {
  index?: number;
  startMs: number;
  endMs: number;
  text: string;
}

export interface BuildCaptionsOptions {
  maxChars?: number;
}

export function buildEstimatedCaptionsFromText(
  text: string,
  durationSeconds: number,
  options: BuildCaptionsOptions = {}
): Caption[] {
  const chunks = splitSubtitleChunks(text, { maxChars: Number(options.maxChars ?? 22) });
  const totalMs = Math.max(1000, Math.round(Number(durationSeconds || 0) * 1000));
  if (!chunks.length) return [];

  const weights = chunks.map((chunk) => Math.max(1, countTextUnits(chunk)));
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  let cursor = 0;

  return chunks.map((chunk, index) => {
    const startMs = cursor;
    const nextCursor =
      index === chunks.length - 1
        ? totalMs
        : Math.round(
            (weights.slice(0, index + 1).reduce((sum, value) => sum + value, 0) / totalWeight) *
              totalMs
          );
    cursor = Math.max(startMs + 1, nextCursor);
    return { index: index + 1, startMs, endMs: cursor, text: chunk };
  });
}

export function captionsToSrt(captions: Caption[]): string {
  return captions
    .map((caption, index) =>
      [
        String(caption.index ?? index + 1),
        `${formatSrtTime(caption.startMs)} --> ${formatSrtTime(caption.endMs)}`,
        caption.text,
      ].join('\n')
    )
    .join('\n\n');
}

/** Stub kept for back-compat with the @huasheng-clone/tts-dashscope barrel. */
export function alignSubtitles(text: string, durationMs: number): Caption[] {
  return buildEstimatedCaptionsFromText(text, durationMs / 1000);
}

function splitSubtitleChunks(text: string, options: { maxChars?: number } = {}): string[] {
  const maxChars = Math.max(10, Number(options.maxChars ?? 22));
  const normalized = String(text || '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return [];

  const sentences = normalized
    .split(/(?<=[。！？!?；;])\s*/g)
    .map((part) => part.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  for (const sentence of sentences.length ? sentences : [normalized]) {
    if (countTextUnits(sentence) <= maxChars) {
      chunks.push(sentence);
      continue;
    }
    chunks.push(...splitLongSentence(sentence, maxChars));
  }
  return chunks;
}

function splitLongSentence(sentence: string, maxChars: number): string[] {
  const parts = sentence
    .split(/(?<=[，、,:：])\s*/g)
    .map((part) => part.trim())
    .filter(Boolean);
  const chunks: string[] = [];
  let current = '';
  for (const part of parts.length ? parts : [sentence]) {
    if (!current) {
      current = part;
      continue;
    }
    if (countTextUnits(current + part) <= maxChars) {
      current += part;
    } else {
      chunks.push(current);
      current = part;
    }
  }
  if (current) chunks.push(current);
  return chunks.flatMap((chunk) => hardSplitByChars(chunk, maxChars));
}

function hardSplitByChars(text: string, maxChars: number): string[] {
  const chars = Array.from(text);
  if (chars.length <= maxChars) return [text];
  const out: string[] = [];
  for (let index = 0; index < chars.length; index += maxChars) {
    out.push(chars.slice(index, index + maxChars).join(''));
  }
  return out;
}

function countTextUnits(value: string): number {
  return Array.from(String(value || '').replace(/\s/g, '')).length;
}

function formatSrtTime(value: number): string {
  const total = Math.max(0, Math.round(Number(value || 0)));
  const ms = total % 1000;
  const secondsTotal = Math.floor(total / 1000);
  const s = secondsTotal % 60;
  const minutesTotal = Math.floor(secondsTotal / 60);
  const m = minutesTotal % 60;
  const h = Math.floor(minutesTotal / 60);
  return `${pad(h)}:${pad(m)}:${pad(s)},${String(ms).padStart(3, '0')}`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}
