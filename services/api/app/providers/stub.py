"""Deterministic offline provider.

Used when no AI credential is configured, so the whole request path — auth,
streaming, proxy, UI transport — can be developed and tested without a key.
It never claims to be a model: responses are explicitly labelled as stubs.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator

from app.schemas import ChatMessage


class StubProvider:
    name = "stub"
    model = "stub-stream-v1"

    def __init__(self, chunk_delay_s: float = 0.0) -> None:
        self._delay = chunk_delay_s

    def _compose(self, messages: list[ChatMessage]) -> str:
        last_user = next(
            (m.text for m in reversed(messages) if m.role == "user"),
            "",
        )
        preview = last_user.strip().replace("\n", " ")[:160]
        if not preview:
            return "[stub] No user message was provided."
        return (
            "[stub] Streaming works end to end, but no AI key is configured. "
            f'You said: "{preview}". '
            "Set GEMINI_API_KEY (or GOOGLE_GENERATIVE_AI_API_KEY) to get a real answer."
        )

    async def stream(self, messages: list[ChatMessage]) -> AsyncIterator[str]:
        words = self._compose(messages).split(" ")
        for index, word in enumerate(words):
            if self._delay:
                await asyncio.sleep(self._delay)
            yield word if index == 0 else f" {word}"
