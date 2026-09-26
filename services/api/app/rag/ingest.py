"""PDF extraction and ingestion into pgvector."""

from __future__ import annotations

import hashlib
import io
import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Document, DocumentChunk
from app.rag.chunker import chunk_pages
from app.rag.embeddings import EmbeddingProvider

MAX_PDF_BYTES = 25 * 1024 * 1024
MIN_TEXT_CHARS = 50


class ExtractionError(RuntimeError):
    """Raised when a PDF yields no usable text."""


def extract_pages(data: bytes) -> list[str]:
    """Return per-page text. Raises ExtractionError for unreadable/scanned PDFs."""
    from pypdf import PdfReader

    try:
        reader = PdfReader(io.BytesIO(data))
    except Exception as exc:  # pypdf raises several unrelated exception types
        raise ExtractionError(f"Could not read PDF: {exc}") from exc

    pages: list[str] = []
    for page in reader.pages:
        try:
            pages.append(page.extract_text() or "")
        except Exception:
            pages.append("")

    total = sum(len(page.strip()) for page in pages)
    if total < MIN_TEXT_CHARS:
        raise ExtractionError(
            "No extractable text found (the PDF is likely scanned; OCR is not configured)"
        )
    return pages


def content_hash(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


async def ingest_pdf(
    session: AsyncSession,
    *,
    document_id: uuid.UUID,
    data: bytes,
    embedder: EmbeddingProvider,
    target_chars: int = 1200,
    overlap_chars: int = 200,
) -> Document:
    """Extract, chunk, embed and persist a PDF. Idempotent per document."""
    document = await session.get(Document, document_id)
    if document is None:
        raise ExtractionError("Document not found")

    document.status = "processing"
    document.error = None
    await session.flush()

    try:
        pages = extract_pages(data)
        chunks = chunk_pages(pages, target_chars=target_chars, overlap_chars=overlap_chars)
        if not chunks:
            raise ExtractionError("Document produced no chunks")

        vectors = await embedder.embed([chunk.text for chunk in chunks])

        # Re-ingestion replaces earlier chunks rather than duplicating them.
        await session.execute(
            delete(DocumentChunk).where(DocumentChunk.document_id == document.id)
        )

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

        document.page_count = len(pages)
        document.chunk_count = len(chunks)
        document.status = "ready"
        document.error = None
        await session.commit()
        return document

    except Exception as exc:
        await session.rollback()
        failed = await session.get(Document, document_id)
        if failed is not None:
            failed.status = "failed"
            failed.error = str(exc)[:1000]
            await session.commit()
        raise


async def find_by_hash(session: AsyncSession, digest: str) -> Document | None:
    result = await session.execute(select(Document).where(Document.sha256 == digest))
    return result.scalar_one_or_none()
