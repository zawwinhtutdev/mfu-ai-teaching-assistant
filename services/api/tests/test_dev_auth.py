"""The local-only dev auth path must be narrow and impossible in production."""

from __future__ import annotations

import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.db import get_session
from app.main import app

client = TestClient(app)


def _settings(**overrides: object) -> Settings:
    base = {
        "supabase_url": "https://project.supabase.co",
        "supabase_jwt_secret": "",
        "environment": "local",
        "allow_insecure_dev_auth": True,
        "ai_provider": "stub",
    }
    base.update(overrides)
    return Settings(**base)


@pytest.fixture(autouse=True)
def _clear_overrides() -> None:
    app.dependency_overrides[get_session] = lambda: None
    yield
    app.dependency_overrides.clear()


def test_dev_auth_is_disabled_by_default() -> None:
    app.dependency_overrides[get_settings] = lambda: _settings(allow_insecure_dev_auth=False)
    response = client.get("/v1/me", headers={"X-Dev-Principal": "demo@mfu.ac.th"})
    assert response.status_code == 401


def test_dev_auth_works_in_local_environment() -> None:
    app.dependency_overrides[get_settings] = lambda: _settings()
    response = client.get("/v1/me", headers={"X-Dev-Principal": "demo@mfu.ac.th"})
    assert response.status_code == 200
    body = response.json()
    assert body["subject"] == "demo@mfu.ac.th"
    assert body["email"] == "demo@mfu.ac.th"


def test_dev_auth_is_refused_in_production() -> None:
    settings = _settings(environment="production")
    assert settings.dev_auth_allowed is False
    app.dependency_overrides[get_settings] = lambda: settings
    response = client.get("/v1/me", headers={"X-Dev-Principal": "demo@mfu.ac.th"})
    assert response.status_code == 401


def test_bearer_token_still_wins_over_dev_header() -> None:
    settings = _settings(supabase_jwt_secret="", environment="local")
    app.dependency_overrides[get_settings] = lambda: settings
    response = client.get(
        "/v1/me",
        headers={"Authorization": "Bearer not-a-jwt", "X-Dev-Principal": "demo@mfu.ac.th"},
    )
    # A malformed bearer token must fail rather than silently fall back.
    assert response.status_code == 401


def test_dev_chat_stream_uses_stub() -> None:
    app.dependency_overrides[get_settings] = lambda: _settings(gemini_api_key="")
    response = client.post(
        "/v1/chat",
        json={"messages": [{"role": "user", "content": "hello"}]},
        headers={"X-Dev-Principal": "demo@mfu.ac.th"},
    )
    assert response.status_code == 200
    assert '"provider":"stub"' in response.text.replace(" ", "")
