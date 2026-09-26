"""Local embeddings via Ollama.

``nomic-embed-text`` produces 768 dimensions — the same width as the
``document_chunks.embedding`` column, so no migration is needed.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from typing import Any, Protocol

import httpx


class EmbeddingError(RuntimeError):
    """Raised when the local embedding call fails."""


class Embedder(Protocol):
    name: str
    dim: int

    async def embed(self, texts: Sequence[str]) -> list[list[float]]: ...

    async def embed_query(self, text: str) -> list[float]: ...


def normalise(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(value * value for value in vector))
    if norm == 0:
        return vector
    return [value / norm for value in vector]


def extract_embeddings(payload: dict[str, Any], expected: int) -> list[list[float]]:
    embeddings = payload.get("embeddings")
    if not isinstance(embeddings, list) or len(embeddings) != expected:
        raise EmbeddingError(
            f"Ollama returned {len(embeddings) if isinstance(embeddings, list) else 'no'} "
            f"embeddings for {expected} inputs"
        )
    return [normalise([float(value) for value in vector]) for vector in embeddings]


class OllamaEmbeddings:
    name = "ollama"

    def __init__(
        self,
        base_url: str = "http://127.0.0.1:11434",
        model: str = "nomic-embed-text",
        dim: int = 768,
        timeout_s: float = 120.0,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self.model = model
        self.dim = dim
        self._timeout = timeout_s

    async def embed(self, texts: Sequence[str]) -> list[list[float]]:
        if not texts:
            return []
        payload = await self._post(list(texts))
        return extract_embeddings(payload, len(texts))

    async def embed_query(self, text: str) -> list[float]:
        vectors = await self.embed([text])
        return vectors[0]

    async def _post(self, inputs: list[str]) -> dict[str, Any]:
        url = f"{self._base_url}/api/embed"
        timeout = httpx.Timeout(self._timeout, connect=5.0)
        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(url, json={"model": self.model, "input": inputs})

        if response.status_code != 200:
            raise EmbeddingError(
                f"Ollama embed returned {response.status_code}: {response.text[:300]}. "
                f"Is `ollama pull {self.model}` done?"
            )
        data: dict[str, Any] = response.json()
        return data
