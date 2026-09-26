"""Deterministic offline provider.

Used when no AI credential is configured, so the whole request path — auth,
streaming, proxy, UI transport — can be developed and tested without a key.
It never claims to be a model: responses are explicitly labelled as stubs.
"""

from __future__ import annotations

import asyncio
import re
from collections.abc import AsyncIterator

from app.schemas import ChatMessage

SOURCE_BLOCK_RE = re.compile(r"\[1\] \([^)]*\)\n(.+)", re.DOTALL)


class StubProvider:
    name = "stub"
    model = "stub-stream-v1"

    def __init__(self, chunk_delay_s: float = 0.0) -> None:
        self._delay = chunk_delay_s

    def _compose(self, messages: list[ChatMessage]) -> str:
        system = next((m.text for m in messages if m.role == "system"), "")
        if "SOURCES" in system:
            # Grounded mode: echo the first source so citations are exercised.
            match = SOURCE_BLOCK_RE.search(system)
            excerpt = " ".join((match.group(1) if match else "").split())[:220]
            if excerpt:
                return (
                    "[stub] Using the provided course material [1]: "
                    f"{excerpt}"
                )

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
