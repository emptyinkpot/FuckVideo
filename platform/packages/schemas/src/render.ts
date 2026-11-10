import { z } from 'zod';
import { ScenePlanSchema } from './scenes.js';

export const RenderRequestSchema = z.object({
  renderJobId: z.string().min(1),
  draftId: z.string().min(1),
  scenePlan: ScenePlanSchema,
  /** Relative path under repo storage/, e.g. renders/draft_xxx.mp4. */
  outputPath: z.string().min(1),
});

export type RenderRequest = z.infer<typeof RenderRequestSchema>;

export const RenderResponseSchema = z.object({
  renderJobId: z.string().min(1),
  draftId: z.string().min(1),
  status: z.enum(['queued', 'running', 'done', 'failed']),
  outputPath: z.string().optional(),
  errorMessage: z.string().optional(),
});

export type RenderResponse = z.infer<typeof RenderResponseSchema>;
