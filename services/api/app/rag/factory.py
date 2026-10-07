"""Embedding provider selection."""

from __future__ import annotations

from app.config import Settings
from app.rag.embeddings import EmbeddingProvider, GeminiEmbeddings, StubEmbeddings
from app.rag.ollama_embeddings import OllamaEmbeddings


def get_embedder(settings: Settings) -> EmbeddingProvider:
    provider = settings.resolved_provider
    if provider == "gemini" and settings.ai_api_key:
        return GeminiEmbeddings(settings.ai_api_key, model=settings.embedding_model)
    if provider == "ollama":
        return OllamaEmbeddings(
            base_url=settings.ollama_base_url,
            model=settings.ollama_embedding_model,
        )
    return StubEmbeddings()
