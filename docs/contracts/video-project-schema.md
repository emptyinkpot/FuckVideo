# Video Project Schema

This document defines the core data contracts for FuckVideo.

## Rule

Code must not invent timeline, shot or vector fields ad hoc. Add fields here first, then update `project.json`, scripts and runtime validation.

## Project File

Project files live under:

```text
.runtime/video-projects/<id>.json
```

The project file is editable timeline truth. It is consumed by `scripts/project-store.mjs` and converted to Remotion props.

Minimum shape:

```json
{
  "id": "project-id",
  "title": "Generated video",
  "sourceText": "original narration text",
  "audio": {
    "path": "public/generated/audio.mp3",
    "durationMs": 30000,
    "provider": "dashscope"
  },
  "captions": [],
  "scenes": [],
  "render": {
    "composition": "MultiSceneVideo",
    "fps": 30,
    "width": 1920,
    "height": 1080
  }
}
```

## ShotPlan

`ShotPlan` is generated from script/audio before visual material is selected.

```json
{
  "id": "shot-001",
  "sourceText": "凌晨三点的上海依旧灯火通明",
  "visualNeed": "night city skyline, traffic, neon, lonely mood",
  "assetTypes": ["video", "image", "programmatic"],
  "durationMs": 4500,
  "keywords": ["上海", "夜景", "车流"],
  "mood": ["lonely", "busy"],
  "mustNotShow": ["daytime"],
  "fallback": "programmatic-city-atmosphere"
}
```

Required:

- `id`
- `sourceText`
- `visualNeed`
- `durationMs`

## TimelineScene

`TimelineScene` is the editable project scene after material resolution.

```json
{
  "id": "scene-001",
  "startMs": 0,
  "endMs": 4500,
  "durationMs": 4500,
  "text": "凌晨三点的上海依旧灯火通明",
  "sceneType": "footage",
  "template": "FootageScene",
  "asset": {
    "assetId": "asset-city-night-001",
    "clipId": "asset-city-night-001:shot-001",
    "path": "public/footage/city-night.mp4",
    "startMs": 2000,
    "endMs": 6500
  },
  "fallbackUsed": false,
  "visualLayer": {},
  "visualCandidates": [],
  "decisionTrace": []
}
```

Required:

- `id`
- `startMs` or derivable order/duration
- `durationMs`
- `text`
- `sceneType`

## VectorSearchResult

Vector search is a candidate source for `visual-resolver.mjs`.

```json
{
  "assetId": "asset-city-night-001",
  "clipId": "asset-city-night-001:shot-001",
  "score": 0.82,
  "path": "public/footage/city-night.mp4",
  "assetType": "video",
  "startMs": 2000,
  "endMs": 6500,
  "metadata": {
    "bestFor": ["urban_opening"],
    "avoidFor": ["historical_1900s"],
    "mustNotShow": ["daytime"]
  }
}
```

The first vector sidecar is `services/material-vector-search/`. TypeScript reads it through `scripts/material-vector-client.mjs` and maps matches back into asset candidates. Vector search results are candidates only; they do not become timeline truth until `visual-resolver.mjs` and `project-store.mjs` accept them.

## Remotion Handoff

`project-store.mjs` converts project scenes to `MultiSceneVideo` props. The handoff must preserve:

- scene timing
- narration and caption relation
- selected template/component
- asset path and clip range
- caption layout
- progress-bar layout
- decision trace when present

## Invariants

- Captions are derived from original source text and audio timing, not ASR typo text.
- Segment matching must be scoped to the current scene.
- `mustNotShow` cannot be overridden by score.
- `fallbackUsed=true` is required when using generated/programmatic visuals instead of requested factual material.
- Project export must validate or repair the timeline before writing Remotion props.
