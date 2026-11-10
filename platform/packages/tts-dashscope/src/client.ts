/**
 * DashScope CosyVoice TTS client.
 * Ported from FuckVideo root scripts/dashscope-tts.mjs and TS-ified.
 *
 * Provider: Alibaba DashScope (https://dashscope.aliyuncs.com/api-ws/v1/inference/).
 * Default model: cosyvoice-v3.5-plus. Mirrors the working voices observed in
 * huasheng's /api/innovideo/config.
 */
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import WebSocket from 'ws';
import { TtsRequestSchema, type TtsResult } from '@huasheng-clone/schemas';
import { buildEstimatedCaptionsFromText } from './aligner.js';

const DEFAULT_WS_URL = 'wss://dashscope.aliyuncs.com/api-ws/v1/inference/';
const DEFAULT_MODEL = 'cosyvoice-v3.5-plus';
const DEFAULT_FORMAT: 'mp3' | 'wav' = 'mp3';
const DEFAULT_SAMPLE_RATE = 24_000;

export interface SynthesizeOptions {
  /** Where to write the audio file. Defaults to a temp path under outputDir. */
  outputPath?: string;
  /** Directory used when outputPath is omitted (file name auto-generated). */
  outputDir?: string;
  /** Override the model. */
  model?: string;
  /** Override the WebSocket URL (rarely needed). */
  wsUrl?: string;
  /** Audio format. mp3 is the working default for Remotion. */
  format?: 'mp3' | 'wav';
  /** Sample rate in Hz. */
  sampleRate?: number;
  /** Hard timeout in ms (default 120s). */
  timeoutMs?: number;
  /** Resolved DashScope API key (overrides env). */
  apiKey?: string;
}

/**
 * Synthesize a single text segment into an audio file + estimated subtitles.
 * The audio is written to disk; the returned path is what callers persist.
 */
export async function synthesize(
  request: unknown,
  options: SynthesizeOptions = {}
): Promise<TtsResult> {
  const req = TtsRequestSchema.parse(request);

  const apiKey = options.apiKey ?? readApiKey();
  if (!apiKey) {
    throw new Error(
      '[tts-dashscope] missing DashScope API key. Set DASHSCOPE_API_KEY in .env.local.'
    );
  }

  const format = options.format ?? DEFAULT_FORMAT;
  const sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
  const model = options.model ?? process.env.DASHSCOPE_TTS_MODEL ?? DEFAULT_MODEL;

  const outputPath = await resolveOutputPath(options, format);

  const chunks = await runTtsTask({
    apiKey,
    model,
    voice: req.voice,
    text: req.text,
    format,
    sampleRate,
    wsUrl: options.wsUrl ?? process.env.DASHSCOPE_WS_URL ?? DEFAULT_WS_URL,
    timeoutMs: options.timeoutMs ?? Number(process.env.DASHSCOPE_TTS_TIMEOUT_MS ?? 120_000),
  });

  await writeFile(outputPath, Buffer.concat(chunks));

  // Estimate duration from raw audio size. For mp3 @128kbps stereo this is
  // good enough for Stage 1; Stage 2b can call ffprobe for exact ms.
  const estimatedDurationMs = Math.max(
    1000,
    Math.round((Buffer.concat(chunks).byteLength / (sampleRate * 2)) * 1000)
  );

  const subtitles = buildEstimatedCaptionsFromText(req.text, estimatedDurationMs / 1000).map(
    (caption) => ({
      startMs: caption.startMs,
      endMs: caption.endMs,
      text: caption.text,
    })
  );

  return {
    audioPath: outputPath,
    durationMs: estimatedDurationMs,
    format,
    subtitles,
  };
}

interface RunTtsTaskInput {
  apiKey: string;
  model: string;
  voice: string;
  text: string;
  format: 'mp3' | 'wav';
  sampleRate: number;
  wsUrl: string;
  timeoutMs: number;
}

function runTtsTask(input: RunTtsTaskInput): Promise<Buffer[]> {
  const taskId = randomUUID();
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    let started = false;
    let finished = false;
    const ws = new WebSocket(input.wsUrl, {
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        'X-DashScope-DataInspection': 'enable',
      },
    });

    const timer = setTimeout(() => {
      ws.close();
      reject(
        new Error(
          `[tts-dashscope] timeout — DashScope did not finish within ${Math.round(input.timeoutMs / 1000)}s`
        )
      );
    }, input.timeoutMs);

    const cleanup = () => clearTimeout(timer);
    const fail = (error: unknown) => {
      cleanup();
      reject(error instanceof Error ? error : new Error(String(error)));
    };

    ws.on('open', () => {
      ws.send(JSON.stringify(buildRunTask({ taskId, ...input })));
    });

    ws.on('message', (data: WebSocket.RawData, isBinary: boolean) => {
      if (isBinary) {
        chunks.push(Buffer.from(data as Buffer));
        return;
      }

      const message = parseJson(data);
      const event = message.header?.event as string | undefined;
      const errorCode = message.header?.error_code as string | undefined;

      if (errorCode) {
        fail(
          new Error(
            `[tts-dashscope] DashScope error: ${errorCode} ${message.header?.error_message ?? ''}`.trim()
          )
        );
        return;
      }

      if (event === 'task-started' && !started) {
        started = true;
        ws.send(JSON.stringify(buildContinueTask({ taskId, text: input.text })));
        ws.send(JSON.stringify(buildFinishTask({ taskId })));
        return;
      }

      if (event === 'task-finished') {
        finished = true;
        cleanup();
        ws.close();
        if (!chunks.length) {
          reject(new Error('[tts-dashscope] task-finished received but no audio chunks'));
          return;
        }
        resolve(chunks);
        return;
      }

      if (event === 'task-failed') {
        fail(new Error(`[tts-dashscope] task-failed: ${message.header?.error_message ?? ''}`));
      }
    });

    ws.on('error', fail);
    ws.on('close', () => {
      if (!finished) {
        cleanup();
        reject(new Error('[tts-dashscope] WebSocket closed before task finished'));
      }
    });
  });
}

function buildRunTask({
  taskId,
  model,
  voice,
  format,
  sampleRate,
}: {
  taskId: string;
  model: string;
  voice: string;
  format: string;
  sampleRate: number;
}) {
  return {
    header: { action: 'run-task', task_id: taskId, streaming: 'duplex' },
    payload: {
      task_group: 'audio',
      task: 'tts',
      function: 'SpeechSynthesizer',
      model,
      parameters: { text_type: 'PlainText', voice, format, sample_rate: sampleRate },
      input: {},
    },
  };
}

function buildContinueTask({ taskId, text }: { taskId: string; text: string }) {
  return {
    header: { action: 'continue-task', task_id: taskId, streaming: 'duplex' },
    payload: { input: { text } },
  };
}

function buildFinishTask({ taskId }: { taskId: string }) {
  return {
    header: { action: 'finish-task', task_id: taskId, streaming: 'duplex' },
    payload: { input: {} },
  };
}

function parseJson(data: WebSocket.RawData): { header?: Record<string, unknown> } {
  try {
    return JSON.parse(Buffer.from(data as Buffer).toString('utf8'));
  } catch {
    return {};
  }
}

function readApiKey(): string {
  return (
    process.env.DASHSCOPE_API_KEY ??
    process.env.QWEN3_TTS_DASHSCOPE_API_KEY ??
    process.env.ALIYUN_BAILIAN_API_KEY ??
    ''
  );
}

async function resolveOutputPath(options: SynthesizeOptions, format: string): Promise<string> {
  if (options.outputPath) {
    await mkdir(path.dirname(options.outputPath), { recursive: true });
    return options.outputPath;
  }
  const dir = options.outputDir ?? path.join(process.cwd(), 'storage', 'tts');
  await mkdir(dir, { recursive: true });
  return path.join(dir, `tts-${randomUUID()}.${format}`);
}
