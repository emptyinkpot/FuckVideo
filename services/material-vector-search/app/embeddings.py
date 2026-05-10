import hashlib
import math
import os
from typing import Iterable


VECTOR_DIMENSIONS = 384
_MODEL = None


def embed_text(text: str, dimensions: int = VECTOR_DIMENSIONS) -> list[float]:
    backend = embedding_backend()
    if backend in {"sentence-transformers", "sentence_transformers", "st"}:
        return embed_text_sentence_transformers(text)
    return embed_text_hash(text, dimensions)


def embedding_backend() -> str:
    return os.environ.get("MATERIAL_EMBEDDING_BACKEND", "hash").strip().lower() or "hash"


def embedding_model_name() -> str:
    return os.environ.get("MATERIAL_EMBEDDING_MODEL", "sentence-transformers/clip-ViT-B-32").strip()


def embedding_status() -> dict[str, str | int]:
    return {
        "backend": embedding_backend(),
        "model": embedding_model_name() if embedding_backend() != "hash" else "hash-placeholder",
        "dimensions": int(os.environ.get("MATERIAL_EMBEDDING_DIMENSIONS", VECTOR_DIMENSIONS)),
    }


def embed_text_hash(text: str, dimensions: int = VECTOR_DIMENSIONS) -> list[float]:
    vector = [0.0] * dimensions
    for token in tokenize(text):
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        index = int.from_bytes(digest[:4], "big") % dimensions
        sign = 1.0 if digest[4] % 2 == 0 else -1.0
        vector[index] += sign
    return normalize(vector)


def embed_text_sentence_transformers(text: str) -> list[float]:
    model = get_sentence_transformer()
    vector = model.encode([str(text or "")], normalize_embeddings=True)[0]
    return [float(value) for value in vector.tolist()]


def get_sentence_transformer():
    global _MODEL
    if _MODEL is None:
        try:
            from sentence_transformers import SentenceTransformer
        except ImportError as error:
            raise RuntimeError(
                "MATERIAL_EMBEDDING_BACKEND=sentence-transformers requires "
                "`pip install -r requirements-ml.txt`."
            ) from error
        device = os.environ.get("MATERIAL_EMBEDDING_DEVICE", "").strip() or None
        _MODEL = SentenceTransformer(embedding_model_name(), device=device)
    return _MODEL


def tokenize(text: str) -> Iterable[str]:
    normalized = str(text or "").lower().strip()
    if not normalized:
        return []
    return normalized.replace("|", " ").replace("/", " ").split() or [normalized]


def normalize(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(value * value for value in vector))
    if norm == 0:
        return vector
    return [value / norm for value in vector]
