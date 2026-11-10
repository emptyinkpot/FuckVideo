import { z } from 'zod';

/**
 * A Material is one asset (clip/image) in the vector-searchable library.
 * Sources include Pexels, Pixabay, user uploads, and (future) programmatic primitives.
 */
export const MaterialKindSchema = z.enum(['footage', 'image', 'audio', 'programmatic']);
export type MaterialKind = z.infer<typeof MaterialKindSchema>;

export const MaterialSchema = z.object({
  id: z.string().min(1),
  kind: MaterialKindSchema,
  uri: z.string().min(1).describe('Absolute URL or storage://relative-path'),
  thumbnailUri: z.string().optional(),
  durationSec: z.number().nonnegative().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  title: z.string().default(''),
  description: z.string().default(''),
  tags: z.array(z.string()).default([]),
  source: z.string().describe('pexels | pixabay | user-upload | programmatic'),
  licenseInfo: z.string().optional(),
  uploadedBy: z.string().optional(),
  createdAt: z.string().datetime(),
});

export type Material = z.infer<typeof MaterialSchema>;

export const MaterialSearchRequestSchema = z.object({
  query: z.string().min(1).max(500),
  kind: MaterialKindSchema.optional(),
  limit: z.number().int().min(1).max(50).default(8),
  minScore: z.number().min(0).max(1).default(0.3),
});

export const MaterialSearchResultSchema = z.object({
  query: z.string(),
  hits: z.array(
    z.object({
      material: MaterialSchema,
      score: z.number(),
    })
  ),
});
