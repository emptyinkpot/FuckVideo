/**
 * Qwen text-embedding-v3 client (OpenAI-compatible endpoint).
 * 1024-dim by default; we expose `dimensions` for callers that want to
 * downsample (Qwen v3 supports 64/128/256/512/768/1024 via the optional
 * `dimensions` parameter).
 */
import OpenAI from 'openai';

export const DEFAULT_EMBEDDING_MODEL = 'text-embedding-v3';
export const DEFAULT_EMBEDDING_DIM = 1024;

export interface EmbedderOptions {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  dimensions?: number;
}

let cached: { client: OpenAI; model: string; dimensions: number } | null = null;

export function getEmbedder(options: EmbedderOptions = {}): {
  client: OpenAI;
  model: string;
  dimensions: number;
} {
  if (cached) return cached;
  const baseURL =
    options.baseUrl ??
    process.env.QWEN_EMBEDDING_BASE_URL ??
    'https://dashscope.aliyuncs.com/compatible-mode/v1';
  const apiKey = options.apiKey ?? process.env.QWEN_EMBEDDING_API_KEY ?? process.env.DASHSCOPE_API_KEY;
  if (!apiKey) {
    throw new Error('[material-search] missing QWEN_EMBEDDING_API_KEY in .env.local');
  }
  const model = options.model ?? process.env.QWEN_EMBEDDING_MODEL ?? DEFAULT_EMBEDDING_MODEL;
  const dimensions = options.dimensions ?? DEFAULT_EMBEDDING_DIM;

  cached = {
    client: new OpenAI({ baseURL, apiKey, timeout: 60_000 }),
    model,
    dimensions,
  };
  return cached;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const { client, model, dimensions } = getEmbedder();

  // Qwen DashScope OpenAI-compat endpoint accepts up to 25 inputs per call.
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += 25) batches.push(texts.slice(i, i + 25));

  const all: number[][] = [];
  for (const batch of batches) {
    const response = await client.embeddings.create({
      model,
      input: batch,
      // OpenAI SDK's typing forbids `dimensions` for some models; cast for Qwen.
      ...({ dimensions } as { dimensions: number }),
    });
    for (const item of response.data) {
      all.push(item.embedding);
    }
  }
  return all;
}

export async function embedSingle(text: string): Promise<number[]> {
  const [vec] = await embedTexts([text]);
  if (!vec) throw new Error('[material-search] embedder returned empty vector');
  return vec;
}
