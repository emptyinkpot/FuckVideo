import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import {
  CreateDraftRequestSchema,
  type InnovideoConfig,
} from '@huasheng-clone/schemas';
import { getDb, drafts } from '@huasheng-clone/db';
import { getInnovideoConfig } from '../services/config.js';
import { runDraftPipeline } from '../services/pipeline.js';
import { ANONYMOUS_USER_ID, newDraftId } from '../db/init.js';

export const innovideoRoutes = new Hono()
  /**
   * GET /api/innovideo/config — mirrors huasheng's real shape; values are ours.
   */
  .get('/config', (c) => {
    const config: InnovideoConfig = getInnovideoConfig();
    return c.json(config);
  })

  /**
   * POST /api/innovideo/create — persist draft, fire-and-forget pipeline.
   */
  .post('/create', zValidator('json', CreateDraftRequestSchema), async (c) => {
    const body = c.req.valid('json');
    const draftId = newDraftId();

    const db = await getDb();
    await db.insert(drafts).values({
      id: draftId,
      userId: ANONYMOUS_USER_ID,
      title: body.script.slice(0, 40),
      inputScript: body.script,
      trackPreference: body.trackPreference,
      aspectRatio: body.aspectRatio,
      status: 'planning',
    });

    // Fire-and-forget. Client polls GET /draft/:id for progress.
    void runDraftPipeline(draftId).catch((err) => {
      console.error(`[innovideo] pipeline crashed for ${draftId}:`, err);
    });

    return c.json({ draftId, status: 'planning' as const }, 201);
  })

  /**
   * GET /api/innovideo/draft/:id — returns full draft incl. scene plan + status.
   */
  .get('/draft/:id', async (c) => {
    const id = c.req.param('id');
    const db = await getDb();
    const rows = await db.select().from(drafts).where(eq(drafts.id, id)).limit(1);
    const draft = rows[0];
    if (!draft) {
      return c.json({ code: 404, message: `Draft ${id} not found` }, 404);
    }
    return c.json({
      id: draft.id,
      status: draft.status,
      title: draft.title,
      inputScript: draft.inputScript,
      inputKind: draft.inputKind,
      trackPreference: draft.trackPreference,
      aspectRatio: draft.aspectRatio,
      scenePlan: draft.scenePlanJson ? JSON.parse(draft.scenePlanJson) : null,
      errorMessage: draft.errorMessage,
      outputPath: draft.outputPath,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    });
  });
