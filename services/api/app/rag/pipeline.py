"""Grounded chat pipeline: retrieve → gate → prompt → stream → verify citations."""

from __future__ import annotations

import re
import uuid
from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.providers.base import ChatProvider
from app.providers.gemini import ProviderError
from app.rag.context import Source, build_context
from app.rag.factory import get_embedder
from app.rag.prompts import REFUSAL_TEXT, grounded_system_prompt
from app.rag.search import hybrid_search
from app.schemas import (
    ChatMessage,
    DeltaEvent,
    DoneEvent,
    ErrorEvent,
    SourceOut,
    SourcesEvent,
    StartEvent,
)

CITATION_RE = re.compile(r"\[(\d+)\]")

UNGROUNDED_SYSTEM = (
    "You are a helpful and concise AI assistant for a university course platform. "
    "Be direct and friendly."
)

StreamEvent = SourcesEvent | StartEvent | DeltaEvent | DoneEvent | ErrorEvent


def _citation(
    filename: str, page_from: int | None, page_to: int | None, section: str | None
) -> str:
    parts = [filename]
    if page_from and page_to and page_to != page_from:
        parts.append(f"pp. {page_from}–{page_to}")
    elif page_from:
        parts.append(f"p. {page_from}")
    if section:
        parts.append(f"§ {section}")
    return ", ".join(parts)


def _source_out(source: Source) -> SourceOut:
    return SourceOut(
        n=source.n,
        chunk_id=source.chunk_id,
        document_id=source.document_id,
        filename=source.filename,
        page_from=source.page_from,
        page_to=source.page_to,
        section=source.section,
        snippet=" ".join(source.content.split())[:300],
        citation=_citation(source.filename, source.page_from, source.page_to, source.section),
    )


def _last_user_message(messages: list[ChatMessage]) -> str:
    for message in reversed(messages):
        if message.role == "user" and message.text.strip():
            return message.text
    return ""


def _prepare_messages(messages: list[ChatMessage], system_prompt: str) -> list[ChatMessage]:
    """Drop client system prompts and prepend ours."""
    history = [message for message in messages if message.role != "system"]
    return [ChatMessage(role="system", content=system_prompt), *history]


async def stream_grounded_reply(
    *,
    messages: list[ChatMessage],
    settings: Settings,
    provider: ChatProvider,
    session: AsyncSession | None = None,
    course_id: uuid.UUID | None = None,
    use_retrieval: bool = True,
    retrieval_mode: str = "hybrid",
    top_k: int = 5,
) -> AsyncIterator[StreamEvent]:
    """Yield SSE-ready events for one chat turn."""
    sources: list[Source] = []
    grounded = False

    if use_retrieval and session is not None:
        query = _last_user_message(messages)
        if query.strip():
            embedder = get_embedder(settings)
            # The refusal gate trusts cosine similarity, which is only meaningful
            # for a semantic embedding model. The offline hashing embedder has no
            # semantics, so gating on it would refuse valid questions.
            gate_active = (
                settings.refusal_threshold > 0
                and not embedder.name.startswith("stub")
            )
            try:
                vector = await embedder.embed_query(query)
                hits = await hybrid_search(
                    session,
                    query=query,
                    vector=vector,
                    course_id=course_id,
                    limit=top_k * 2,
                    mode=retrieval_mode,
                )
            except Exception as exc:  # retrieval must never take chat down
                yield ErrorEvent(message=f"Retrieval unavailable: {exc}")
                hits = []

            if not hits:
                yield SourcesEvent(sources=[], grounded=True)
                yield DeltaEvent(text=REFUSAL_TEXT)
                yield DoneEvent(finish_reason="refusal", refusal=True)
                return

            # Strong lexical evidence (exact identifiers, error codes) must not
            # be refused just because embeddings score it low.
            best = hits[0].similarity
            if (
                gate_active
                and best is not None
                and best < settings.refusal_threshold
                and not hits[0].matched_lexically
            ):
                yield SourcesEvent(sources=[], grounded=True)
                yield DeltaEvent(text=REFUSAL_TEXT)
                yield DoneEvent(finish_reason="refusal", refusal=True)
                return

            built = build_context(hits, max_chars=settings.context_chars)
            if not built.is_empty:
                sources = built.sources
                grounded = True
                system_prompt = grounded_system_prompt(built.text)
            else:
                system_prompt = UNGROUNDED_SYSTEM
        else:
            system_prompt = UNGROUNDED_SYSTEM
    else:
        system_prompt = UNGROUNDED_SYSTEM

    yield SourcesEvent(sources=[_source_out(source) for source in sources], grounded=grounded)
    yield StartEvent(provider=provider.name, model=provider.model)

    text = ""
    try:
        async for delta in provider.stream(_prepare_messages(messages, system_prompt)):
            if delta:
                text += delta
                yield DeltaEvent(text=delta)
    except ProviderError as exc:
        yield ErrorEvent(message=str(exc))
        return
    except Exception as exc:  # provider transport failures
        yield ErrorEvent(message=f"Model call failed: {exc}")
        return

    cited = sorted({int(match) for match in CITATION_RE.findall(text)})
    valid = [n for n in cited if 1 <= n <= len(sources)]
    invalid = [n for n in cited if not 1 <= n <= len(sources)]

    yield DoneEvent(sources_used=valid, invalid_citations=invalid)
