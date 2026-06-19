import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { nanoid } from 'nanoid';
import {
  CreateDraftRequestSchema,
  type InnovideoConfig,
} from '@huasheng-clone/schemas';
import { getInnovideoConfig } from '../services/config.js';

export const innovideoRoutes = new Hono()
  /**
   * GET /api/innovideo/config
   * Mirrors huasheng's real config endpoint shape; values reflect huasheng-clone's
   * actual supported voices/quotas/tags.
   */
  .get('/config', (c) => {
    const config: InnovideoConfig = getInnovideoConfig();
    return c.json(config);
  })

  /**
   * POST /api/innovideo/create
   * Stage 1 placeholder: validates input, returns a draftId, queues planning.
   * Full implementation lands in Task #15.
   */
  .post('/create', zValidator('json', CreateDraftRequestSchema), (c) => {
    const body = c.req.valid('json');
    const draftId = `draft_${nanoid(12)}`;

    // TODO Task #15/16: persist draft to SQLite + enqueue script-to-scenes job.
    console.log(
      `[innovideo] create draft ${draftId}, ${body.script.length} chars, track=${body.trackPreference}`
    );

    return c.json({ draftId, status: 'planning' as const }, 201);
  })

  /**
   * GET /api/innovideo/draft/:id
   * Stage 1 placeholder: returns 404 until SQLite persistence lands.
   */
  .get('/draft/:id', (c) => {
    const id = c.req.param('id');
    return c.json(
      {
        code: 404,
        message: `Draft ${id} not found (Stage 1 persistence not yet implemented)`,
      },
      404
    );
  });
