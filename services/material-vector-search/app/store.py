import json
from pathlib import Path
from typing import Any

import lancedb

from .embeddings import VECTOR_DIMENSIONS, embed_text


TABLE_NAME = "material_shots"


def open_table(db_path: str):
    db = lancedb.connect(db_path)
    if TABLE_NAME in db.table_names():
        return db.open_table(TABLE_NAME)
    return db.create_table(TABLE_NAME, data=[empty_row()])


def ingest_seed(seed_path: str, db_path: str) -> dict[str, Any]:
    rows = []
    for line in Path(seed_path).read_text(encoding="utf-8").splitlines():
        if not line.strip():
            continue
        seed = json.loads(line)
        rows.append(vector_row(seed))

    table = open_table(db_path)
    if rows:
        table.add(rows)

    return {
        "seedPath": seed_path,
        "dbPath": db_path,
        "table": TABLE_NAME,
        "rowCount": len(rows),
    }


def search(db_path: str, query: str, asset_types: list[str] | None = None, limit: int = 8) -> list[dict[str, Any]]:
    table = open_table(db_path)
    rows = table.search(embed_text(query)).limit(max(1, min(int(limit or 8), 50))).to_list()
    allowed = {item for item in asset_types or [] if item}
    matches = []

    for row in rows:
        if row.get("id") == "__empty__":
            continue
        if allowed and row.get("assetType") not in allowed:
            continue
        metadata = row.get("metadata")
        if isinstance(metadata, str):
            metadata = json.loads(metadata or "{}")
        matches.append({
            "assetId": row.get("assetId", ""),
            "clipId": row.get("shotId", ""),
            "score": float(row.get("_distance", 0)),
            "path": row.get("path", ""),
            "assetType": row.get("assetType", "unknown"),
            "startMs": row.get("startMs"),
            "endMs": row.get("endMs"),
            "metadata": metadata or {},
        })
        if len(matches) >= limit:
            break
    return matches


def vector_row(seed: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(seed.get("id", "")),
        "assetId": str(seed.get("assetId", "")),
        "shotId": str(seed.get("shotId", "")),
        "source": str(seed.get("source", "")),
        "assetType": str(seed.get("assetType", "unknown")),
        "path": str(seed.get("path", "")),
        "title": str(seed.get("title", "")),
        "startMs": float(seed.get("startMs") or 0),
        "endMs": float(seed.get("endMs") or 0),
        "indexText": str(seed.get("indexText", "")),
        "metadata": json.dumps(seed.get("metadata") or {}, ensure_ascii=False),
        "vector": embed_text(str(seed.get("indexText", ""))),
    }


def empty_row() -> dict[str, Any]:
    return {
        "id": "__empty__",
        "assetId": "",
        "shotId": "",
        "source": "bootstrap",
        "assetType": "unknown",
        "path": "",
        "title": "",
        "startMs": 0.0,
        "endMs": 0.0,
        "indexText": "",
        "metadata": "{}",
        "vector": [0.0] * VECTOR_DIMENSIONS,
    }
