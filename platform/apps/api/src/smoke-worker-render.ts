import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import type { ScenePlan } from '@huasheng-clone/schemas';
import { drafts, getDb, renderJobs } from '@huasheng-clone/db';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const workerPort = Number(process.env.SMOKE_WORKER_PORT ?? 3002);
const workerBaseUrl = `http://localhost:${workerPort}`;

process.env.DATABASE_URL = process.env.SMOKE_DATABASE_URL ?? 'file:./storage/smoke-api-worker.sqlite';
process.env.WORKER_BASE_URL = workerBaseUrl;

const { bootstrapDb, ANONYMOUS_USER_ID } = await import('./db/init.js');
const { enqueueWorkerRender } = await import('./services/worker-client.js');

const scenePlan: ScenePlan = {
  scriptHash: 'smoke-api-worker-render',
  fps: 30,
  aspectRatio: '16:9',
  totalDurationFrames: 90,
  scenes: [
    {
      id: 'scene-001',
      text: 'API 把渲染任务交给 worker。',
      durationFrames: 45,
      templateId: 'narrated-video',
      templateProps: {
        title: 'API → Worker',
        subtitle: 'HTTP render control surface',
        bodyText: 'API 把渲染任务交给 worker。',
      },
      visualHint: 'api worker render smoke',
      keywords: ['API', 'Worker'],
      matchedAssets: [],
      subtitles: [{ startMs: 0, endMs: 1500, text: 'API 把渲染任务交给 worker。' }],
    },
    {
      id: 'scene-002',
      text: 'worker 完成 Remotion 渲染后回写 SQLite。',
      durationFrames: 45,
      templateId: 'product-stage',
      templateProps: { title: 'SQLite 回写' },
      visualHint: 'sqlite render status update',
      keywords: ['SQLite', 'Render'],
      matchedAssets: [],
      subtitles: [{ startMs: 0, endMs: 1500, text: 'worker 完成 Remotion 渲染后回写 SQLite。' }],
    },
  ],
};

await assertPortFree(workerBaseUrl);
await bootstrapDb();

const worker = startWorker();
try {
  await waitForHealth(workerBaseUrl);

  const db = await getDb();
  const stamp = Date.now();
  const draftId = `draft_smoke_${stamp}`;
  const renderJobId = `rj_smoke_${stamp}`;
  const outputPath = `renders/${draftId}.mp4`;

  await db.insert(drafts).values({
    id: draftId,
    userId: ANONYMOUS_USER_ID,
    title: 'smoke worker render',
    inputScript: 'smoke worker render',
    status: 'rendering',
    scenePlanJson: JSON.stringify(scenePlan),
  });
  await db.insert(renderJobs).values({
    id: renderJobId,
    draftId,
    status: 'queued',
  });

  await enqueueWorkerRender({ renderJobId, draftId, scenePlan, outputPath });
  await waitForRenderDone(renderJobId, draftId);

  const absoluteOutputPath = path.join(repoRoot, 'storage', outputPath);
  if (!existsSync(absoluteOutputPath)) {
    throw new Error(`render output missing: ${absoluteOutputPath}`);
  }
  const stats = statSync(absoluteOutputPath);
  if (stats.size <= 0) {
    throw new Error(`render output is empty: ${absoluteOutputPath}`);
  }

  console.log(
    JSON.stringify(
      {
        draftId,
        renderJobId,
        outputPath,
        absoluteOutputPath,
        bytes: stats.size,
      },
      null,
      2
    )
  );
} finally {
  await stopWorker(worker);
}

function startWorker(): ChildProcess {
  const worker = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], {
    cwd: path.join(repoRoot, 'apps', 'worker'),
    env: {
      ...process.env,
      PORT: String(workerPort),
      DATABASE_URL: process.env.DATABASE_URL,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  worker.stdout?.on('data', (chunk) => process.stdout.write(`[worker] ${chunk}`));
  worker.stderr?.on('data', (chunk) => process.stderr.write(`[worker] ${chunk}`));
  return worker;
}

async function assertPortFree(baseUrl: string): Promise<void> {
  try {
    const res = await fetch(`${baseUrl}/health`);
    if (res.ok) {
      throw new Error(`${baseUrl} already has a worker-like health endpoint`);
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes('already has')) throw err;
  }
}

async function waitForHealth(baseUrl: string): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    const res = await fetch(`${baseUrl}/health`).catch(() => null);
    if (res?.ok) return;
    await sleep(500);
  }
  throw new Error(`worker health did not become ready at ${baseUrl}`);
}

async function waitForRenderDone(renderJobId: string, draftId: string): Promise<void> {
  const db = await getDb();
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const [job] = await db.select().from(renderJobs).where(eq(renderJobs.id, renderJobId)).limit(1);
    const [draft] = await db.select().from(drafts).where(eq(drafts.id, draftId)).limit(1);
    if (job?.status === 'done' && draft?.status === 'done' && draft.outputPath) return;
    if (job?.status === 'failed' || draft?.status === 'failed') {
      throw new Error(job?.errorMessage || draft?.errorMessage || 'render failed');
    }
    await sleep(1000);
  }
  throw new Error(`render job ${renderJobId} did not finish`);
}

async function stopWorker(worker: ChildProcess): Promise<void> {
  if (worker.exitCode !== null) return;
  worker.kill('SIGINT');
  await Promise.race([
    new Promise<void>((resolve) => worker.once('exit', () => resolve())),
    sleep(5000).then(() => {
      if (worker.exitCode === null) worker.kill();
    }),
  ]);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
