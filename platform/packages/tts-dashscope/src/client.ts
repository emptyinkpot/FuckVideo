import type { z } from 'zod';
import type { TtsRequestSchema, TtsResultSchema } from '@huasheng-clone/schemas';

/**
 * Stage 1 placeholder. Task #12 will port the real WebSocket client from
 * remotion-project/scripts/dashscope-tts.mjs and replace this stub.
 */
export async function synthesize(
  _request: z.infer<typeof TtsRequestSchema>
): Promise<z.infer<typeof TtsResultSchema>> {
  throw new Error('[tts-dashscope] synthesize() not implemented yet — pending Task #12');
}
