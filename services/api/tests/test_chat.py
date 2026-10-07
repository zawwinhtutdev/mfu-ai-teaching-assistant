"""Chat endpoint tests — run entirely offline via the stub provider."""

from __future__ import annotations

import json

import jwt
import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.db import get_session
from app.main import app
from app.providers.factory import get_provider
from app.providers.gemini import GeminiProvider
from app.providers.stub import StubProvider

client = TestClient(app)

SECRET = "test-secret-value-that-is-long-enough-for-hs256"


def _override() -> Settings:
    return Settings(
        supabase_url="https://project.supabase.co",
        supabase_anon_key="anon",
        supabase_jwt_secret=SECRET,
        jwt_audience="authenticated",
        gemini_api_key="",
        ai_provider="stub",
    )


def _token() -> str:
    return jwt.encode(
        {"sub": "user-1", "aud": "authenticated", "email": "s@mfu.ac.th"},
        SECRET,
        algorithm="HS256",
    )


def _events(body: str) -> list[dict[str, object]]:
    events: list[dict[str, object]] = []
    for line in body.splitlines():
        if not line.startswith("data: "):
            continue
        payload = line[6:]
        if payload == "[DONE]":
            break
        events.append(json.loads(payload))
    return events


@pytest.fixture(autouse=True)
def _clear_overrides() -> None:
    app.dependency_overrides[get_settings] = _override
    # Retrieval is covered by the DB integration tests; keep these hermetic.
    app.dependency_overrides[get_session] = lambda: None
    yield
    app.dependency_overrides.clear()


def _post(payload: dict[str, object]) -> object:
    return client.post(
        "/v1/chat",
        json=payload,
        headers={"Authorization": f"Bearer {_token()}"},
    )


def test_chat_requires_authentication() -> None:
    response = client.post("/v1/chat", json={"messages": [{"role": "user", "content": "hi"}]})
    assert response.status_code == 401


def test_empty_messages_rejected() -> None:
    response = _post({"messages": []})
    assert response.status_code == 422


def test_stream_is_sse_and_ordered() -> None:
    response = _post({"messages": [{"role": "user", "content": "What is the late policy?"}]})
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")

    events = _events(response.text)
    assert events[0]["type"] == "sources"
    starts = [e for e in events if e["type"] == "start"]
    assert starts and starts[0]["provider"] == "stub"
    assert events[-1]["type"] == "done"
    assert all(e["type"] in {"sources", "start", "delta", "done"} for e in events)


def test_stub_stream_contains_echoed_question() -> None:
    response = _post({"messages": [{"role": "user", "content": "What is the late policy?"}]})
    text = "".join(str(e["text"]) for e in _events(response.text) if e["type"] == "delta")
    assert "[stub]" in text
    assert "What is the late policy?" in text


def test_ai_sdk_parts_are_normalized() -> None:
    response = _post(
        {
            "messages": [
                {
                    "role": "user",
                    "parts": [{"type": "text", "text": "hello from parts"}],
                }
            ]
        }
    )
    assert response.status_code == 200
    text = "".join(str(e["text"]) for e in _events(response.text) if e["type"] == "delta")
    assert "hello from parts" in text


def test_stream_terminates_with_done_sentinel() -> None:
    response = _post({"messages": [{"role": "user", "content": "hi"}]})
    assert response.text.rstrip().endswith("data: [DONE]")


def test_provider_selection_explicit_stub() -> None:
    provider = get_provider(_override())
    assert isinstance(provider, StubProvider)


def test_provider_selection_with_key_is_gemini() -> None:
    settings = Settings(
        supabase_url="https://project.supabase.co",
        gemini_api_key="fake-key",
        chat_model="gemini-2.5-flash",
        ai_provider="gemini",
    )
    provider = get_provider(settings)
    assert isinstance(provider, GeminiProvider)
    assert provider.model == "gemini-2.5-flash"


def test_provider_selection_honours_model_override() -> None:
    settings = Settings(
        supabase_url="https://project.supabase.co",
        gemini_api_key="fake-key",
        ai_provider="gemini",
    )
    provider = get_provider(settings, model="gemini-2.5-pro")
    assert isinstance(provider, GeminiProvider)
    assert provider.model == "gemini-2.5-pro"
