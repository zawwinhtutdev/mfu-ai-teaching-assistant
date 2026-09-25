"""Ops endpoint tests — no credentials required."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_is_ok() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ok"
    assert body["service"] == "ata-api"


def test_root_lists_docs() -> None:
    response = client.get("/")
    assert response.status_code == 200
    assert response.json()["docs"] == "/docs"


def test_openapi_schema_is_served() -> None:
    response = client.get("/openapi.json")
    assert response.status_code == 200
    paths = response.json()["paths"]
    assert "/health" in paths
    assert "/v1/me" in paths


def test_ready_reports_checks() -> None:
    response = client.get("/ready")
    body = response.json()
    assert "checks" in body
    assert set(body["checks"]) == {"supabase_url", "token_verification"}
