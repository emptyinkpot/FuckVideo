/**
 * Script → ScenePlan pipeline.
 *
 * Strategy: cross-provider compatible prompt-and-parse with retry.
 * - We do NOT use OpenAI's `response_format: json_object` or tool calls,
 *   because sub2api routes to Claude/Qwen and provider semantics differ.
 * - Instead the prompt instructs the model to emit raw JSON; we strip
 *   stray markdown fences, parse, validate with Zod, and on failure
 *   loop the parser error back into the next attempt.
 *
 * The output is fully populated with stable scene ids, fps, aspect ratio
 * and a SHA-256 of the source script so callers can dedup.
 */
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { ScenePlanSchema, type ScenePlan } from '@huasheng-clone/schemas';
import { chatCompletion } from './sub2api-client.js';
import {
  SCRIPT_TO_SCENES_SYSTEM_PROMPT,
  buildScriptToScenesUserPrompt,
  type BuildScriptToScenesPromptInput,
} from './prompts.js';

/** Trimmed shape the LLM is asked to produce. */
const LlmSceneSchema = z.object({
  text: z.string().min(1),
  templateId: z.string().min(1),
  visualHint: z.string().optional().default(''),
  keywords: z.array(z.string()).default([]),
});
const LlmOutputSchema = z.object({
  scenes: z.array(LlmSceneSchema).min(1).max(20),
});

export interface ScriptToScenesInput
  extends Omit<BuildScriptToScenesPromptInput, 'previousError'> {
  /** Override LLM model (defaults to SUB2API_LLM_MODEL env). */
  model?: string;
  /** Max parse-retry attempts. Default 3. */
  maxAttempts?: number;
  /** Target aspect ratio recorded in the ScenePlan. */
  aspectRatio?: '16:9' | '9:16';
  /** Default duration per scene in frames (refined later by TTS). Default 150 = 5s @ 30fps. */
  defaultDurationFramesPerScene?: number;
}

export async function scriptToScenes(input: ScriptToScenesInput): Promise<ScenePlan> {
  const maxAttempts = input.maxAttempts ?? 3;
  const defaultDuration = input.defaultDurationFramesPerScene ?? 150;
  const scriptHash = createHash('sha256').update(input.script).digest('hex');

  let lastError: string | undefined;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const userPrompt = buildScriptToScenesUserPrompt({
      script: input.script,
      trackPreference: input.trackPreference,
      maxScenes: input.maxScenes,
      previousError: lastError,
    });

    let raw: string;
    try {
      raw = await chatCompletion({
        systemPrompt: SCRIPT_TO_SCENES_SYSTEM_PROMPT,
        userPrompt,
        model: input.model,
        temperature: attempt === 1 ? 0.4 : 0.2, // tighten on retry
      });
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      if (attempt === maxAttempts) {
        throw new Error(`[llm] script-to-scenes failed after ${attempt} attempts: ${lastError}`);
      }
      continue;
    }

    const parsed = tryParseLlmJson(raw);
    if (!parsed.ok) {
      lastError = parsed.error;
      continue;
    }

    return assembleScenePlan({
      llmScenes: parsed.value.scenes,
      scriptHash,
      defaultDuration,
      aspectRatio: input.aspectRatio ?? '16:9',
    });
  }

  throw new Error(`[llm] script-to-scenes failed after ${maxAttempts} attempts: ${lastError ?? 'unknown'}`);
}

interface ParseResult {
  ok: true;
  value: z.infer<typeof LlmOutputSchema>;
}
interface ParseError {
  ok: false;
  error: string;
}

function tryParseLlmJson(raw: string): ParseResult | ParseError {
  const stripped = stripCodeFences(raw).trim();
  let json: unknown;
  try {
    json = JSON.parse(stripped);
  } catch (err) {
    return { ok: false, error: `JSON parse error: ${(err as Error).message}` };
  }
  const validated = LlmOutputSchema.safeParse(json);
  if (!validated.success) {
    return { ok: false, error: validated.error.message };
  }
  return { ok: true, value: validated.data };
}

function stripCodeFences(raw: string): string {
  // Tolerate ```json … ``` wrappers even though the prompt forbids them.
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced && fenced[1]) return fenced[1];
  return raw;
}

interface AssembleInput {
  llmScenes: z.infer<typeof LlmOutputSchema>['scenes'];
  scriptHash: string;
  defaultDuration: number;
  aspectRatio: '16:9' | '9:16';
}

function assembleScenePlan(input: AssembleInput): ScenePlan {
  const scenes = input.llmScenes.map((scene, index) => ({
    id: `scene-${String(index + 1).padStart(3, '0')}`,
    text: scene.text,
    durationFrames: input.defaultDuration,
    templateId: scene.templateId,
    templateProps: {},
    visualHint: scene.visualHint,
    keywords: scene.keywords,
    matchedAssets: [],
    subtitles: [],
  }));

  const totalDurationFrames = scenes.reduce((sum, s) => sum + s.durationFrames, 0);

  return ScenePlanSchema.parse({
    scriptHash: input.scriptHash,
    scenes,
    totalDurationFrames,
    fps: 30,
    aspectRatio: input.aspectRatio,
  });
}
