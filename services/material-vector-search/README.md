# Material Vector Search Service

Python sidecar for material semantic retrieval.

Status: source skeleton only. The default embedding backend is deterministic `hash` for wiring tests. Replace it with OpenCLIP/SigLIP before judging retrieval quality.

## Inputs

```text
public/generated/material-seed.jsonl
```

Generate it from the repo root:

```console
npm run material:seed
```

## Local Run

```console
cd services/material-vector-search
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python -m app.ingest --seed ../../public/generated/material-seed.jsonl --db .runtime/lancedb
uvicorn app.main:app --host 127.0.0.1 --port 4141
```

## API

```console
curl http://127.0.0.1:4141/health
curl -sS http://127.0.0.1:4141/search \
  -H "content-type: application/json" \
  -d "{\"query\":\"凌晨三点的上海城市夜景\",\"assetTypes\":[\"footage\"],\"limit\":8}"
```

## Boundary

- Python owns derived embeddings and vector retrieval.
- TypeScript owns timeline truth, `visual-resolver.mjs`, `project-store.mjs` and Remotion props.
- The service returns candidates only. It must not directly edit `.runtime/video-projects/*.json`.
