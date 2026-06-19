import path from 'node:path';
import { renderScenePlan } from './render.js';
import type { ScenePlan } from '@huasheng-clone/schemas';

const outputPath =
  process.env.SMOKE_RENDER_OUT ??
  path.join('renders', 'smoke-stage1.mp4');

const scenePlan: ScenePlan = {
  scriptHash: 'smoke-render-fixture',
  fps: 30,
  aspectRatio: '16:9',
  totalDurationFrames: 90,
  scenes: [
    {
      id: 'scene-001',
      text: '这是 Stage 1 的 Remotion 渲染冒烟验证。',
      durationFrames: 45,
      templateId: 'narrated-video',
      templateProps: {
        title: 'Remotion 渲染',
        subtitle: 'Stage 1 worker smoke',
        bodyText: '这是 Stage 1 的 Remotion 渲染冒烟验证。',
      },
      visualHint: 'render smoke test',
      keywords: ['Remotion', 'worker'],
      matchedAssets: [],
      subtitles: [{ startMs: 0, endMs: 1500, text: '这是 Stage 1 的 Remotion 渲染冒烟验证。' }],
    },
    {
      id: 'scene-002',
      text: '镜头会根据输入分镜动态计算总时长。',
      durationFrames: 45,
      templateId: 'product-stage',
      templateProps: {
        title: '动态时长',
      },
      visualHint: 'dynamic composition metadata',
      keywords: ['动态时长'],
      matchedAssets: [],
      subtitles: [{ startMs: 0, endMs: 1500, text: '镜头会根据输入分镜动态计算总时长。' }],
    },
  ],
};

await renderScenePlan({
  draftId: 'smoke-render',
  scenePlan,
  outputPath,
});

console.log(JSON.stringify({ outputPath }));
