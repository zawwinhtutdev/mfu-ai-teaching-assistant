"""Streaming chat endpoint.

Emits Server-Sent Events so any client — the Next.js proxy, curl, or a test —
can consume tokens as they arrive:

    data: {"type":"start","provider":"stub","model":"stub-stream-v1"}

    data: {"type":"delta","text":"Hello"}

    data: {"type":"done","finish_reason":"stop"}

    data: [DONE]
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse

from app.auth import CurrentPrincipal
from app.config import Settings, get_settings
from app.providers.factory import get_provider
from app.providers.gemini import ProviderError
from app.schemas import (
    ChatRequest,
    DeltaEvent,
    DoneEvent,
    ErrorEvent,
    StartEvent,
)

router = APIRouter(tags=["chat"])

SettingsDep = Annotated[Settings, Depends(get_settings)]

SSE_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    # Stops nginx-style proxies from buffering the stream.
    "X-Accel-Buffering": "no",
}


def _encode(event: StartEvent | DeltaEvent | DoneEvent | ErrorEvent) -> str:
    return f"data: {event.model_dump_json()}\n\n"


@router.post("/chat", summary="Stream a chat completion")
async def chat(
    request: ChatRequest,
    principal: CurrentPrincipal,
    settings: SettingsDep,
) -> StreamingResponse:
    provider = get_provider(settings, request.model)

    async def event_stream() -> AsyncIterator[str]:
        yield _encode(StartEvent(provider=provider.name, model=provider.model))
        try:
            async for delta in provider.stream(request.messages):
                if delta:
                    yield _encode(DeltaEvent(text=delta))
        except ProviderError as exc:
            yield _encode(ErrorEvent(message=str(exc)))
            return
        yield _encode(DoneEvent())
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={**SSE_HEADERS, "X-Principal": principal.subject},
    )
