"""Chat provider interface.

Keeping generation behind a narrow protocol means the orchestration layer never
knows which vendor is answering, and tests can run without a network or key.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Protocol

from app.schemas import ChatMessage


@dataclass(frozen=True)
class ChatTurn:
    role: str
    text: str


class ChatProvider(Protocol):
    """A streaming chat backend."""

    name: str
    model: str

    def stream(self, messages: list[ChatMessage]) -> AsyncIterator[str]:
        """Yield response text deltas."""
        ...
