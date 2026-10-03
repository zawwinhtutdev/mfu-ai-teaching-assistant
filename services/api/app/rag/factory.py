"""Embedding provider selection."""

from __future__ import annotations

from app.config import Settings
from app.rag.embeddings import EmbeddingProvider, GeminiEmbeddings, StubEmbeddings


def get_embedder(settings: Settings) -> EmbeddingProvider:
    if settings.ai_api_key:
        return GeminiEmbeddings(settings.ai_api_key, model=settings.embedding_model)
    return StubEmbeddings()
