import React from 'react';
import { Composition } from 'remotion';
import { z } from 'zod';
import { MultiSceneVideo, defaultMultiSceneVideoProps, type MultiSceneVideoProps } from './MultiSceneVideo';
import { FootageScene } from './templates/FootageScene';
import { MapFlyover } from './templates/MapFlyover';
import { NarratedVideo } from './templates/NarratedVideo';
import { ProductStage } from './templates/ProductStage';

const sceneSchema = z.object({
  id: z.string(),
  text: z.string(),
  durationFrames: z.number().int().positive(),
  templateId: z.string(),
  templateProps: z.record(z.string(), z.unknown()).default({}),
  visualHint: z.string().optional(),
  keywords: z.array(z.string()).default([]),
  matchedAssets: z.array(z.unknown()).default([]),
  subtitles: z
    .array(z.object({ startMs: z.number(), endMs: z.number(), text: z.string() }))
    .default([]),
});

const multiSceneVideoSchema = z.object({
  title: z.string().optional(),
  scenes: z.array(sceneSchema),
  audioSrc: z.string().optional(),
  enableAudio: z.boolean().optional(),
  showCaptions: z.boolean().optional(),
  showSceneLabels: z.boolean().optional(),
  captionStyle: z.enum(['typewriter', 'classic', 'none']).optional(),
  progressStyle: z.enum(['gradient', 'thin', 'none']).optional(),
});

const MultiSceneComposition: React.FC<Record<string, unknown>> = (props) => (
  <MultiSceneVideo {...(props as unknown as MultiSceneVideoProps)} />
);

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="MultiSceneVideo"
        component={MultiSceneComposition}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        schema={multiSceneVideoSchema}
        defaultProps={defaultMultiSceneVideoProps}
      />
      <Composition
        id="FootageScene"
        component={FootageScene}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="NarratedVideo"
        component={NarratedVideo}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="MapFlyover"
        component={MapFlyover}
        durationInFrames={210}
        fps={30}
        width={1920}
        height={1080}
      />
      <Composition
        id="ProductStage"
        component={ProductStage}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
      />
    </>
  );
};
