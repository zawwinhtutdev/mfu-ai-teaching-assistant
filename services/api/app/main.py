"""AI Teaching Assistant API service."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import chat, health, me

settings = get_settings()

# Fail fast rather than run a production deployment with dev auth enabled.
if settings.is_production and settings.allow_insecure_dev_auth:
    raise RuntimeError(
        "ALLOW_INSECURE_DEV_AUTH must not be enabled when ENVIRONMENT=production"
    )

app = FastAPI(
    title="AI Teaching Assistant API",
    description=(
        "Service layer for the AI Teaching Assistant platform. "
        "Shares Supabase Auth with the Next.js frontend; this service owns "
        "retrieval and AI orchestration."
    ),
    version=settings.version,
    docs_url="/docs",
    redoc_url=None,
    openapi_url="/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(me.router, prefix="/v1")
app.include_router(chat.router, prefix="/v1")


@app.get("/", include_in_schema=False)
def root() -> dict[str, str]:
    return {
        "service": settings.service_name,
        "version": settings.version,
        "docs": "/docs",
        "health": "/health",
    }
