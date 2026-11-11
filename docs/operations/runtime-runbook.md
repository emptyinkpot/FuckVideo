# Runtime Runbook

This document describes how to run and verify the FuckVideo workspace.

## Required Local Tools

- Node.js 18 or newer.
- npm.
- ffmpeg.
- ffprobe.
- Git LFS for large assets.

Python is optional for the current TypeScript/Remotion workflow. It becomes required only when running material-understanding sidecars such as CLIP/SigLIP embeddings, Whisper ASR, OCR or Qwen-VL adapters.

Check:

```console
node -v
npm -v
ffmpeg -version
ffprobe -version
git lfs version
```

## Install

```console
git clone https://github.com/emptyinkpot/FuckVideo.git
cd FuckVideo
git lfs pull
npm install
```

## Environment

Current TTS provider:

```env
QWEN3_TTS_DASHSCOPE_API_KEY=
```

This key is required only for DashScope TTS narration. Do not commit `.env.local` or real keys.

Local material indexing and Remotion preview do not require a new API key.

## Main Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start plain Remotion Studio. |
| `npm run dev:video` | Start Remotion Studio (:3000) plus the VideoLab API (:3037); this is what `FuckVideo.exe` runs hidden. The FuckVideo workbench is the floating FV button inside Studio. Stop with 设置 -> 关闭 FuckVideo, or Ctrl+C. |
| `npm run videolab` | Run the VideoLab API only (:3037). |
| `npm run verify:upstream` | After a Remotion upgrade: lint + typecheck + one still per composition + workbench smoke inside Studio. |
| `npm run test:videolab` | Workbench smoke test inside Remotion Studio (headless Chrome, no screenshots). |
| `npm run smoke:minimal` | Run minimal pipeline smoke test. |
| `npm run validate-animation-contracts` | Validate visual provider contracts. |
| `npm run index-assets` | Build local asset index from footage. |
| `npm run material:seed` | Build `public/generated/material-seed.jsonl` for Python vector sidecars. |
| `npm run test:material-seed` | Validate material seed generation. |
| `npm run test:material-vector-service` | Validate Python vector sidecar syntax/smoke path. |
| `npm run text-to-video` | Generate video through script path. |
| `npm run export-project` | Export editable project to Remotion props/render flow. |
| `npm run lint` | Run ESLint and TypeScript checks. |

## Language Runtime Split

TypeScript / Node is the default runtime for this repository:

- Remotion Studio
- Studio plugin
- project-store
- scene planning
- visual resolver
- render orchestration

Python is reserved for sidecars where the ML ecosystem is stronger:

- embeddings
- ASR
- OCR
- vision-language captioning
- vector ingestion workers

Do not move timeline truth or Remotion composition logic into Python. Do not force CLIP/Whisper/OCR into Node when mature Python packages are available.

## Ports

| Port | Role |
| --- | --- |
| `3000` | Stock Remotion Studio (nothing injected). |
| `3037` | VideoLab API: generation jobs, projects, shutdown. |

## Primary Workflow

```text
npm run dev:video
  -> open http://localhost:3000 (Remotion Studio)
  -> FV button -> 生成视频
  -> input script
  -> TTS
  -> scene planning
  -> visual resolution
  -> project-store writes .runtime/video-projects/<id>.json
  -> Studio previews MultiSceneVideo
  -> render/export
```

## Verification

Run before merging meaningful changes:

```console
npm run smoke:minimal
npm run validate-animation-contracts
npm run lint
```

For documentation-only changes:

```console
node -e "JSON.parse(require('fs').readFileSync('project.json','utf8')); console.log('project.json ok')"
git diff --check
```

## Troubleshooting

TTS fails:

- Check `QWEN3_TTS_DASHSCOPE_API_KEY`.
- Check network access to DashScope websocket.
- Check generated audio path under `public/generated/`.

Audio duration is wrong:

- Check `ffprobe` is on PATH.
- Rebuild or regenerate the standardized MP3.

The FV workbench button does not appear in Studio:

- It mounts from `src/index.ts` only when `getRemotionEnvironment().isStudio`; check the Studio console for errors.
- Project / generation tabs need the API on :3037 (`npm run dev:video` or `FuckVideo.exe`); `npm run dev` alone starts only Studio.
- Run `npm run test:videolab` to see page errors.

Generated project opens but timeline is wrong:

- Check `.runtime/video-projects/<id>.json`.
- Run through `project-store.mjs` repair/validation path.
- Verify captions cover segment start/end ranges.

Footage does not match:

- Run `npm run index-assets`.
- Inspect `public/generated/asset-index.json`.
- Check that matching is scoped to the current scene, not the full script.

Material vector sidecar:

```console
npm run material:seed
cd services/material-vector-search
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python -m app.ingest --seed ../../public/generated/material-seed.jsonl --db .runtime/lancedb
uvicorn app.main:app --host 127.0.0.1 --port 4141
```

For real local embeddings:

```console
pip install -r requirements-ml.txt
set MATERIAL_EMBEDDING_BACKEND=sentence-transformers
set MATERIAL_EMBEDDING_MODEL=sentence-transformers/clip-ViT-B-32
python -m app.ingest --seed ../../public/generated/material-seed.jsonl --db .runtime/lancedb
```

On Linux/macOS use `export` instead of `set`.

For hosted/OpenAI-compatible embeddings:

```console
set MATERIAL_EMBEDDING_BACKEND=openai-compatible
set MATERIAL_EMBEDDING_API_BASE_URL=https://api.openai.com/v1
set MATERIAL_EMBEDDING_API_MODEL=text-embedding-3-small
set MATERIAL_EMBEDDING_DIMENSIONS=384
set MATERIAL_EMBEDDING_API_KEY_ENV=OPENAI_API_KEY
set OPENAI_API_KEY=<your-key>
python -m app.ingest --seed ../../public/generated/material-seed.jsonl --db .runtime/lancedb
```

Preferred gateway-backed configuration:

```console
set MATERIAL_EMBEDDING_BACKEND=openai-compatible
set MATERIAL_EMBEDDING_API_BASE_URL=https://<private-sub2api-host>/v1
set MATERIAL_EMBEDDING_API_MODEL=<embedding-model-exposed-by-sub2api>
set MATERIAL_EMBEDDING_API_KEY_ENV=SUB2API_API_KEY
set SUB2API_API_KEY=<your-sub2api-key>
python -m app.ingest --seed ../../public/generated/material-seed.jsonl --db .runtime/lancedb
```

`E:\My Project\sub2api` is the upstream AI gateway for hosted provider access. Keep GLM/OpenAI/DashScope provider keys inside sub2api or deployment secret stores when possible; FuckVideo should only need the sub2api-issued key plus the OpenAI-compatible base URL.

Provider knobs:

| Env var | Purpose |
| --- | --- |
| `MATERIAL_EMBEDDING_BACKEND` | `hash`, `sentence-transformers` or `openai-compatible`. |
| `MATERIAL_EMBEDDING_API_BASE_URL` | OpenAI-compatible API base URL. |
| `MATERIAL_EMBEDDING_API_MODEL` | Hosted embedding model name. |
| `MATERIAL_EMBEDDING_DIMENSIONS` | Vector length used by both query and LanceDB table bootstrap. |
| `MATERIAL_EMBEDDING_API_KEY_ENV` | Name of the provider key env var, default `OPENAI_API_KEY`. |
| `MATERIAL_EMBEDDING_API_KEY` | Direct key override for local testing; prefer provider-specific env vars on servers. |
| `MATERIAL_EMBEDDING_API_TIMEOUT_SECONDS` | HTTP timeout for hosted embedding calls. |

The default hosted model is OpenAI `text-embedding-3-small`. OpenAI documents custom `dimensions` support for `text-embedding-3` and later embedding models; other OpenAI-compatible providers may require their own dimensions/model pairing.

Do not commit real keys. Put them in `.env.local`, server environment files or the deployment secret store. If backend/model/dimensions change, delete/rebuild `.runtime/lancedb` before comparing retrieval quality.

Then set:

```env
MATERIAL_VECTOR_SEARCH_URL=http://127.0.0.1:4141
```
