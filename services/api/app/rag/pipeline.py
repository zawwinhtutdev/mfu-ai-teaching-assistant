"""Grounded chat pipeline: retrieve → gate → prompt → stream → verify citations."""

from __future__ import annotations

import re
import uuid
from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import Settings
from app.providers.base import ChatProvider
from app.providers.gemini import ProviderError
from app.rag.citation_repair import repair_citations
from app.rag.context import Source, build_context
from app.rag.factory import get_embedder
from app.rag.prompts import REFUSAL_TEXT, grounded_system_prompt
from app.rag.search import fetch_document_chunks, hybrid_search
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
PAGE_NUMBER_RE = re.compile(r"\b(?:page|pg\.?|p\.)\s*#?\s*(\d+)\b", re.IGNORECASE)
LAST_PAGE_RE = re.compile(r"\b(?:last|final|ending)\s+page\b", re.IGNORECASE)
ORDINAL_PAGE_PATTERNS: list[tuple[re.Pattern[str], int]] = [
    (re.compile(r"\b(?:first|1st)\s+page\b", re.IGNORECASE), 1),
    (re.compile(r"\b(?:second|2nd)\s+page\b", re.IGNORECASE), 2),
    (re.compile(r"\b(?:third|3rd)\s+page\b", re.IGNORECASE), 3),
    (re.compile(r"\b(?:fourth|4th)\s+page\b", re.IGNORECASE), 4),
    (re.compile(r"\b(?:fifth|5th)\s+page\b", re.IGNORECASE), 5),
    (re.compile(r"\b(?:sixth|6th)\s+page\b", re.IGNORECASE), 6),
    (re.compile(r"\b(?:seventh|7th)\s+page\b", re.IGNORECASE), 7),
    (re.compile(r"\b(?:eighth|8th)\s+page\b", re.IGNORECASE), 8),
    (re.compile(r"\b(?:ninth|9th)\s+page\b", re.IGNORECASE), 9),
    (re.compile(r"\b(?:tenth|10th)\s+page\b", re.IGNORECASE), 10),
]
OVERVIEW_QUERY_RE = re.compile(
    r"\b(summarize|summarise|summary|overview|main\s+points?|key\s+(?:points?|concepts?|takeaways?)|"
    r"important\s+points?|bullet\s+points?|contents?\s+of|topics?\s+covered|"
    r"what\s+(?:is|are)\s+(?:said|written|mentioned|covered|included|in|on|at)\s+(?:this|the)\b|"
    r"(?:explain|describe|tell\s+me\s+about)\s+(?:this|the)\s+"
    r"(?:pdf|doc|document|file|page|slide|lecture|first|second|third|last|final))\b",
    re.IGNORECASE,
)


def extract_requested_page(query: str) -> int | None:
    """Return a 1-based page number, or -1 for 'last page', when requested."""
    if LAST_PAGE_RE.search(query):
        return -1
    match = PAGE_NUMBER_RE.search(query)
    if match:
        page = int(match.group(1))
        return page if page >= 1 else None
    for pattern, page in ORDINAL_PAGE_PATTERNS:
        if pattern.search(query):
            return page
    return None


def is_overview_query(query: str) -> bool:
    """True for document/page summary or meta-questions whose wording differs from body text."""
    return bool(OVERVIEW_QUERY_RE.search(query) or extract_requested_page(query) is not None)

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


def normalize_output_structure(text: str) -> str:
    """Clean up inline markdown bullets and duplicate citation clusters."""
    cleaned = text
    # Collapse duplicate consecutive citation markers such as "[2] [2]" -> "[2]".
    cleaned = re.sub(r"(\[\d+\])(?:\s*\1)+", r"\1", cleaned)
    # Split inline bullet items like "... [1]. - **Next**" or "...: ... - **Next**" onto new lines.
    cleaned = re.sub(r"([.!?\]])\s+-\s+(?=\*\*|[A-Z])", r"\1\n- ", cleaned)
    # Remove stray spaces before sentence punctuation after citations: "text [1] ." -> "text [1]."
    cleaned = re.sub(r"(\[\d+\])\s+([.,;:])", r"\1\2", cleaned)
    return cleaned


async def stream_grounded_reply(
    *,
    messages: list[ChatMessage],
    settings: Settings,
    provider: ChatProvider,
    session: AsyncSession | None = None,
    course_ids: list[str] | None = None,
    document_ids: list[uuid.UUID] | None = None,
    use_retrieval: bool = True,
    retrieval_mode: str = "hybrid",
    top_k: int = 5,
    prompt_variant: str = "baseline",
) -> AsyncIterator[StreamEvent]:
    """Yield SSE-ready events for one chat turn.

    ``course_ids`` is the caller's authorization scope resolved by the route, not
    a client-supplied filter: ``None`` is unrestricted (admin only) and an empty
    list refuses rather than searching the whole corpus.
    """
    sources: list[Source] = []
    grounded = False

    if use_retrieval and session is not None and (
        (course_ids is not None and not course_ids)
        or (document_ids is not None and not document_ids)
    ):
        # No readable courses or empty document filter: refuse without touching the corpus.
        yield SourcesEvent(sources=[], grounded=True)
        yield DeltaEvent(text=REFUSAL_TEXT)
        yield DoneEvent(finish_reason="refusal", refusal=True)
        return

    if use_retrieval and session is not None:
        query = _last_user_message(messages)
        if query.strip():
            embedder = get_embedder(settings)
            requested_page = extract_requested_page(query)
            overview_request = is_overview_query(query)
            # The refusal gate trusts cosine similarity, which is only meaningful
            # for a semantic embedding model. The offline hashing embedder has no
            # semantics, so gating on it would refuse valid questions.
            gate_active = (
                settings.refusal_threshold > 0
                and not embedder.name.startswith("stub")
            )
            hits = []
            used_page_lookup = False
            try:
                if (
                    (requested_page is not None or (overview_request and document_ids is not None))
                    and hasattr(session, "execute")
                ):
                    hits = await fetch_document_chunks(
                        session,
                        course_ids=course_ids,
                        document_ids=document_ids,
                        page_number=requested_page,
                        limit=max(top_k * 2, 8),
                    )
                    used_page_lookup = requested_page is not None
                if not hits and not used_page_lookup:
                    vector = await embedder.embed_query(query)
                    hits = await hybrid_search(
                        session,
                        query=query,
                        vector=vector,
                        course_ids=course_ids,
                        document_ids=document_ids,
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
            # be refused just because embeddings score it low. Overview / page
            # questions on selected materials also bypass the strict cosine gate
            # when their wording ("first page", "bullet points") differs from body text.
            best = hits[0].similarity
            bypass_gate = overview_request and (
                document_ids is not None
                or requested_page is not None
                or (best is not None and best >= 0.35)
            )
            if (
                gate_active
                and not bypass_gate
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
                system_prompt = grounded_system_prompt(built.text, variant=prompt_variant)
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

    repaired_text = text
    revisions: list[dict[str, object]] = []
    if grounded and sources:
        repaired_text, revisions_found = repair_citations(text, sources)
        revisions = [
            {"sentence": item.sentence, "from_n": item.from_n, "to_n": item.to_n}
            for item in revisions_found
        ]
        repaired_text = normalize_output_structure(repaired_text)

    cited = sorted({int(match) for match in CITATION_RE.findall(repaired_text)})
    valid = [n for n in cited if 1 <= n <= len(sources)]
    invalid = [n for n in cited if not 1 <= n <= len(sources)]

    yield DoneEvent(
        sources_used=valid,
        invalid_citations=invalid,
        citation_revisions=revisions,
        repaired_text=repaired_text if (revisions or repaired_text != text) else None,
    )
