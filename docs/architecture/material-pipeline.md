# Material Pipeline

This document defines how FuckVideo turns raw material into searchable, timeline-ready assets.

## Goal

The material pipeline exists to answer:

```text
Given this narration segment, which visual material should appear here?
```

It does not render video. It prepares assets so `scene-planner.mjs`, `visual-resolver.mjs` and `project-store.mjs` can choose and persist timeline scenes.

## Current State

Active lightweight path:

```text
public/footage
  -> scripts/asset-indexer.mjs
  -> public/generated/asset-index.json
  -> scripts/material-seed.mjs
  -> public/generated/material-seed.jsonl
  -> scripts/asset-matcher.mjs
  -> scripts/visual-resolver.mjs
  -> .runtime/video-projects/*.json
```

## Language Boundary

The orchestration and timeline side stays in TypeScript / Node:

- `scripts/asset-indexer.mjs`
- `scripts/asset-matcher.mjs`
- `scripts/visual-resolver.mjs`
- `scripts/project-store.mjs`
- Remotion templates and Studio plugin

The model-heavy material understanding side should be Python sidecars:

- CLIP / SigLIP / OpenCLIP embeddings
- Whisper / faster-whisper ASR
- OCR
- Qwen-VL frame captioning
- batch frame preprocessing

Reason: Remotion timeline logic belongs with the TypeScript renderer/editor, while the mature ML tooling and GPU execution path are Python-first. Cross-runtime handoff must use JSON/JSONL or local HTTP contracts.

Current P0 files:

- `scripts/material-seed.mjs`
- `docs/contracts/material-seed-schema.md`
- `services/material-vector-search/`
- `scripts/material-vector-client.mjs`
- `visual-resolver.mjs#resolveVisualForSegmentWithVectors`

Planned semantic path:

```text
asset-source / public / OpenList-backed material
  -> file identity and metadata
  -> public/generated/material-seed.jsonl
  -> frame extraction / OCR / ASR
  -> CLIP or SigLIP embeddings
  -> LanceDB first
  -> vector search result
  -> visual-resolver footage candidate scoring
  -> project-store timeline scene
```

The vector path is opt-in. Set `MATERIAL_VECTOR_SEARCH_URL=http://127.0.0.1:4141` to let TypeScript query the Python sidecar. Without that env var, the existing local asset-index path remains unchanged.

Embedding backend policy:

- `hash` is the default wiring backend and has no semantic quality.
- `sentence-transformers` is the first real local embedding backend.
- `requirements-ml.txt` is separate so normal Remotion development does not require PyTorch/model dependencies.
- First target model: `sentence-transformers/clip-ViT-B-32`; later evaluate SigLIP/OpenCLIP variants.

## Source Layers

| Layer | Examples | Role |
| --- | --- | --- |
| Local runtime footage | `public/footage/` | Small local footage pool used by current scripts. |
| Cached evidence | `public/evidence-cache/` | Downloaded factual image evidence. |
| Programmatic assets | `asset-source/programmatic-visual-assets/` | Remotion-editable animation references. |
| Historical maps | `asset-source/historical-basemaps/`, `public/historical-maps/` | Historical map and globe visuals. |
| External file space | OpenList / COS / Quark | Large files and archive material, referenced by path, not copied into Git by default. |

## Ingestion Steps

1. Discover source files.
2. Assign stable asset id from source path and hash.
3. Record source, license, provenance and visibility.
4. Detect media type.
5. For video, extract representative frames and optional shots.
6. For audio/video, run ASR when needed.
7. For images/video frames/documents, run OCR when needed.
8. Optionally run Qwen-VL or GPT-4o style captioning for richer semantic descriptions.
9. Generate embeddings with CLIP/SigLIP/OpenCLIP.
10. Write vector rows and metadata rows.

## Asset Row

```json
{
  "id": "asset-city-night-001",
  "type": "footage",
  "path": "public/footage/city-night.mp4",
  "source": "local",
  "license": "unknown",
  "description": "Night city skyline with traffic and neon lights.",
  "semantic": {
    "objects": ["high-rise", "street", "traffic", "neon"],
    "actions": ["establish"],
    "mood": ["lonely", "busy"],
    "time": ["night"],
    "locations": ["city"]
  },
  "quality": {
    "resolution": "1920x1080",
    "durationMs": 12000,
    "textAreaRatio": 0.02,
    "motionScore": 0.68
  }
}
```

## Shot Row

```json
{
  "id": "asset-city-night-001:shot-001",
  "assetId": "asset-city-night-001",
  "startMs": 0,
  "endMs": 4200,
  "description": "Aerial night skyline with moving traffic.",
  "embeddingRef": "lancedb://footage/asset-city-night-001/shot-001"
}
```

## Retrieval Rules

- Retrieval must be segment-scoped. Do not match one segment using the full script or neighboring segment text.
- `mustNotShow` is a hard filter.
- `avoidFor` lowers score.
- `bestFor` raises score.
- Evidence material outranks generated visuals for factual documents, portraits, maps and locations.
- Programmatic Remotion templates are valid fallbacks and should be marked as fallback when used instead of real evidence.

## Integration Point

Vector retrieval should feed `visual-resolver.mjs` as an additional footage candidate source. It should not bypass:

- `scene-planner.mjs`
- `visual-resolver.mjs`
- `project-store.mjs`
- `src/templates/sceneRegistry.tsx`

## Storage Boundary

- Git stores code, manifests, small reference assets and documentation.
- Large source material should live in object/file storage.
- Vector DB files are derived runtime cache and must not become source truth.
- Generated `.runtime/video-projects/*.json` are editable project state, not raw material storage.
