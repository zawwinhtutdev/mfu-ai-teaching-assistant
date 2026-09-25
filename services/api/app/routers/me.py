"""Identity endpoints backed by the verified Supabase session."""

from __future__ import annotations

from fastapi import APIRouter

from app.auth import CurrentPrincipal

router = APIRouter(tags=["auth"])


@router.get("/me", summary="Return the verified caller")
def me(principal: CurrentPrincipal) -> dict[str, object]:
    return {
        "subject": principal.subject,
        "email": principal.email,
        "role": principal.role,
    }
