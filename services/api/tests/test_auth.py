"""Authentication tests.

Covers the rejection paths plus a happy path using a locally signed HS256 token,
which exercises the same dependency the asymmetric JWKS path uses.
"""

from __future__ import annotations

import jwt
import pytest
from fastapi.testclient import TestClient

from app.config import Settings, get_settings
from app.main import app

client = TestClient(app)

SECRET = "test-secret-value-that-is-long-enough-for-hs256"


def _settings(**overrides: object) -> Settings:
    base = {
        "supabase_url": "https://project.supabase.co",
        "supabase_anon_key": "anon",
        "supabase_jwt_secret": SECRET,
        "jwt_audience": "authenticated",
    }
    base.update(overrides)
    return Settings(**base)


def _override() -> Settings:
    """Zero-argument dependency override (FastAPI inspects the signature)."""
    return _settings()


@pytest.fixture(autouse=True)
def _clear_overrides() -> None:
    yield
    app.dependency_overrides.clear()


def _token(**claims: object) -> str:
    payload = {"sub": "user-1", "email": "student@mfu.ac.th", "aud": "authenticated"}
    payload.update(claims)
    return jwt.encode(payload, SECRET, algorithm="HS256")


def test_missing_token_is_rejected() -> None:
    response = client.get("/v1/me")
    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"


def test_malformed_token_is_rejected() -> None:
    app.dependency_overrides[get_settings] = _override
    response = client.get("/v1/me", headers={"Authorization": "Bearer not-a-jwt"})
    assert response.status_code == 401


def test_token_signed_with_wrong_key_is_rejected() -> None:
    app.dependency_overrides[get_settings] = _override
    wrong = jwt.encode({"sub": "x", "aud": "authenticated"}, "other-secret", algorithm="HS256")
    response = client.get("/v1/me", headers={"Authorization": f"Bearer {wrong}"})
    assert response.status_code == 401


def test_wrong_audience_is_rejected() -> None:
    app.dependency_overrides[get_settings] = _override
    token = _token(aud="some-other-audience")
    response = client.get("/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


def test_expired_token_is_rejected() -> None:
    app.dependency_overrides[get_settings] = _override
    token = jwt.encode(
        {"sub": "user-1", "aud": "authenticated", "exp": 1_000_000_000},
        SECRET,
        algorithm="HS256",
    )
    response = client.get("/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 401


def test_valid_token_returns_principal() -> None:
    app.dependency_overrides[get_settings] = _override
    token = _token(app_metadata={"role": "student"})
    response = client.get("/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    body = response.json()
    assert body == {
        "subject": "user-1",
        "email": "student@mfu.ac.th",
        "role": "student",
    }


def test_role_is_read_from_user_metadata_too() -> None:
    app.dependency_overrides[get_settings] = _override
    token = _token(user_metadata={"role": "teacher"})
    response = client.get("/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["role"] == "teacher"
