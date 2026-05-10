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
| `npm run dev:video` | Start Remotion Studio plus FuckVideo generation UI/proxy. |
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
| `3057` | Studio proxy entry for `npm run dev:video`. |
| `3037` | Local video generation API server. |
| Remotion default | Used by plain Remotion Studio when not proxied. |

## Primary Workflow

```text
npm run dev:video
  -> open http://127.0.0.1:3057
  -> click Generate Video
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

Studio does not show generation UI:

- Use `npm run dev:video`, not plain `npm run dev`.
- Open `http://127.0.0.1:3057`.
- Check `remotion-studio.out.log` and `remotion-services.out.log`.

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

Then set:

```env
MATERIAL_VECTOR_SEARCH_URL=http://127.0.0.1:4141
```
