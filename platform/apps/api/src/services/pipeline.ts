/**
 * Draft pipeline: LLM script-to-scenes → TTS → material matching.
 * Each stage updates the draft row so /api/innovideo/draft/:id can stream
 * progress to the client.
 *
 * Stage 1 stops at "matching" — the actual Remotion render is gated on
 * Task #11 (compositions migration). The pipeline therefore sets
 * status='matching' and exits; status='rendering'/'done' transitions land
 * once the worker can bundle a real Composition.
 */
import { eq, sql } from 'drizzle-orm';
import { getDb, drafts, renderJobs, type Draft, type RenderJob } from '@huasheng-clone/db';
import { scriptToScenes } from '@huasheng-clone/llm';
import { renderTimeline } from '@huasheng-clone/tts-dashscope';
import { searchMaterials } from '@huasheng-clone/material-search';
import {
  ScenePlanSchema,
  type ScenePlan,
  type Scene,
} from '@huasheng-clone/schemas';
import { newRenderJobId } from '../db/init.js';
import { enqueueWorkerRender } from './worker-client.js';

export async function runDraftPipeline(draftId: string): Promise<void> {
  const db = await getDb();
  const row = await loadDraft(draftId);

  try {
    await setStatus(draftId, 'planning');
    const scenePlan = await scriptToScenes({
      script: row.inputScript,
      trackPreference: row.trackPreference,
      aspectRatio: row.aspectRatio,
    });
    await persistScenePlan(draftId, scenePlan);

    await setStatus(draftId, 'tts');
    const timeline = await renderTimeline(
      scenePlan.scenes.map((s) => ({ id: s.id, text: s.text }))
    );
    const planWithTts = mergeTtsIntoScenes(scenePlan, timeline.scenes);
    await persistScenePlan(draftId, planWithTts);

    await setStatus(draftId, 'matching');
    const planWithAssets = await attachAssets(planWithTts);
    await persistScenePlan(draftId, planWithAssets);

    await setStatus(draftId, 'rendering');
    const outputPath = `renders/${draftId}.mp4`;
    const renderJobId = await createRenderJob(draftId);
    await enqueueWorkerRender({
      renderJobId,
      draftId,
      scenePlan: planWithAssets,
      outputPath,
    });
    await waitForRenderJob(renderJobId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[pipeline] draft ${draftId} failed:`, message);
    await db
      .update(drafts)
      .set({ status: 'failed', errorMessage: message, updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(drafts.id, draftId));
    throw err;
  }
}

async function loadDraft(draftId: string): Promise<Draft> {
  const db = await getDb();
  const rows = await db.select().from(drafts).where(eq(drafts.id, draftId)).limit(1);
  const draft = rows[0];
  if (!draft) throw new Error(`[pipeline] draft ${draftId} not found`);
  return draft;
}

async function setStatus(draftId: string, status: Draft['status']): Promise<void> {
  const db = await getDb();
  await db
    .update(drafts)
    .set({ status, updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(drafts.id, draftId));
}

async function persistScenePlan(draftId: string, plan: ScenePlan): Promise<void> {
  const db = await getDb();
  await db
    .update(drafts)
    .set({ scenePlanJson: JSON.stringify(plan), updatedAt: sql`CURRENT_TIMESTAMP` })
    .where(eq(drafts.id, draftId));
}

async function createRenderJob(draftId: string): Promise<string> {
  const db = await getDb();
  const renderJobId = newRenderJobId();
  await db.insert(renderJobs).values({
    id: renderJobId,
    draftId,
    status: 'queued',
  });
  return renderJobId;
}

async function waitForRenderJob(renderJobId: string): Promise<RenderJob> {
  const timeoutMs = Number(process.env.RENDER_JOB_TIMEOUT_MS ?? 180_000);
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const job = await loadRenderJob(renderJobId);
    if (job.status === 'done') return job;
    if (job.status === 'failed' || job.status === 'cancelled') {
      throw new Error(job.errorMessage || `[pipeline] render job ${renderJobId} ${job.status}`);
    }
    await sleep(1000);
  }

  throw new Error(`[pipeline] render job ${renderJobId} timed out after ${timeoutMs}ms`);
}

async function loadRenderJob(renderJobId: string): Promise<RenderJob> {
  const db = await getDb();
  const rows = await db.select().from(renderJobs).where(eq(renderJobs.id, renderJobId)).limit(1);
  const job = rows[0];
  if (!job) throw new Error(`[pipeline] render job ${renderJobId} not found`);
  return job;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mergeTtsIntoScenes(
  plan: ScenePlan,
  ttsScenes: { sceneId: string; audioPath: string; durationMs: number; subtitles: { startMs: number; endMs: number; text: string }[] }[]
): ScenePlan {
  const ttsById = new Map(ttsScenes.map((s) => [s.sceneId, s]));
  const scenes: Scene[] = plan.scenes.map((scene) => {
    const tts = ttsById.get(scene.id);
    if (!tts) return scene;
    return {
      ...scene,
      durationFrames: Math.max(30, Math.round((tts.durationMs / 1000) * plan.fps)),
      templateProps: { ...scene.templateProps, audioSrc: tts.audioPath },
      subtitles: tts.subtitles,
    };
  });
  const totalDurationFrames = scenes.reduce((sum, s) => sum + s.durationFrames, 0);
  return ScenePlanSchema.parse({ ...plan, scenes, totalDurationFrames });
}

async function attachAssets(plan: ScenePlan): Promise<ScenePlan> {
  const scenes: Scene[] = [];
  for (const scene of plan.scenes) {
    if (!scene.visualHint) {
      scenes.push(scene);
      continue;
    }
    try {
      const { hits } = await searchMaterials({
        query: scene.visualHint,
        limit: 3,
        minScore: 0.25,
      });
      scenes.push({
        ...scene,
        matchedAssets: hits.map((h) => ({
          assetId: h.material.id,
          kind: 'footage',
          score: h.score,
          source: h.material.source,
        })),
      });
    } catch (err) {
      // Empty store / network → keep scene without assets; render falls back
      // to a placeholder composition.
      console.warn(`[pipeline] material search failed for ${scene.id}:`, (err as Error).message);
      scenes.push(scene);
    }
  }
  return ScenePlanSchema.parse({ ...plan, scenes });
}
