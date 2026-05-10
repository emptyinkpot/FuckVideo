import hashlib
import json
import math
import os
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from typing import Iterable


DEFAULT_VECTOR_DIMENSIONS = 384
VECTOR_DIMENSIONS = DEFAULT_VECTOR_DIMENSIONS
_MODEL = None


def embed_text(text: str, dimensions: int | None = None) -> list[float]:
    backend = embedding_backend()
    if backend in {"sentence-transformers", "sentence_transformers", "st"}:
        return embed_text_sentence_transformers(text)
    if backend in {"openai", "openai-compatible", "openai_compatible", "api"}:
        return embed_text_openai_compatible(text)
    return embed_text_hash(text, dimensions or embedding_dimensions())


def embedding_backend() -> str:
    return os.environ.get("MATERIAL_EMBEDDING_BACKEND", "hash").strip().lower() or "hash"


def embedding_model_name() -> str:
    if embedding_backend() in {"openai", "openai-compatible", "openai_compatible", "api"}:
        return os.environ.get("MATERIAL_EMBEDDING_API_MODEL", "text-embedding-3-small").strip()
    return os.environ.get("MATERIAL_EMBEDDING_MODEL", "sentence-transformers/clip-ViT-B-32").strip()


def embedding_dimensions() -> int:
    return int(os.environ.get("MATERIAL_EMBEDDING_DIMENSIONS", DEFAULT_VECTOR_DIMENSIONS))


def embedding_status() -> dict[str, str | int]:
    backend = embedding_backend()
    return {
        "backend": backend,
        "model": embedding_model_name() if backend != "hash" else "hash-placeholder",
        "dimensions": embedding_dimensions(),
        "apiBaseUrl": embedding_api_base_url() if backend in {"openai", "openai-compatible", "openai_compatible", "api"} else "",
        "apiKeyEnv": embedding_api_key_env() if backend in {"openai", "openai-compatible", "openai_compatible", "api"} else "",
    }


def embed_text_hash(text: str, dimensions: int = DEFAULT_VECTOR_DIMENSIONS) -> list[float]:
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


def embed_text_openai_compatible(text: str) -> list[float]:
    api_key = embedding_api_key()
    if not api_key:
        raise RuntimeError(
            f"MATERIAL_EMBEDDING_BACKEND=openai-compatible requires `{embedding_api_key_env()}` "
            "or `MATERIAL_EMBEDDING_API_KEY` in the server environment."
        )

    payload = {
        "model": embedding_model_name(),
        "input": str(text or " "),
        "encoding_format": "float",
    }
    dimensions = embedding_dimensions()
    if dimensions > 0:
        payload["dimensions"] = dimensions

    request = Request(
        f"{embedding_api_base_url().rstrip('/')}/embeddings",
        data=json.dumps(payload).encode("utf-8"),
        headers=embedding_api_headers(api_key),
        method="POST",
    )

    try:
        with urlopen(request, timeout=embedding_api_timeout_seconds()) as response:
            body = response.read().decode("utf-8")
    except HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Embedding API request failed with HTTP {error.code}: {detail}") from error

    data = json.loads(body)
    vector = data.get("data", [{}])[0].get("embedding")
    if not isinstance(vector, list) or not vector:
        raise RuntimeError("Embedding API response did not include data[0].embedding.")
    return [float(value) for value in vector]


def embedding_api_base_url() -> str:
    return os.environ.get("MATERIAL_EMBEDDING_API_BASE_URL", "https://api.openai.com/v1").strip()


def embedding_api_key_env() -> str:
    return os.environ.get("MATERIAL_EMBEDDING_API_KEY_ENV", "OPENAI_API_KEY").strip()


def embedding_api_key() -> str:
    direct = os.environ.get("MATERIAL_EMBEDDING_API_KEY", "").strip()
    if direct:
        return direct
    return os.environ.get(embedding_api_key_env(), "").strip()


def embedding_api_timeout_seconds() -> float:
    return float(os.environ.get("MATERIAL_EMBEDDING_API_TIMEOUT_SECONDS", "30"))


def embedding_api_headers(api_key: str) -> dict[str, str]:
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    organization = os.environ.get("MATERIAL_EMBEDDING_API_ORGANIZATION", "").strip()
    project = os.environ.get("MATERIAL_EMBEDDING_API_PROJECT", "").strip()
    if organization:
        headers["OpenAI-Organization"] = organization
    if project:
        headers["OpenAI-Project"] = project
    return headers


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
