"""Ollama provider: payloads, stream parsing, embedding extraction, selection."""

from __future__ import annotations

import math

import pytest

from app.config import Settings
from app.providers.factory import get_provider
from app.providers.ollama import OllamaError, OllamaProvider, build_payload, parse_stream_line
from app.providers.stub import StubProvider
from app.rag.factory import get_embedder
from app.rag.ollama_embeddings import (
    EmbeddingError,
    OllamaEmbeddings,
    extract_embeddings,
)
from app.schemas import ChatMessage


class TestPayload:
    def test_messages_are_mapped(self) -> None:
        payload = build_payload(
            "qwen2.5:7b",
            [
                ChatMessage(role="system", content="be brief"),
                ChatMessage(role="user", content="hello"),
            ],
        )
        assert payload["model"] == "qwen2.5:7b"
        assert payload["stream"] is True
        assert payload["messages"] == [
            {"role": "system", "content": "be brief"},
            {"role": "user", "content": "hello"},
        ]

    def test_empty_messages_dropped(self) -> None:
        payload = build_payload("m", [ChatMessage(role="user", content="")])
        assert payload["messages"] == []


class TestStreamParsing:
    def test_extracts_content_delta(self) -> None:
        line = '{"message":{"role":"assistant","content":"Hel"},"done":false}'
        assert parse_stream_line(line) == "Hel"

    def test_done_line_yields_nothing(self) -> None:
        assert parse_stream_line('{"done":true}') is None

    def test_blank_line_yields_nothing(self) -> None:
        assert parse_stream_line("   ") is None

    def test_invalid_json_is_ignored(self) -> None:
        assert parse_stream_line("not json") is None

    def test_error_line_raises(self) -> None:
        with pytest.raises(OllamaError):
            parse_stream_line('{"error":"model not found"}')

    def test_empty_content_yields_nothing(self) -> None:
        assert parse_stream_line('{"message":{"content":""},"done":false}') is None


class TestEmbeddingExtraction:
    def test_vectors_are_normalised(self) -> None:
        vectors = extract_embeddings({"embeddings": [[3.0, 4.0]]}, expected=1)
        assert len(vectors[0]) == 2
        assert abs(math.hypot(*vectors[0]) - 1.0) < 1e-9

    def test_count_mismatch_raises(self) -> None:
        with pytest.raises(EmbeddingError):
            extract_embeddings({"embeddings": [[1.0]]}, expected=2)

    def test_missing_field_raises(self) -> None:
        with pytest.raises(EmbeddingError):
            extract_embeddings({}, expected=1)


class TestSelection:
    def test_auto_without_key_prefers_ollama(self) -> None:
        settings = Settings(ai_provider="auto", gemini_api_key="")
        assert settings.resolved_provider == "ollama"

    def test_auto_with_key_prefers_gemini(self) -> None:
        settings = Settings(ai_provider="auto", gemini_api_key="key")
        assert settings.resolved_provider == "gemini"

    def test_explicit_stub(self) -> None:
        settings = Settings(ai_provider="stub", gemini_api_key="key")
        assert settings.resolved_provider == "stub"
        assert isinstance(get_provider(settings), StubProvider)

    def test_chat_provider_is_ollama(self) -> None:
        settings = Settings(ai_provider="ollama", ollama_model="qwen2.5:7b")
        provider = get_provider(settings)
        assert isinstance(provider, OllamaProvider)
        assert provider.model == "qwen2.5:7b"

    def test_embedder_is_ollama_with_dim_768(self) -> None:
        settings = Settings(ai_provider="ollama")
        embedder = get_embedder(settings)
        assert isinstance(embedder, OllamaEmbeddings)
        assert embedder.dim == 768

    def test_model_override_wins(self) -> None:
        settings = Settings(ai_provider="ollama", ollama_model="qwen2.5:7b")
        provider = get_provider(settings, model="llama3.2:3b")
        assert isinstance(provider, OllamaProvider)
        assert provider.model == "llama3.2:3b"
