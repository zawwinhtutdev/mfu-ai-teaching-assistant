"""Integration tests against a real Postgres + pgvector.

These run only when the database is reachable (``DATABASE_URL`` or the local
Compose instance). Everything is written inside one transaction-scoped document
that is removed afterwards.
"""

from __future__ import annotations

import asyncio
import os
import uuid

import pytest

from app.config import Settings
from app.db import dispose_engine, get_session_factory
from app.rag.chunker import chunk_pages
from app.rag.embeddings import StubEmbeddings

DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://ata:ata-local-dev@127.0.0.1:5432/ata",
)

PAGES = [
    "# Course Policies\n"
    "CS303 Software Security meets every Monday. "
    "Late submissions are capped at 50 percent of the awarded mark.\n\n"
    "# Assessment\n"
    "Assessment is 40 percent coursework and 60 percent final project. "
    "The grading rubric rewards threat modelling and tests.\n\n"
    "# Appeals\n"
    "Appeals must be filed within ten working days of the grade release.",
]


def _db_reachable() -> bool:
    async def _ping() -> None:
        settings = Settings(database_url=DATABASE_URL)
        factory = get_session_factory(settings)
        async with factory() as session:
            from sqlalchemy import text

            await session.execute(text("select 1"))

    try:
        asyncio.run(_ping())
        asyncio.run(dispose_engine())
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _db_reachable(), reason="Postgres with pgvector not reachable")


def test_ingest_and_hybrid_search_roundtrip() -> None:
    asyncio.run(_roundtrip())


async def _roundtrip() -> None:
    from sqlalchemy import delete

    from app.models import Document, DocumentChunk
    from app.rag.search import hybrid_search

    await dispose_engine()
    settings = Settings(database_url=DATABASE_URL, gemini_api_key="")
    factory = get_session_factory(settings)
    embedder = StubEmbeddings()

    course_id = f"course-test-{uuid.uuid4()}"

    async with factory() as session:
        document = Document(
            course_id=course_id,
            filename="cs303-policy.md",
            content_type="text/markdown",
            size_bytes=len(PAGES[0]),
            sha256="integration-test-doc",
            uploaded_by="test",
            status="processing",
        )
        session.add(document)
        await session.commit()
        await session.refresh(document)

        try:
            chunks = chunk_pages(PAGES, target_chars=400, overlap_chars=60)
            vectors = await embedder.embed([chunk.text for chunk in chunks])
            session.add_all(
                [
                    DocumentChunk(
                        document_id=document.id,
                        chunk_index=index,
                        page_from=chunk.page_from,
                        page_to=chunk.page_to,
                        section=chunk.section,
                        content=chunk.text,
                        embedding=vector,
                    )
                    for index, (chunk, vector) in enumerate(zip(chunks, vectors, strict=True))
                ]
            )
            document.status = "ready"
            document.chunk_count = len(chunks)
            await session.commit()

            # Semantic-ish query
            query = "late submission penalty"
            vector = await embedder.embed_query(query)
            hits = await hybrid_search(
                session, query=query, vector=vector, limit=5, course_ids=[course_id]
            )
            assert hits, "expected at least one hit"
            assert any(
                "Late submissions" in hit.content or "50 percent" in hit.content
                for hit in hits
            )
            assert all(hit.filename == "cs303-policy.md" for hit in hits)
            assert hits[0].page_from is not None

            # Exact identifier, the case vector-only search misses
            exact = "CS303"
            exact_hits = await hybrid_search(
                session,
                query=exact,
                vector=await embedder.embed_query(exact),
                limit=5,
                course_ids=[course_id],
            )
            assert any("CS303" in hit.content for hit in exact_hits)

            # Unrelated query still returns ranked rows, with lower fused scores
            other = "campus parking"
            other_hits = await hybrid_search(
                session,
                query=other,
                vector=await embedder.embed_query(other),
                limit=5,
                course_ids=[course_id],
            )
            no_exact_match = not any("CS303" in hit.content for hit in other_hits)
            assert no_exact_match or other_hits[0].score <= hits[0].score

            # A caller scoped to another course sees nothing, even though the
            # chunks exist: the scope is authorization, not a ranking hint.
            assert (
                await hybrid_search(
                    session,
                    query="late submission penalty",
                    vector=await embedder.embed_query("late submission penalty"),
                    limit=5,
                    course_ids=[f"course-other-{uuid.uuid4()}"],
                )
                == []
            )

            # An empty scope means "no courses", never "all courses".
            assert (
                await hybrid_search(
                    session,
                    query="late submission penalty",
                    vector=await embedder.embed_query("late submission penalty"),
                    limit=5,
                    course_ids=[],
                )
                == []
            )

        finally:
            await session.execute(
                delete(DocumentChunk).where(DocumentChunk.document_id == document.id)
            )
            await session.execute(delete(Document).where(Document.id == document.id))
            await session.commit()

    await dispose_engine()


def test_pdf_extraction_rejects_non_pdf() -> None:
    from app.rag.ingest import ExtractionError, extract_pages

    with pytest.raises(ExtractionError):
        extract_pages(b"this is definitely not a pdf")
