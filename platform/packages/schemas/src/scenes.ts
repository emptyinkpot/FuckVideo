import { z } from 'zod';

/**
 * A Scene is the minimal unit produced by the LLM script-to-scenes pipeline.
 * Each scene becomes one Sequence inside a MultiSceneVideo composition.
 *
 * Modeled after huasheng's default_script structure (4-segment paragraph swap),
 * confirmed via /api/innovideo/config response on 2026-06-19.
 */
export const SceneSchema = z.object({
  id: z.string().min(1).describe('Stable scene id, e.g. "scene-001"'),
  text: z.string().min(1).max(2000).describe('Narration text for this scene (one paragraph)'),
  durationFrames: z.number().int().positive().describe('Computed from TTS audio length, fps=30'),

  // Template / composition selection
  templateId: z.string().min(1).describe('Which composition to use (e.g. "footage-scene", "historical-globe")'),
  templateProps: z.record(z.string(), z.unknown()).default({}).describe('Props passed to the composition'),

  // Visual matching hints (used by material-search)
  visualHint: z.string().optional().describe('LLM-generated visual description for asset search'),
  keywords: z.array(z.string()).default([]).describe('Extracted entities/concepts'),

  // Asset binding (filled by scene-asset-resolver)
  matchedAssets: z
    .array(
      z.object({
        assetId: z.string(),
        kind: z.enum(['footage', 'image', 'programmatic']),
        score: z.number().min(0).max(1),
        source: z.string().optional(),
      })
    )
    .default([]),

  // Subtitle (filled by subtitle-aligner)
  subtitles: z
    .array(
      z.object({
        startMs: z.number().int().nonnegative(),
        endMs: z.number().int().positive(),
        text: z.string(),
      })
    )
    .default([]),
});

export type Scene = z.infer<typeof SceneSchema>;

/**
 * A ScenePlan is the full LLM output: a list of scenes derived from one script.
 */
export const ScenePlanSchema = z.object({
  scriptHash: z.string().describe('SHA-256 of the source script for caching/dedup'),
  scenes: z.array(SceneSchema).min(1).max(50),
  totalDurationFrames: z.number().int().positive(),
  fps: z.literal(30).default(30),
  aspectRatio: z.enum(['16:9', '9:16']).default('16:9'),
});

export type ScenePlan = z.infer<typeof ScenePlanSchema>;
