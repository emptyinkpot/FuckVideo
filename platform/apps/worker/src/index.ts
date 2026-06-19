/**
 * Stage 1 worker boot: an in-memory render queue (p-queue) that processes
 * render jobs serially. No Redis, no BullMQ — keeps local-dev to zero
 * external services per the storage-tiered plan.
 *
 * Real Remotion bundle/render integration lands in subsequent Stage 1 tasks
 * (after compositions/core migration completes via Task #11).
 */
import PQueue from 'p-queue';

const renderQueue = new PQueue({ concurrency: 1 });

const port = Number(process.env.PORT ?? 3002);

interface RenderJob {
  draftId: string;
  scenePlan: unknown;
  outputPath: string;
}

export async function enqueueRender(job: RenderJob): Promise<void> {
  await renderQueue.add(async () => {
    console.log(`[worker] render start ${job.draftId} -> ${job.outputPath}`);
    // TODO Task #9 part 2 (after #11 lands): @remotion/renderer pipeline.
    throw new Error('[worker] render() not implemented yet — pending compositions migration');
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
  res.writeHead(404, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ code: 404, message: 'Not Found' }));
});

server.listen(port, () => {
  console.log(`[worker] huasheng-clone worker listening on http://localhost:${port}`);
});

process.on('SIGINT', () => {
  console.log('[worker] shutting down…');
  server.close();
  void renderQueue.onIdle().then(() => process.exit(0));
});
