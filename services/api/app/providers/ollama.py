"""Ollama chat provider — models run locally, no API key.

Speaks Ollama's NDJSON streaming protocol:

    POST /api/chat
    {"model": "...", "messages": [...], "stream": true}
    -> {"message": {"role": "assistant", "content": "Hel"}, "done": false}
    -> {"message": {"role": "assistant", "content": "lo"},  "done": false}
    -> {"done": true}
"""

from __future__ import annotations

import json
from collections.abc import AsyncIterator
from typing import Any

import httpx

from app.schemas import ChatMessage


class OllamaError(RuntimeError):
    """Raised when the local model call fails."""


def build_payload(model: str, messages: list[ChatMessage]) -> dict[str, Any]:
    return {
        "model": model,
        "stream": True,
        "messages": [
            {"role": message.role, "content": message.text}
            for message in messages
            if message.text
        ],
    }


def parse_stream_line(line: str) -> str | None:
    """Extract a text delta from one NDJSON line; None when there is none."""
    line = line.strip()
    if not line:
        return None
    try:
        event = json.loads(line)
    except json.JSONDecodeError:
        return None

    if event.get("error"):
        raise OllamaError(str(event["error"]))

    message = event.get("message") or {}
    content = message.get("content")
    return str(content) if content else None


class OllamaProvider:
    name = "ollama"

    def __init__(
        self,
        base_url: str = "http://127.0.0.1:11434",
        model: str = "qwen2.5:7b",
        timeout_s: float = 300.0,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self.model = model
        self._timeout = timeout_s

    async def stream(self, messages: list[ChatMessage]) -> AsyncIterator[str]:
        url = f"{self._base_url}/api/chat"
        payload = build_payload(self.model, messages)

        timeout = httpx.Timeout(self._timeout, connect=5.0)
        async with (
            httpx.AsyncClient(timeout=timeout) as client,
            client.stream("POST", url, json=payload) as response,
        ):
                if response.status_code != 200:
                    body = (await response.aread()).decode("utf-8", "replace")[:300]
                    raise OllamaError(
                        f"Ollama returned {response.status_code}: {body}. "
                        f"Is `ollama pull {self.model}` done?"
                    )

                async for line in response.aiter_lines():
                    delta = parse_stream_line(line)
                    if delta:
                        yield delta
