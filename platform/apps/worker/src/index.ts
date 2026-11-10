/**
 * Stage 1 worker boot: an in-memory render queue (p-queue) that processes
 * render jobs serially. No Redis, no BullMQ — keeps local-dev to zero
 * external services per the storage-tiered plan.
 *
 * Remotion integration is local-dev first: bundle the registered composition
 * entrypoint, select `MultiSceneVideo` with the job props, and render an MP4
 * into the job's output path.
 */
import PQueue from 'p-queue';
import { eq, sql } from 'drizzle-orm';
import { getDb, drafts, renderJobs } from '@huasheng-clone/db';
import { RenderRequestSchema, type RenderResponse } from '@huasheng-clone/schemas';
import { renderScenePlan, type RenderJob } from './render.js';

const renderQueue = new PQueue({ concurrency: 1 });

const port = Number(process.env.PORT ?? 3002);

export async function enqueueRender(job: RenderJob): Promise<void> {
  await renderQueue.add(async () => {
    console.log(`[worker] render start ${job.draftId} -> ${job.outputPath}`);
    await renderScenePlan(job);
    console.log(`[worker] render done ${job.draftId}`);
  });
}

// Simple HTTP control surface so api/web can enqueue jobs without sharing process memory.
import http from 'node:http';

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        service: 'huasheng-clone-worker',
        version: '0.1.0',
        queueSize: renderQueue.size,
        pending: renderQueue.pending,
      })
    );
    return;
  }
  if (req.method === 'POST' && req.url === '/render') {
    void handleRender(req, res);
    return;
  }
  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ code: 404, message: 'Not Found' }));
});

async function handleRender(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
  try {
    const body = await readJson(req);
    const renderRequest = RenderRequestSchema.parse(body);
    const db = await getDb();

    await db
      .update(renderJobs)
      .set({ status: 'queued', progressPercent: 0, errorMessage: null })
      .where(eq(renderJobs.id, renderRequest.renderJobId));

    void renderQueue.add(async () => {
      await db
        .update(renderJobs)
        .set({ status: 'running', startedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(renderJobs.id, renderRequest.renderJobId));

      try {
        await renderScenePlan({
          ...renderRequest,
          onProgress: async (progressPercent) => {
            await db
              .update(renderJobs)
              .set({ progressPercent })
              .where(eq(renderJobs.id, renderRequest.renderJobId));
          },
        });
        await db
          .update(renderJobs)
          .set({
            status: 'done',
            progressPercent: 100,
            finishedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(eq(renderJobs.id, renderRequest.renderJobId));
        await db
          .update(drafts)
          .set({
            status: 'done',
            outputPath: renderRequest.outputPath,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(eq(drafts.id, renderRequest.draftId));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await db
          .update(renderJobs)
          .set({
            status: 'failed',
            errorMessage: message,
            finishedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(eq(renderJobs.id, renderRequest.renderJobId));
        await db
          .update(drafts)
          .set({
            status: 'failed',
            errorMessage: message,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(eq(drafts.id, renderRequest.draftId));
      }
    });

    const response: RenderResponse = {
      renderJobId: renderRequest.renderJobId,
      draftId: renderRequest.draftId,
      status: 'queued',
      outputPath: renderRequest.outputPath,
    };
    res.writeHead(202, { 'content-type': 'application/json' });
    res.end(JSON.stringify(response));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.writeHead(400, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ code: 400, message }));
  }
}

function readJson(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(data || '{}'));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

server.listen(port, () => {
  console.log(`[worker] huasheng-clone worker listening on http://localhost:${port}`);
});

process.on('SIGINT', () => {
  console.log('[worker] shutting down…');
  server.close();
  void renderQueue.onIdle().then(() => process.exit(0));
});
