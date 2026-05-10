import os
from typing import Any

from fastapi import FastAPI
from pydantic import BaseModel, Field

from .store import TABLE_NAME, search


DB_PATH = os.environ.get("MATERIAL_VECTOR_DB", ".runtime/lancedb")

app = FastAPI(title="FuckVideo Material Vector Search", version="0.1.0")


class SearchRequest(BaseModel):
    query: str = Field(min_length=1)
    assetTypes: list[str] = Field(default_factory=list)
    limit: int = 8


@app.get("/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "dbPath": DB_PATH,
        "table": TABLE_NAME,
        "embedding": "hash-placeholder",
    }


@app.post("/search")
def search_material(request: SearchRequest) -> dict[str, Any]:
    return {
        "matches": search(DB_PATH, request.query, request.assetTypes, request.limit),
    }
