# Material Seed Schema

This document defines the JSONL bridge between the TypeScript material index and Python vector/ML sidecars.

## Purpose

`material-seed.jsonl` is the stable input for embedding workers. It is derived from `public/generated/asset-index.json` and does not own source files, timeline truth or metadata authority.

## Location

```text
public/generated/material-seed.jsonl
public/generated/material-seed-summary.json
```

These files are generated artifacts. They may be regenerated locally and by CI jobs.

## Row Shape

Each line is a JSON object:

```json
{
  "id": "city-night:shot-001",
  "assetId": "city-night",
  "shotId": "city-night:shot-001",
  "source": "asset-index",
  "assetType": "footage",
  "path": "footage/city-night.mp4",
  "title": "city night",
  "startMs": 0,
  "endMs": 4200,
  "indexText": "city night | 深夜城市 | 高楼 | 车流 | 霓虹",
  "metadata": {
    "kind": "atmosphere",
    "tags": ["城市", "夜景"],
    "bestFor": ["urban_opening"],
    "avoidFor": [],
    "mustNotShow": [],
    "license": "local"
  }
}
```

Required:

- `id`
- `assetId`
- `source`
- `assetType`
- `path`
- `indexText`
- `metadata`

Optional:

- `shotId`
- `startMs`
- `endMs`
- `title`

## Boundary

- TypeScript generates seed rows.
- Python sidecars read seed rows and write embeddings/vector DB rows.
- Python sidecars return `VectorSearchResult` rows.
- `visual-resolver.mjs` remains the integration point for candidate selection.
