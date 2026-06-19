import { z } from 'zod';

/**
 * TTS request/response shared between api and worker.
 * Provider: Alibaba DashScope CosyVoice v3.5-plus.
 * Matches the working voices observed in huasheng's /api/innovideo/config.
 */
export const TtsVoiceSchema = z.enum([
  'male-qn-jingying',     // 生动解说
  'hutong_daye',          // 北京小伙
  'audiobook_female_2',   // 新闻主播
  'audiobook_male_1',     // 磁性男声
  // Custom-cloned voices land via Stage 2b under a separate prefix, e.g. "clone-{userId}-{voiceId}".
]);
export type TtsVoice = z.infer<typeof TtsVoiceSchema>;

export const TtsRequestSchema = z.object({
  text: z.string().min(1).max(2000),
  voice: TtsVoiceSchema.default('audiobook_male_1'),
  speed: z.number().min(0.5).max(2.0).default(1.0),
  pitch: z.number().min(-12).max(12).default(0),
});

export const TtsResultSchema = z.object({
  audioPath: z.string().describe('Relative path under storage/ to the generated mp3/wav'),
  durationMs: z.number().int().positive(),
  format: z.enum(['mp3', 'wav']),
  subtitles: z.array(
    z.object({
      startMs: z.number().int().nonnegative(),
      endMs: z.number().int().positive(),
      text: z.string(),
    })
  ),
});
