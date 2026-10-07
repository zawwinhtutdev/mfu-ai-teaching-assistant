"""Request/response schemas for the chat API."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator

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
    course_id: uuid.UUID | None = None
    # Optional override; validated by the provider factory.
    model: str | None = None
    # Retrieval controls (used by the evaluation harness as baselines).
    use_retrieval: bool = True
    retrieval_mode: Literal["hybrid", "vector"] = "hybrid"
    top_k: int = Field(default=5, ge=1, le=20)


class StartEvent(BaseModel):
    type: Literal["start"] = "start"
    provider: str
    model: str


class DeltaEvent(BaseModel):
    type: Literal["delta"] = "delta"
    text: str


class SourceOut(BaseModel):
    n: int
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    filename: str
    page_from: int | None = None
    page_to: int | None = None
    section: str | None = None
    snippet: str = ""
    citation: str


class SourcesEvent(BaseModel):
    type: Literal["sources"] = "sources"
    sources: list[SourceOut]
    grounded: bool = True


class DoneEvent(BaseModel):
    type: Literal["done"] = "done"
    finish_reason: str = "stop"
    sources_used: list[int] = Field(default_factory=list)
    invalid_citations: list[int] = Field(default_factory=list)
    refusal: bool = False


class ErrorEvent(BaseModel):
    type: Literal["error"] = "error"
    message: str


class DocumentOut(BaseModel):
    """Public view of an uploaded document."""

    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    filename: str
    status: str
    error: str | None = None
    page_count: int | None = None
    chunk_count: int
    size_bytes: int | None = None
    course_id: uuid.UUID | None = None
    created_at: datetime


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=2000)
    course_id: uuid.UUID | None = None
    limit: int = Field(default=5, ge=1, le=20)


class SearchHitOut(BaseModel):
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    filename: str
    content: str
    page_from: int | None
    page_to: int | None
    section: str | None
    score: float
    similarity: float | None = None
    matched_lexically: bool = False
    citation: str


class SearchResponse(BaseModel):
    query: str
    hits: list[SearchHitOut]
