# Video Understanding System

This document is the canonical source for the FuckVideo / Remotion video understanding and automatic assembly architecture.

## Purpose

This project is not a traditional automatic cutter and not an FFmpeg wrapper. The target capability is:

```text
AI material understanding
+ semantic retrieval
+ automatic timeline assembly
+ editable Remotion project generation
```

The hard problem is not cutting video. The hard problem is finding the right material from a large source library and placing it into a timeline with the right purpose, timing and evidence boundary.

End-user target:

```text
script or audio
  -> TTS narration
  -> shot semantic plan
  -> retrieve matching evidence / b-roll / Remotion-editable assets
  -> generate JSON timeline
  -> generate editable Remotion props/project
  -> render MP4
```

## Canonical Pipeline

```text
Script / audio
  -> LLM scene and shot decomposition
  -> ShotPlan[]
  -> material semantic query
  -> asset vector retrieval
  -> optional LLM reranking
  -> timeline heuristics and templates
  -> TimelineScene[]
  -> Remotion MultiSceneVideo props
  -> Remotion / FFmpeg render
```

Material ingestion pipeline:

```text
Material pool
  -> source identity and license metadata
  -> video frame extraction
  -> OCR / ASR / optional frame captioning
  -> CLIP / SigLIP / VideoCLIP embeddings
  -> vector database
  -> searchable asset / shot / clip index
```

## Layer Ownership

| Layer | Owner | Role | Must Not Own |
| --- | --- | --- | --- |
| Source files | OpenList / COS / Quark / local asset-source | Large files, cold archive, public file identity | Metadata truth, vector DB, runtime project state |
| Source metadata | `asset-source/*`, generated indexes | Asset identity, license, tags, provenance | Embedding quality, timeline authority |
| Vector DB | LanceDB first; Milvus/Weaviate later if needed | Semantic retrieval over assets, shots and clips | CMS, source file authority, timeline truth |
| Script understanding | LLM | Convert script/audio into shot needs | File storage, rendering |
| Candidate reranking | heuristic first, LLM later | Choose best asset among top-k matches | Primary vector index |
| Timeline | `.runtime/video-projects/*.json` and project-store | Editable video project truth | Source media bytes |
| Renderer | Remotion / FFmpeg | Preview, composition and export | Material understanding |

## Language Boundary

Canonical language split: `docs/architecture/language-boundary.md`.

FuckVideo keeps the product core in TypeScript / Node because Remotion, React composition, Studio plugin integration, project-store, visual resolver and render orchestration are TypeScript-native in this repository.

Model-heavy material understanding belongs in Python sidecars because CLIP/SigLIP/OpenCLIP, Whisper, OCR, Qwen-VL adapters, GPU batching and vector ingestion libraries are more mature in Python.

The boundary is contract-based:

```text
Python sidecar
  -> JSON / JSONL / local HTTP results
  -> TypeScript visual-resolver and project-store
  -> Remotion timeline and render
```

Python may produce derived ML outputs. It must not become timeline truth or bypass `visual-resolver.mjs`.

## Mature Industry Route

The stable route is:

```text
material embedding
+ vector database
+ multimodal retrieval
+ timeline assembly
```

It is not:

```text
FFmpeg automatic cutting only
```

Remotion and FFmpeg are execution layers. The reusable product value is the pre-understood, searchable material library.

## Preprocessing Requirements

The material library becomes useful only after preprocessing:

```text
video / image / audio / document
  -> hash and source path
  -> metadata record
  -> extracted frames or pages
  -> OCR
  -> ASR for audio/video
  -> optional Qwen-VL/GPT-4o captioning
  -> embeddings
  -> clip or segment rows
  -> vector DB
```

Example normalized material object:

```json
{
  "id": "city-night-001",
  "type": "footage",
  "path": "footage/city-night.mp4",
  "description": "深夜城市航拍，霓虹灯，高楼，车流",
  "semantic": {
    "scene": "deep night city",
    "emotion": "lonely",
    "objects": ["high-rise", "street", "traffic", "neon"],
    "camera": "aerial",
    "time": "night"
  },
  "shots": [
    {
      "id": "city-night-001:shot-001",
      "startMs": 0,
      "endMs": 4200,
      "embeddingRef": "lancedb://footage/city-night-001/shot-001"
    }
  ]
}
```

## Retrieval Strategy

### Stage 1: Embedding Retrieval

Primary retrieval is cosine similarity between:

```text
shot semantic query embedding
vs
asset / shot / clip embedding
```

This returns top-k candidates.

### Stage 2: Reranking

Top-k candidates should be reranked by:

- script context
- visual purpose
- emotion and tempo
- license and visibility
- `bestFor`
- `avoidFor`
- `mustNotShow`
- continuity with previous/next shots

Start with deterministic heuristics. Add LLM reranking after the retrieval contract is stable.

### Stage 3: Timeline Assembly

Timeline generation decides:

- when to cut
- how long each segment lasts
- where to insert b-roll
- when to use map/document/programmatic Remotion templates
- when to return to main narration visuals
- when a fallback animation is allowed

This should be templates plus heuristics first. Fully autonomous agent assembly is a later layer.

## Open Source And Mature References

These are references and candidates. Do not mark a candidate as active until it has code, config, readiness evidence and runtime ownership in this repository.

| Candidate | Role | Status In This Repo |
| --- | --- | --- |
| Remotion | Composition, preview, schema/defaultProps, rendering | Active framework |
| LanceDB | Lightweight local vector DB for first semantic retrieval loop | Target candidate |
| CLIP / SigLIP / OpenCLIP | Text-image and frame embedding | Target candidate |
| VideoCLIP | Video-level embedding | Candidate |
| Qwen-VL / GPT-4o | Rich frame understanding and captioning | Candidate |
| Whisper | ASR for video/audio material | Candidate |
| Milvus | Larger vector DB | Scale-up candidate |
| Towhee | Milvus-oriented video pipelines | Reference/candidate |
| Weaviate multi2vec-clip | All-in-one multimodal retrieval | Candidate |
| Immich | Mature media ingestion and smart search reference | Reference/candidate |
| VideoDB | Video search / understanding product reference | Reference only unless adopted |
| TwelveLabs | Hosted video understanding API | Reference or paid option |
| Haystack + CLIP | Retrieval pipeline reference | Candidate |
| n8n | Workflow automation | Candidate orchestrator |

## Current Repository State

Active:

- Remotion project generation and preview.
- TTS narration path through DashScope.
- scene planning scripts.
- local asset indexer and matcher.
- material seed JSONL generation.
- material vector search sidecar skeleton.
- visual resolver.
- evidence resolver.
- project-store editable timeline project model.
- Remotion templates and visual provider registry.
- historical map / globe template assets.

Existing files:

- `scripts/asset-indexer.mjs`
- `scripts/asset-matcher.mjs`
- `scripts/visual-resolver.mjs`
- `scripts/evidence-resolver.mjs`
- `scripts/scene-planner.mjs`
- `scripts/project-store.mjs`
- `src/templates/`
- `src/video-infrastructure/`
- `asset-source/`

Not active yet:

- production vector DB integration.
- production CLIP/SigLIP embedding worker.
- video shot detection.
- frame-level OCR.
- ASR material understanding.
- Qwen-VL frame captioning.
- LLM reranking.
- automatic B-roll timeline optimization.

P0 active skeleton:

- `services/material-vector-search/` exposes LanceDB-backed vector search.
- `MATERIAL_EMBEDDING_BACKEND=hash` is wiring-only.
- `MATERIAL_EMBEDDING_BACKEND=sentence-transformers` is the first real local embedding path.

## API And Registration Policy

Default development should not require a new external API:

- local asset indexer: no registration.
- local Remotion rendering: no registration.
- local vector DB such as LanceDB: no registration.
- local CLIP/SigLIP/OpenCLIP: no provider account, but model download and compute are required.

External accounts are only needed for:

- DashScope TTS, already represented by `QWEN3_TTS_DASHSCOPE_API_KEY`.
- OpenAI-compatible embedding if we choose a hosted/private gateway.
- Qwen-VL cloud captioning if we do not self-host.
- TwelveLabs/VideoDB hosted video understanding if self-hosted retrieval is insufficient.

Secrets must stay in `.env.local`, server env files or provider secret stores. They must not enter Git, README examples with real values, screenshots, logs or generated project JSON.

## Target Data Contracts

`ShotPlan`:

```json
{
  "id": "shot-001",
  "text": "凌晨三点的上海依旧灯火通明",
  "visualNeed": "night city skyline, traffic, neon, lonely mood",
  "assetTypes": ["video", "image"],
  "durationMs": 4500,
  "mustNotShow": ["daytime", "ancient city"],
  "fallback": "procedural animation"
}
```

`TimelineScene`:

```json
{
  "id": "scene-001",
  "startMs": 0,
  "durationMs": 4500,
  "assetId": "asset-id",
  "clipId": "clip-id",
  "path": "footage/city-night.mp4",
  "fallbackUsed": false,
  "remotion": {
    "component": "FootageScene",
    "props": {}
  }
}
```

`VectorSearchResult`:

```json
{
  "assetId": "asset-id",
  "clipId": "optional-clip-id",
  "score": 0.82,
  "path": "footage/city-night.mp4",
  "assetType": "video",
  "startMs": 2000,
  "endMs": 6500,
  "metadata": {}
}
```

## Operating Principles

- The system is evidence-first when rendering historical or factual content.
- Use real documents, portraits, maps and footage before generated visuals.
- Mark fallback visuals explicitly.
- Do not let a file browser become a CMS.
- Do not let vector search become metadata truth.
- Do not hand-roll vector DB, media sync or rendering engines when mature systems exist.
- Keep this repo responsible for timeline orchestration, Remotion composition, project editing and render output.

## Next Implementation Order

1. Define `ShotPlan`, `TimelineScene` and `VectorSearchResult` schemas in code.
2. Add LanceDB/OpenCLIP proof of concept behind `asset-matcher`.
3. Add frame extraction for video assets.
4. Store frame/clip-level rows in a vector DB.
5. Add script-to-shot JSON generation with explicit `visualNeed`.
6. Add heuristic reranking and continuity scoring.
7. Connect vector results to `visual-resolver` and `project-store`.
8. Evaluate Milvus/Towhee only after LanceDB becomes a bottleneck.
