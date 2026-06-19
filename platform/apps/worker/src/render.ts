import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { defaultMultiSceneVideoProps, type MultiSceneVideoProps } from '@huasheng-clone/compositions';
import { ScenePlanSchema, type ScenePlan } from '@huasheng-clone/schemas';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../../..');
const remotionEntry = path.join(repoRoot, 'packages', 'compositions', 'src', 'remotion-entry.tsx');
const bundleOutDir = path.join(repoRoot, 'storage', 'remotion-bundle');

export interface RenderJob {
  draftId: string;
  scenePlan: ScenePlan | unknown;
  outputPath: string;
}

export async function renderScenePlan(job: RenderJob): Promise<{ outputPath: string }> {
  const scenePlan = ScenePlanSchema.parse(job.scenePlan);
  const inputProps = toMultiSceneVideoProps(scenePlan);
  const rendererInputProps = inputProps as unknown as Record<string, unknown>;
  const outputPath = path.resolve(job.outputPath);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await mkdir(bundleOutDir, { recursive: true });

  const serveUrl = await bundle({
    entryPoint: remotionEntry,
    outDir: bundleOutDir,
  });

  const composition = await selectComposition({
    serveUrl,
    id: 'MultiSceneVideo',
    inputProps: rendererInputProps,
    logLevel: 'warn',
  });

  await renderMedia({
    serveUrl,
    composition,
    codec: 'h264',
    outputLocation: outputPath,
    inputProps: rendererInputProps,
    overwrite: true,
    logLevel: 'warn',
    concurrency: 1,
    timeoutInMilliseconds: 120_000,
    onProgress: (progress) => {
      const pct = Math.round(progress.progress * 100);
      console.log(
        `[worker] render ${job.draftId}: ${pct}% (${progress.renderedFrames}/${composition.durationInFrames} frames)`
      );
    },
    chromiumOptions: {
      gl: 'swangle',
    },
  });

  return { outputPath };
}

function toMultiSceneVideoProps(scenePlan: ScenePlan): MultiSceneVideoProps {
  const scenes = scenePlan.scenes.map((scene) => {
    const templateProps = rewriteLocalMediaProps(scene.templateProps);
    return { ...scene, templateProps };
  });
  const hasSceneAudio = scenes.some((scene) => typeof scene.templateProps.audioSrc === 'string');

  return {
    ...defaultMultiSceneVideoProps,
    title: 'AI 自动成片',
    scenes,
    enableAudio: hasSceneAudio,
    showCaptions: true,
    showSceneLabels: false,
  };
}

function rewriteLocalMediaProps(props: Record<string, unknown>): Record<string, unknown> {
  const mediaKeys = new Set(['audioSrc', 'src']);
  const next: Record<string, unknown> = { ...props };

  for (const key of mediaKeys) {
    const value = next[key];
    if (typeof value !== 'string' || value.trim() === '') continue;
    next[key] = toBrowserReadableMediaUrl(value);
  }

  return next;
}

function toBrowserReadableMediaUrl(value: string): string {
  if (/^(https?:|file:|data:|blob:)/i.test(value)) return value;
  if (path.isAbsolute(value)) return pathToFileURL(value).href;
  return value;
}
