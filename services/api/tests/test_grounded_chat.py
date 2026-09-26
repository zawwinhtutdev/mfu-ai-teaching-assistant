"""Grounded chat end-to-end against Postgres (gate, citations, refusal)."""

from __future__ import annotations

import asyncio
import os
import uuid

import pytest

from app.config import Settings
from app.db import dispose_engine, get_session_factory
from app.rag.pipeline import stream_grounded_reply as stream_grounded_reply_events

DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://ata:ata-local-dev@127.0.0.1:5432/ata",
)

PAGES = [
    "# HTTP Errors\n"
    "Use 400 for invalid input. Use 401 when the user is not authenticated. "
    "Use 403 when the user is authenticated but not permitted.\n\n"
    "# Assessment\n"
    "Assessment is 40 percent coursework and 60 percent final project.\n",
]


def _db_reachable() -> bool:
    async def _ping() -> None:
        from sqlalchemy import text

        factory = get_session_factory(Settings(database_url=DATABASE_URL))
        async with factory() as session:
            await session.execute(text("select 1"))

    try:
        asyncio.run(_ping())
        asyncio.run(dispose_engine())
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _db_reachable(), reason="Postgres not reachable")


def _settings(**overrides: object) -> Settings:
    base = {
        "database_url": DATABASE_URL,
        "gemini_api_key": "",
        "refusal_threshold": 0.0,
        "ai_provider": "stub",
    }
    base.update(overrides)
    return Settings(**base)


async def _seed(course_id: uuid.UUID):
    from app.models import Document, DocumentChunk
    from app.rag.chunker import chunk_pages
    from app.rag.embeddings import StubEmbeddings

    await dispose_engine()
    factory = get_session_factory(_settings())
    session = factory()
    document = Document(
        course_id=course_id,
        filename="http-errors.md",
        content_type="text/markdown",
        size_bytes=100,
        sha256=f"grounded-{course_id}",
        uploaded_by="test",
        status="processing",
    )
    session.add(document)
    await session.commit()
    await session.refresh(document)

    chunks = chunk_pages(PAGES, target_chars=300, overlap_chars=40)
    vectors = await StubEmbeddings().embed([c.text for c in chunks])
    session.add_all(
        [
            DocumentChunk(
                document_id=document.id,
                chunk_index=i,
                page_from=c.page_from,
                page_to=c.page_to,
                section=c.section,
                content=c.text,
                embedding=v,
            )
            for i, (c, v) in enumerate(zip(chunks, vectors, strict=True))
        ]
    )
    document.status = "ready"
    document.chunk_count = len(chunks)
    await session.commit()
    return session, document


async def _cleanup(session: object, document_id: uuid.UUID) -> None:
    from sqlalchemy import delete

    from app.models import Document

    await session.execute(delete(Document).where(Document.id == document_id))  # type: ignore[attr-defined]
    await session.commit()
    await session.close()  # type: ignore[attr-defined]
    await dispose_engine()


def test_grounded_reply_cites_sources() -> None:
    asyncio.run(_grounded_reply())


async def _grounded_reply() -> None:
    from app.providers.stub import StubProvider
    from app.rag.pipeline import stream_grounded_reply
    from app.schemas import ChatMessage

    course_id = uuid.uuid4()
    session, document = await _seed(course_id)
    try:
        events = [
            event
            async for event in stream_grounded_reply(
                messages=[ChatMessage(role="user", content="what does 403 mean?")],
                settings=_settings(),
                provider=StubProvider(),
                session=session,
                course_id=course_id,
            )
        ]

        sources_events = [e for e in events if e.type == "sources"]
        assert sources_events and sources_events[0].grounded is True
        assert len(sources_events[0].sources) >= 1
        assert sources_events[0].sources[0].citation

        text = "".join(e.text for e in events if e.type == "delta")  # type: ignore[union-attr]
        assert "[1]" in text

        done = [e for e in events if e.type == "done"][-1]
        assert done.sources_used == [1]  # type: ignore[attr-defined]
        assert done.invalid_citations == []  # type: ignore[attr-defined]
        assert done.refusal is False  # type: ignore[attr-defined]
    finally:
        await _cleanup(session, document.id)


def test_refusal_when_below_threshold(monkeypatch: pytest.MonkeyPatch) -> None:
    asyncio.run(_refusal(monkeypatch))


async def _refusal(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.rag.pipeline as pipeline
    from app.providers.stub import StubProvider
    from app.rag.prompts import REFUSAL_TEXT
    from app.rag.search import SearchHit
    from app.schemas import ChatMessage

    class _SemanticEmbedder:
        name = "gemini"
        dim = 768

        async def embed(self, texts: list[str]) -> list[list[float]]:
            return [[0.1] * 768 for _ in texts]

        async def embed_query(self, text: str) -> list[float]:
            return [0.1] * 768

    async def _low_similarity_search(*args: object, **kwargs: object) -> list[SearchHit]:
        return [
            SearchHit(
                chunk_id=uuid.uuid4(),
                document_id=uuid.uuid4(),
                filename="policy.pdf",
                content="unrelated passage about parking",
                page_from=1,
                page_to=1,
                section=None,
                score=0.01,
                similarity=0.05,
            )
        ]

    monkeypatch.setattr(pipeline, "get_embedder", lambda settings: _SemanticEmbedder())
    monkeypatch.setattr(pipeline, "hybrid_search", _low_similarity_search)

    events = [
        event
        async for event in stream_grounded_reply_events(
            messages=[ChatMessage(role="user", content="what is the parking fee?")],
            settings=_settings(refusal_threshold=0.5),
            provider=StubProvider(),
            session=object(),  # type: ignore[arg-type]
        )
    ]

    text = "".join(e.text for e in events if e.type == "delta")  # type: ignore[union-attr]
    assert text == REFUSAL_TEXT

    done = [e for e in events if e.type == "done"][-1]
    assert done.refusal is True  # type: ignore[attr-defined]
    # Refusal must not have called the model.
    assert not any(e.type == "start" for e in events)


def test_stub_embedder_does_not_gate(monkeypatch: pytest.MonkeyPatch) -> None:
    """The hashing stub has no semantics, so the similarity gate is skipped."""
    asyncio.run(_stub_no_gate(monkeypatch))


async def _stub_no_gate(monkeypatch: pytest.MonkeyPatch) -> None:
    import app.rag.pipeline as pipeline
    from app.providers.stub import StubProvider
    from app.rag.search import SearchHit
    from app.schemas import ChatMessage

    async def _search(*args: object, **kwargs: object) -> list[SearchHit]:
        return [
            SearchHit(
                chunk_id=uuid.uuid4(),
                document_id=uuid.uuid4(),
                filename="policy.pdf",
                content="Use 403 when the user is not permitted.",
                page_from=8,
                page_to=8,
                section="6.1 HTTP Errors",
                score=0.02,
                similarity=0.01,
            )
        ]

    monkeypatch.setattr(pipeline, "hybrid_search", _search)

    events = [
        event
        async for event in stream_grounded_reply_events(
            messages=[ChatMessage(role="user", content="what does 403 mean?")],
            settings=_settings(refusal_threshold=0.99),
            provider=StubProvider(),
            session=object(),  # type: ignore[arg-type]
        )
    ]
    done = [e for e in events if e.type == "done"][-1]
    assert done.refusal is False  # type: ignore[attr-defined]
    assert any(e.type == "start" for e in events)


def test_ungrounded_when_retrieval_disabled() -> None:
    asyncio.run(_ungrounded())


async def _ungrounded() -> None:
    from app.providers.stub import StubProvider
    from app.rag.pipeline import stream_grounded_reply
    from app.schemas import ChatMessage

    events = [
        event
        async for event in stream_grounded_reply(
            messages=[ChatMessage(role="user", content="hello")],
            settings=_settings(),
            provider=StubProvider(),
            session=None,
            use_retrieval=False,
        )
    ]
    sources = [e for e in events if e.type == "sources"][0]
    assert sources.grounded is False  # type: ignore[attr-defined]
    assert sources.sources == []  # type: ignore[attr-defined]
    assert any(e.type == "start" for e in events)
    await dispose_engine()
