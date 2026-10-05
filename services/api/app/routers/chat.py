"""Streaming chat endpoint.

Emits Server-Sent Events:

    data: {"type":"sources","sources":[...],"grounded":true}

    data: {"type":"start","provider":"gemini","model":"gemini-2.5-flash"}

    data: {"type":"delta","text":"For HTTP errors, the standard specifies…"}

    data: {"type":"done","sources_used":[1],"invalid_citations":[]}

    data: [DONE]
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentPrincipal
from app.config import Settings, get_settings
from app.db import get_session
from app.providers.factory import get_provider
from app.rag.pipeline import StreamEvent, stream_grounded_reply
from app.schemas import ChatRequest

router = APIRouter(tags=["chat"])

SettingsDep = Annotated[Settings, Depends(get_settings)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]

SSE_HEADERS = {
    "Cache-Control": "no-cache, no-transform",
    "Connection": "keep-alive",
    # Stops nginx-style proxies from buffering the stream.
    "X-Accel-Buffering": "no",
}


def _encode(event: StreamEvent) -> str:
    return f"data: {event.model_dump_json()}\n\n"


@router.post("/chat", summary="Stream a grounded chat completion")
async def chat(
    request: ChatRequest,
    principal: CurrentPrincipal,
    settings: SettingsDep,
    session: SessionDep,
) -> StreamingResponse:
    provider = get_provider(settings, request.model)

    async def event_stream() -> AsyncIterator[str]:
        async for event in stream_grounded_reply(
            messages=request.messages,
            settings=settings,
            provider=provider,
            session=session,
            course_id=request.course_id,
            use_retrieval=request.use_retrieval,
            retrieval_mode=request.retrieval_mode,
            top_k=request.top_k,
        ):
            yield _encode(event)
        yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={**SSE_HEADERS, "X-Principal": principal.subject},
    )
