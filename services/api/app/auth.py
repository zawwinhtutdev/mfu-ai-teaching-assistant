"""Authentication: verify Supabase-issued access tokens.

The web app keeps Supabase Auth (GoTrue) as its identity provider. This service
therefore never issues tokens — it validates the same JWT the browser already
holds, so one session works across both services.

Verification has two modes:

* ``SUPABASE_JWT_SECRET`` set  -> legacy symmetric HS256 project secret.
* otherwise                    -> asymmetric keys fetched from the project JWKS
  (``/auth/v1/.well-known/jwks.json``), which is what current Supabase projects
  use (ES256/RS256).

The JWKS client is cached, so keys are fetched once and reused.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from functools import lru_cache
from typing import Annotated, Any

import jwt
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from jwt.types import Options

from app.config import Settings, get_settings

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class Principal:
    """The authenticated caller, derived only from verified token claims."""

    subject: str
    email: str | None = None
    role: str | None = None
    claims: dict[str, Any] = field(default_factory=dict)


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


@lru_cache
def _jwks_client(jwks_url: str) -> PyJWKClient:
    return PyJWKClient(jwks_url, cache_keys=True, lifespan=300)


def decode_token(token: str, settings: Settings) -> dict[str, Any]:
    """Verify a Supabase access token and return its claims."""
    audience = settings.jwt_audience or None
    options: Options = {"verify_aud": bool(audience)}

    try:
        if settings.supabase_jwt_secret:
            claims: dict[str, Any] = jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience=audience,
                options=options,
            )
            return claims

        # Without a project URL there is no JWKS endpoint to fetch, and pyjwt
        # fails with a generic "signing key could not be resolved". Say what is
        # actually wrong instead of sending the caller hunting through logs.
        if not settings.supabase_url:
            raise _unauthorized(
                "SUPABASE_URL is not configured on the API service, so access tokens "
                "cannot be verified. Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)."
            )

        signing_key = _jwks_client(settings.jwks_url).get_signing_key_from_jwt(token)
        verified: dict[str, Any] = jwt.decode(
            token,
            signing_key.key,
            algorithms=["ES256", "RS256", "EdDSA"],
            audience=audience,
            options=options,
        )
        return verified
    except jwt.PyJWKClientError as exc:
        raise _unauthorized("Token signing key could not be resolved") from exc
    except jwt.InvalidTokenError as exc:
        raise _unauthorized("Invalid or expired token") from exc


def get_principal(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    settings: Annotated[Settings, Depends(get_settings)],
    x_dev_principal: Annotated[str | None, Header()] = None,
) -> Principal:
    """FastAPI dependency yielding the verified caller.

    ``X-Dev-Principal`` is honoured only when ``ALLOW_INSECURE_DEV_AUTH=true``
    *and* the environment is not production. It exists so the local demo can be
    exercised without a Supabase project; it is never a production auth path.
    """
    if credentials is None or credentials.scheme.lower() != "bearer":
        if settings.dev_auth_allowed and x_dev_principal:
            return Principal(
                subject=x_dev_principal,
                email=x_dev_principal if "@" in x_dev_principal else None,
                role="student",
                claims={"dev": True},
            )
        raise _unauthorized("Missing bearer token")

    claims = decode_token(credentials.credentials, settings)
    subject = claims.get("sub")
    if not subject:
        raise _unauthorized("Token is missing a subject")

    app_metadata = claims.get("app_metadata") or {}
    user_metadata = claims.get("user_metadata") or {}
    role = app_metadata.get("role") or user_metadata.get("role")

    return Principal(
        subject=str(subject),
        email=claims.get("email"),
        role=role,
        claims=claims,
    )


CurrentPrincipal = Annotated[Principal, Depends(get_principal)]


def require_role(*roles: str) -> Any:
    """Dependency factory that restricts a route to the given roles."""

    def _dependency(principal: CurrentPrincipal) -> Principal:
        if principal.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Requires role: {', '.join(roles)}",
            )
        return principal

    return _dependency
