import { z } from 'zod';

/**
 * /api/innovideo/config response shape — mirrors huasheng's real config endpoint
 * (captured via Playwright on 2026-06-19). We expose a superset so the web app
 * can target the same contract, but our values reflect what huasheng-clone supports.
 */
export const InnovideoConfigSchema = z.object({
  voices: z.array(
    z.object({
      id: z.string(),
      voice: z.string(),
      desc: z.string(),
    })
  ),
  script_max: z.string(),       // huasheng returns these as strings; we follow.
  audio_script_max: z.string(),
  user_material_max: z.string(),
  content_markup_multiple: z.string(),
  models: z.array(z.object({ id: z.string(), desc: z.string() })),
  default_script: z.string(),
  default_voice_id: z.number(),
  report_tag: z.array(
    z.object({
      cat_name: z.string(),
      tags: z.array(
        z.object({
          tid: z.string(),
          name: z.string(),
          is_show_more: z.boolean(),
          show_more_must: z.boolean(),
          detail: z.string(),
        })
      ),
    })
  ),
  tts_speed_switch: z.boolean(),
  hide_podcasts: z.boolean(),
  hide_old_ttv: z.boolean(),
  export_annotation: z.boolean(),
});

export type InnovideoConfig = z.infer<typeof InnovideoConfigSchema>;

/**
 * /api/innovideo/create request — minimal MVP: text + track preference.
 */
export const CreateDraftRequestSchema = z.object({
  script: z.string().min(1).max(10_000),
  trackPreference: z
    .enum(['general', 'football', 'science', 'finance', 'history'])
    .default('general'),
  aspectRatio: z.enum(['16:9', '9:16']).default('16:9'),
});

export const CreateDraftResponseSchema = z.object({
  draftId: z.string(),
  status: z.literal('planning'),
});
