import hashlib
import math
from typing import Iterable


VECTOR_DIMENSIONS = 384


def embed_text(text: str, dimensions: int = VECTOR_DIMENSIONS) -> list[float]:
    vector = [0.0] * dimensions
    for token in tokenize(text):
        digest = hashlib.sha256(token.encode("utf-8")).digest()
        index = int.from_bytes(digest[:4], "big") % dimensions
        sign = 1.0 if digest[4] % 2 == 0 else -1.0
        vector[index] += sign
    return normalize(vector)


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
