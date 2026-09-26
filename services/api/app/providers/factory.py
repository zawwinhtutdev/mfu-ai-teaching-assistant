"""Provider selection.

One place decides which backend answers a request. Today that is Gemini when a
key exists, otherwise the deterministic stub.
"""

from __future__ import annotations

from app.config import Settings
from app.providers.base import ChatProvider
from app.providers.gemini import GeminiProvider
from app.providers.stub import StubProvider


def get_provider(settings: Settings, model: str | None = None) -> ChatProvider:
    if settings.ai_api_key:
        return GeminiProvider(settings.ai_api_key, model or settings.chat_model)
    return StubProvider()
