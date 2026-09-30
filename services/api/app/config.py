"""Configuration for the AI Teaching Assistant API service."""

from __future__ import annotations

from functools import lru_cache

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime settings.

    The app shares Supabase Auth with the Next.js frontend, so the Supabase URL
    and anon key are accepted under either the API's own names or the
    NEXT_PUBLIC_* names already used by the web app.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        populate_by_name=True,
    )

    environment: str = "local"
    service_name: str = "ata-api"
    version: str = "0.1.0"

    supabase_url: str = Field(
        default="",
        validation_alias=AliasChoices("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
    )
    supabase_anon_key: str = Field(
        default="",
        validation_alias=AliasChoices("SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    )
    # Legacy HS256 projects only. When empty, asymmetric JWKS verification is used.
    supabase_jwt_secret: str = Field(
        default="",
        validation_alias=AliasChoices("SUPABASE_JWT_SECRET", "SUPABASE_SERVICE_JWT_SECRET"),
    )

    jwt_audience: str = "authenticated"
    cors_origins: str = "http://localhost:3000"

    # ---- AI ----
    gemini_api_key: str = Field(
        default="",
        validation_alias=AliasChoices(
            "GEMINI_API_KEY",
            "GOOGLE_GENERATIVE_AI_API_KEY",
            "GOOGLE_API_KEY",
        ),
    )
    chat_model: str = Field(
        default="gemini-2.5-flash",
        validation_alias=AliasChoices("CHAT_MODEL", "GEMINI_CHAT_MODEL"),
    )

    # ---- Local development only ----
    # Allows X-Dev-Principal in place of a bearer token so the demo can run
    # without a Supabase project. Refused outside non-production environments.
    allow_insecure_dev_auth: bool = Field(
        default=False,
        validation_alias=AliasChoices("ALLOW_INSECURE_DEV_AUTH"),
    )

    @property
    def jwks_url(self) -> str:
        return f"{self.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"

    @property
    def ai_api_key(self) -> str:
        return self.gemini_api_key.strip()

    @property
    def is_production(self) -> bool:
        return self.environment.strip().lower() in {"production", "prod"}

    @property
    def dev_auth_allowed(self) -> bool:
        return self.allow_insecure_dev_auth and not self.is_production

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def auth_configured(self) -> bool:
        return bool(self.supabase_jwt_secret or self.supabase_url)


@lru_cache
def get_settings() -> Settings:
    return Settings()
