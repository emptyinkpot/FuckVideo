# Cloneable Video Understanding Stacks

This document tracks mature systems and libraries that FuckVideo can clone, fork, adapt or use as references.

## Decision Principle

Do not hand-roll mature infrastructure unless the repository only needs thin glue. Prefer proven systems for:

- vector storage
- embedding pipelines
- media ingestion
- ASR/OCR
- workflow orchestration
- render queues

Keep FuckVideo focused on:

- script-to-shot planning
- material retrieval contracts
- Remotion timeline orchestration
- editable project generation
- render output

## Language Choice

Use TypeScript for FuckVideo's core and Python for ML sidecars.

Why TypeScript:

- Remotion is React/TypeScript-native.
- VideoLab (`videolab/ui`, React + `@remotion/player`) and editor state are TypeScript/JavaScript concerns.
- timeline project JSON, `project-store`, `scene-planner` and `visual-resolver` already live in Node.
- keeping orchestration in one runtime reduces drift.

Why Python:

- CLIP/SigLIP/OpenCLIP, Whisper, OCR and Qwen-VL adapters are mature in Python.
- GPU batching, model downloads and vector ingestion recipes are easier in Python.
- Python can run as a sidecar and return JSON/JSONL without owning the Remotion project.

Cloneable stacks should be evaluated with this split in mind: TypeScript integrates contracts and timeline decisions; Python services produce derived ML facts.

## Recommended Adoption Order

### 1. LanceDB + CLIP/SigLIP

Best first step.

Why:

- lightweight
- local/self-hosted
- good fit for a single-server prototype
- easy to connect to `asset-matcher` and `visual-resolver`

Role:

```text
asset/shot rows -> embeddings -> LanceDB -> VectorSearchResult
```

Status: target candidate.

Current P0 implementation:

- `services/material-vector-search/` provides the Python/LanceDB skeleton.
- `pipeline/material-seed.mjs` creates the JSONL input.
- The default embedding is a deterministic hash placeholder for wiring only.
- `MATERIAL_EMBEDDING_BACKEND=sentence-transformers` enables the first real local embedding path.
- `MATERIAL_EMBEDDING_BACKEND=openai-compatible` enables hosted embeddings through a configurable `/embeddings` API.
- First target model: `sentence-transformers/clip-ViT-B-32`; later evaluate SigLIP/OpenCLIP variants.
- Replace the placeholder before evaluating real search quality.

### 2. OpenCLIP / SigLIP

Use for text-image/frame embeddings.

Why:

- no provider registration
- self-hostable
- suitable for frame-level retrieval

Status: target candidate.

### 3. Whisper

Use for ASR over video/audio materials.

Why:

- mature ASR
- useful for documentary and narration-aligned source material

Status: candidate preprocessing stage.

### 4. Qwen-VL / GPT-4o Style Captioning

Use for richer frame understanding.

Why:

- converts visual frames into searchable descriptions
- stronger for Chinese context and historical/factual descriptions when configured correctly

Status: optional understanding layer. Cloud use usually requires API keys; local model server avoids provider registration but needs resources.

### 5. Milvus + Towhee

Use after LanceDB becomes too small.

Why:

- mature vector DB
- Towhee has video-oriented pipelines
- better for larger corpora and service-style deployment

Status: scale-up candidate.

### 6. Weaviate multi2vec-clip

Use if an all-in-one multimodal retrieval service is preferred.

Why:

- built-in multimodal vectorization pattern
- service-oriented deployment

Status: candidate.

### 7. Immich

Reference for media ingestion, thumbnails, metadata and smart search.

Why:

- mature photo/video management product
- useful model for import, indexing, background jobs and media UI

Status: reference/candidate, not a direct replacement for FuckVideo.

### 8. VideoDB / TwelveLabs

Use as reference or paid acceleration path.

Why:

- closest to hosted "video brain" behavior
- semantic search, video Q&A and scene understanding

Status: reference or external API option. Do not make these mandatory for local development.

### 9. Haystack + CLIP

Use as retrieval pipeline reference.

Why:

- mature retrieval abstractions
- useful if the project grows into a broader search/RAG stack

Status: candidate.

### 10. n8n

Use for workflow orchestration only after the core pipeline is stable.

Why:

- good for scheduled ingestion and notification glue
- not a replacement for project-store or Remotion timeline logic

Status: candidate orchestrator.

## Big Company Pattern

Large media and AI video systems typically split the stack:

```text
object storage
  -> media ingestion jobs
  -> metadata database
  -> thumbnails / waveform / preview proxies
  -> ASR / OCR / vision tagging
  -> embedding service
  -> vector DB
  -> search / rerank API
  -> editorial timeline
  -> render queue
  -> review / publish
```

The important lesson is separation of authority:

- object storage owns files
- metadata DB owns curation
- vector DB owns derived retrieval
- timeline store owns edit decisions
- renderer owns output

FuckVideo should follow that split even when the first implementation is small.

## Registration And API Policy

No-registration path:

- local Remotion
- local asset indexing
- LanceDB
- OpenCLIP/SigLIP local model
- Whisper local model

Registration/API-key path:

- DashScope TTS
- OpenAI-compatible hosted embeddings
- Qwen-VL cloud APIs
- TwelveLabs
- VideoDB hosted services

Prefer no-registration local models for the core retrieval loop. Use hosted APIs only when they materially accelerate quality or reduce infrastructure burden.

## Bot Policy

`pre-commit-ci[bot]`:

- recommended for mechanical formatting and cheap checks
- allowed to auto-fix Prettier, ESLint fixable rules, Markdown formatting, JSON/YAML formatting and trailing whitespace
- should not rewrite generated project JSON or large asset manifests without review

`sourcery-ai[bot]`:

- useful mainly for Python code quality
- this repo is primarily TypeScript/Node/Remotion, so keep it comment-only unless a Python subservice is introduced
- if enabled for a Python sidecar, scope it to that sidecar and keep timeline/project contracts protected
- do not allow architecture or timeline behavior rewrites without human review

GitHub Actions:

- should own real quality gates
- should run `npm run smoke:minimal`, `npm run validate-animation-contracts` and `npm run lint` once stable enough
