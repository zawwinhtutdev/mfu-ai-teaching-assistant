"""Ops endpoints: liveness and readiness."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse

from app.config import Settings, get_settings

router = APIRouter(tags=["ops"])

SettingsDep = Annotated[Settings, Depends(get_settings)]


@router.get("/health", summary="Liveness probe")
def health(settings: SettingsDep) -> dict[str, str]:
    return {
        "status": "ok",
        "service": settings.service_name,
        "version": settings.version,
        "environment": settings.environment,
    }


@router.get("/ready", summary="Readiness probe")
def ready(settings: SettingsDep) -> JSONResponse:
    checks = {
        "supabase_url": bool(settings.supabase_url),
        "token_verification": settings.auth_configured,
    }
    ready_now = all(checks.values())
    return JSONResponse(
        status_code=200 if ready_now else 503,
        content={"status": "ok" if ready_now else "degraded", "checks": checks},
    )
