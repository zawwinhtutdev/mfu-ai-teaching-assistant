"""Google Gemini streaming provider.

Talks to the public Generative Language API over SSE using httpx, so the service
carries no vendor SDK. Swapping this for LiteLLM later means implementing the
same two attributes and ``stream()``.
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

import httpx

from app.schemas import ChatMessage

BASE_URL = "https://generativelanguage.googleapis.com/v1beta"


class GeminiProvider:
    name = "gemini"

    def __init__(
        self,
        api_key: str,
        model: str = "gemini-2.5-flash",
        timeout_s: float = 60.0,
    ) -> None:
        self._api_key = api_key
        self.model = model
        self._timeout = timeout_s

    def _payload(self, messages: list[ChatMessage]) -> dict[str, Any]:
        system_parts = [m.text for m in messages if m.role == "system" and m.text]
        contents = [
            {
                "role": "model" if m.role == "assistant" else "user",
                "parts": [{"text": m.text}],
            }
            for m in messages
            if m.role != "system" and m.text
        ]
        payload: dict[str, Any] = {"contents": contents}
        if system_parts:
            payload["systemInstruction"] = {"parts": [{"text": "\n\n".join(system_parts)}]}
        return payload

    async def stream(self, messages: list[ChatMessage]) -> AsyncIterator[str]:
        url = f"{BASE_URL}/models/{self.model}:streamGenerateContent"
        params = {"alt": "sse", "key": self._api_key}

        async with httpx.AsyncClient(timeout=self._timeout) as client, client.stream(
            "POST", url, params=params, json=self._payload(messages)
        ) as response:
            if response.status_code != 200:
                body = (await response.aread()).decode("utf-8", "replace")[:500]
                raise ProviderError(
                    f"Gemini returned {response.status_code}: {body}"
                )

            async for line in response.aiter_lines():
                if not line.startswith("data:"):
                    continue
                raw = line[5:].strip()
                if not raw or raw == "[DONE]":
                    continue
                try:
                    event = json.loads(raw)
                except json.JSONDecodeError:
                    continue
                for candidate in event.get("candidates", []):
                    for part in candidate.get("content", {}).get("parts", []):
                        text = part.get("text")
                        if text:
                            yield str(text)


class ProviderError(RuntimeError):
    """Raised when the upstream model call fails."""
