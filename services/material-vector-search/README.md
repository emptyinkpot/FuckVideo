# Material Vector Search Service

Python sidecar for material semantic retrieval.

Status: source skeleton only. The default embedding backend is deterministic `hash` for wiring tests. Use the optional `sentence-transformers` backend for real CLIP/SigLIP-style embeddings before judging retrieval quality.

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

## Real Embeddings

Default wiring mode:

```console
MATERIAL_EMBEDDING_BACKEND=hash
```

Real local model mode:

```console
pip install -r requirements-ml.txt
MATERIAL_EMBEDDING_BACKEND=sentence-transformers
MATERIAL_EMBEDDING_MODEL=sentence-transformers/clip-ViT-B-32
python -m app.ingest --seed ../../public/generated/material-seed.jsonl --db .runtime/lancedb
```

`requirements-ml.txt` is intentionally separate because PyTorch/model dependencies are heavier than the API/LanceDB skeleton. Keep the TypeScript/Remotion workflow usable without installing ML packages.

Hosted/OpenAI-compatible API mode:

```console
MATERIAL_EMBEDDING_BACKEND=openai-compatible
MATERIAL_EMBEDDING_API_BASE_URL=https://api.openai.com/v1
MATERIAL_EMBEDDING_API_MODEL=text-embedding-3-small
MATERIAL_EMBEDDING_DIMENSIONS=384
MATERIAL_EMBEDDING_API_KEY_ENV=OPENAI_API_KEY
OPENAI_API_KEY=<your-key>
python -m app.ingest --seed ../../public/generated/material-seed.jsonl --db .runtime/lancedb
```

The API backend intentionally uses an OpenAI-compatible `/embeddings` contract. It can point at OpenAI, an OpenAI-compatible gateway, or a self-hosted proxy by changing `MATERIAL_EMBEDDING_API_BASE_URL`, `MATERIAL_EMBEDDING_API_MODEL` and `MATERIAL_EMBEDDING_API_KEY_ENV`.

The committed default model is OpenAI `text-embedding-3-small`; OpenAI documents custom `dimensions` support for `text-embedding-3` and later embedding models. Other compatible providers may ignore or reject that field, so set dimensions according to the selected provider and rebuild the index.

Do not reuse a LanceDB table across embedding dimensions. If the model or dimensions change, rebuild `.runtime/lancedb`.

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
