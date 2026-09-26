"""Request/response schemas for the chat API."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field, model_validator

Role = Literal["system", "user", "assistant"]


class ChatMessage(BaseModel):
    """Accepts either a plain ``content`` string or AI-SDK style ``parts``."""

    role: Role
    content: str | None = None
    parts: list[dict[str, Any]] | None = None

    @model_validator(mode="after")
    def _resolve_text(self) -> ChatMessage:
        if self.content is None and self.parts:
            text = "".join(
                str(part.get("text", ""))
                for part in self.parts
                if isinstance(part, dict) and part.get("type") == "text"
            )
            object.__setattr__(self, "content", text)
        if self.content is None:
            object.__setattr__(self, "content", "")
        return self

    @property
    def text(self) -> str:
        return self.content or ""


class ChatRequest(BaseModel):
    messages: list[ChatMessage] = Field(min_length=1)
    conversation_id: str | None = None
    course_id: str | None = None
    # Optional override; validated by the provider factory.
    model: str | None = None


class StartEvent(BaseModel):
    type: Literal["start"] = "start"
    provider: str
    model: str


class DeltaEvent(BaseModel):
    type: Literal["delta"] = "delta"
    text: str


class DoneEvent(BaseModel):
    type: Literal["done"] = "done"
    finish_reason: str = "stop"


class ErrorEvent(BaseModel):
    type: Literal["error"] = "error"
    message: str
