import { z } from 'zod';
import { ScenePlanSchema } from './scenes.js';

/**
 * A Draft is the top-level workspace unit visible to users in /me/drafts.
 * It groups: input script + scene plan + render job + final mp4 path.
 */
export const DraftStatusSchema = z.enum([
  'idle',
  'planning',     // LLM is generating scenes
  'tts',          // TTS is synthesizing audio
  'matching',     // material-search is binding assets
  'rendering',    // Remotion worker is rendering
  'done',
  'failed',
]);
export type DraftStatus = z.infer<typeof DraftStatusSchema>;

export const DraftSchema = z.object({
  id: z.string().min(1),
  userId: z.string().min(1),
  title: z.string().default(''),
  inputScript: z.string().min(1).max(10_000),
  inputKind: z.enum(['script', 'audio', 'voiceover']).default('script'),
  trackPreference: z
    .enum(['general', 'football', 'science', 'finance', 'history'])
    .default('general'),
  scenePlan: ScenePlanSchema.optional(),
  status: DraftStatusSchema.default('idle'),
  errorMessage: z.string().optional(),
  outputPath: z.string().optional().describe('Relative path under storage/ to the final mp4'),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Draft = z.infer<typeof DraftSchema>;
