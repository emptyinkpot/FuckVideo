/**
 * Thin OpenAI-compatible client targeted at the local sub2api gateway.
 * sub2api proxies Claude / Qwen / others behind one OpenAI chat-completions
 * shape, so a single openai-sdk instance covers every backend we use.
 */
import OpenAI from 'openai';

export interface Sub2ApiClientOptions {
  baseUrl?: string;
  apiKey?: string;
  defaultModel?: string;
}

let cached: { client: OpenAI; defaultModel: string } | null = null;

export function getLlmClient(options: Sub2ApiClientOptions = {}): {
  client: OpenAI;
  defaultModel: string;
} {
  if (cached) return cached;

  const baseURL = options.baseUrl ?? process.env.SUB2API_BASE_URL;
  const apiKey = options.apiKey ?? process.env.SUB2API_KEY;
  const defaultModel =
    options.defaultModel ?? process.env.SUB2API_LLM_MODEL ?? 'claude-sonnet-4-6';

  if (!baseURL) {
    throw new Error('[llm] missing SUB2API_BASE_URL — set it in .env.local');
  }
  if (!apiKey) {
    throw new Error('[llm] missing SUB2API_KEY — set it in .env.local');
  }

  const client = new OpenAI({
    baseURL: baseURL.endsWith('/v1') ? baseURL : `${baseURL.replace(/\/$/, '')}/v1`,
    apiKey,
    timeout: Number(process.env.SUB2API_TIMEOUT_MS ?? 120_000),
  });

  cached = { client, defaultModel };
  return cached;
}

export interface ChatCompletionInput {
  systemPrompt: string;
  userPrompt: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Single-turn chat completion. Returns the assistant's raw text.
 * Caller is responsible for parsing structured outputs (we don't rely on
 * provider-specific tool/JSON modes — see script-to-scenes for the
 * cross-provider parse-and-retry strategy).
 */
export async function chatCompletion(input: ChatCompletionInput): Promise<string> {
  const { client, defaultModel } = getLlmClient();
  const response = await client.chat.completions.create({
    model: input.model ?? defaultModel,
    temperature: input.temperature ?? 0.4,
    max_tokens: input.maxTokens ?? 4096,
    messages: [
      { role: 'system', content: input.systemPrompt },
      { role: 'user', content: input.userPrompt },
    ],
  });

  const text = response.choices[0]?.message?.content;
  if (!text) {
    throw new Error('[llm] chat completion returned empty content');
  }
  return text;
}
