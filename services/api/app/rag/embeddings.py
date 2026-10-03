"""Embedding providers.

Two implementations:

* ``GeminiEmbeddings`` — the real model (768 dimensions, matching the schema).
* ``StubEmbeddings`` — a hashing vectorizer that needs no network or key.

The stub is not a semantic model, but it is not random either: tokens hash into
fixed dimensions, so lexically related text really does score higher. That makes
the whole retrieval path testable offline while keeping the same shape as the
real provider.
"""

from __future__ import annotations

import hashlib
import math
import re
from collections.abc import Sequence
from typing import Protocol

import httpx

TOKEN_RE = re.compile(r"[a-z0-9]+")
EMBEDDING_DIM = 768


class EmbeddingProvider(Protocol):
    name: str
    dim: int

    async def embed(self, texts: Sequence[str]) -> list[list[float]]:
        """Return one unit-length vector per input text."""
        ...

    async def embed_query(self, text: str) -> list[float]:
        """Embed a search query (different task type from documents)."""
        ...


def _normalise(vector: list[float]) -> list[float]:
    norm = math.sqrt(sum(v * v for v in vector))
    if norm == 0:
        return vector
    return [v / norm for v in vector]


class StubEmbeddings:
    """Deterministic hashing embedder with the same dimension as the real one."""

    name = "stub-hashing"
    dim = EMBEDDING_DIM

    async def embed(self, texts: Sequence[str]) -> list[list[float]]:
        return [self._embed_one(text) for text in texts]

    async def embed_query(self, text: str) -> list[float]:
        return self._embed_one(text)

    def _embed_one(self, text: str) -> list[float]:
        vector = [0.0] * self.dim
        tokens = TOKEN_RE.findall(text.lower())
        if not tokens:
            return vector

        for token in tokens:
            digest = hashlib.sha256(token.encode("utf-8")).digest()
            index = int.from_bytes(digest[:4], "big") % self.dim
            sign = 1.0 if digest[4] % 2 == 0 else -1.0
            vector[index] += sign

        return _normalise(vector)


class GeminiEmbeddings:
    """Gemini embedding model via the REST API."""

    name = "gemini"

    def __init__(
        self,
        api_key: str,
        model: str = "text-embedding-004",
        dim: int = EMBEDDING_DIM,
        timeout_s: float = 60.0,
    ) -> None:
        self._api_key = api_key
        self.model = model
        self.dim = dim
        self._timeout = timeout_s

    async def embed(self, texts: Sequence[str]) -> list[list[float]]:
        return await self._embed_batch(texts, task_type="RETRIEVAL_DOCUMENT")

    async def embed_query(self, text: str) -> list[float]:
        vectors = await self._embed_batch([text], task_type="RETRIEVAL_QUERY")
        return vectors[0]

    async def _embed_batch(
        self, texts: Sequence[str], task_type: str
    ) -> list[list[float]]:
        if not texts:
            return []

        url = f"https://generativelanguage.googleapis.com/v1beta/models/{self.model}:batchEmbedContents"
        requests = [
            {
                "model": f"models/{self.model}",
                "content": {"parts": [{"text": text}]},
                "taskType": task_type,
            }
            for text in texts
        ]

        async with httpx.AsyncClient(timeout=self._timeout) as client:
            response = await client.post(
                url,
                params={"key": self._api_key},
                json={"requests": requests},
            )

        if response.status_code != 200:
            raise EmbeddingError(
                f"Embedding request failed ({response.status_code}): "
                f"{response.text[:300]}"
            )

        payload = response.json()
        vectors = [item["values"] for item in payload.get("embeddings", [])]
        if len(vectors) != len(texts):
            raise EmbeddingError("Embedding response count did not match input count")
        return [_normalise([float(v) for v in vector]) for vector in vectors]


class EmbeddingError(RuntimeError):
    """Raised when an embedding call fails."""
