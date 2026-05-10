# Language Boundary

This document defines the TypeScript/Python split for FuckVideo.

## Decision

FuckVideo is a TypeScript-first Remotion repository with Python sidecars for model-heavy material understanding.

```text
TypeScript / Node
  -> Remotion compositions
  -> Studio plugin
  -> project-store
  -> scene planning
  -> visual resolver
  -> timeline contracts
  -> render orchestration

Python sidecars
  -> CLIP / SigLIP / OpenCLIP embeddings
  -> Whisper / faster-whisper ASR
  -> OCR pipelines
  -> Qwen-VL / vision model adapters
  -> frame extraction and ML preprocessing
  -> LanceDB / Milvus ingestion workers when the Python ecosystem is clearly stronger
```

## Why TypeScript Owns The Core

The product core is Remotion and the editable video project workflow. That makes TypeScript the right default for:

- React / Remotion composition code.
- Remotion schema/defaultProps.
- Studio plugin integration.
- local video generation API scripts.
- timeline JSON validation and repair.
- `project-store.mjs`.
- `scene-planner.mjs`.
- `visual-resolver.mjs`.
- `asset-matcher.mjs` handoff.
- frontend/editor state.

Keeping this core in TypeScript avoids splitting timeline behavior across two runtimes and keeps preview, editing and rendering close to Remotion's native ecosystem.

## Why Python Owns Model Sidecars

Material understanding depends on libraries that are stronger and better maintained in Python:

- PyTorch model loading.
- CLIP / SigLIP / OpenCLIP.
- Whisper / faster-whisper.
- OCR stacks.
- video frame preprocessing.
- model batching.
- GPU device management.
- many vector ingestion recipes.

Putting these in sidecars avoids forcing Remotion's Node process to own ML dependencies, native wheels, GPU setup or long-running embedding jobs.

## Boundary Rules

- TypeScript owns timeline truth.
- Python owns derived ML outputs.
- Python must emit JSON/JSONL contracts defined in `docs/contracts/video-project-schema.md` or future material schemas.
- Python must not directly mutate `.runtime/video-projects/*.json` unless called through an explicit project-store API.
- Python must not bypass `visual-resolver.mjs`.
- TypeScript must not hand-roll CLIP, Whisper or OCR when mature Python libraries exist.
- Large vectors, frame caches and model artifacts are runtime data and must not be committed to Git.

## Allowed Cross-Runtime Handoff

Preferred handoff formats:

- JSON.
- JSONL.
- local HTTP API.
- local file paths under explicit runtime/cache directories.

Examples:

```text
TypeScript asset indexer
  -> material seed JSONL
  -> Python embedding worker
  -> vector DB
  -> TypeScript visual-resolver query
  -> TimelineScene
```

```text
Python ASR worker
  -> captions JSON/SRT
  -> TypeScript project-store timeline repair
  -> Remotion props
```

## Bot Policy By Language

- `pre-commit-ci[bot]` may run both TypeScript and Python formatting checks.
- `sourcery-ai[bot]` should stay comment-only by default.
- If a Python sidecar becomes substantial, Sourcery may be allowed on that sidecar only, not on timeline contracts or TypeScript orchestration.
- Automated refactors must not alter `ShotPlan`, `TimelineScene`, `VectorSearchResult`, visual provider decisions or project JSON semantics without human review.

## Future Re-evaluation

This decision should be revisited only if:

- Remotion stops being the render/edit core.
- the project moves to a Python-native video editor instead of Remotion.
- model-side services become an independent repository.
- TypeScript ML libraries become mature enough to replace the Python sidecar with lower operational cost.
