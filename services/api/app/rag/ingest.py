"""PDF extraction (text + optional local vision for images/scans) and ingestion into pgvector."""

from __future__ import annotations

import hashlib
import io
import logging
import re
import uuid
from collections import Counter

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Document, DocumentChunk
from app.rag.chunker import chunk_pages
from app.rag.embeddings import EmbeddingProvider
from app.rag.vision import VisionDescriber, VisionError

logger = logging.getLogger(__name__)

MAX_PDF_BYTES = 25 * 1024 * 1024
MIN_TEXT_CHARS = 50
MAX_RENDER_DIM_PX = 1400

# Postgres text cannot store NUL, and control characters only confuse the
# tokenizer; pypdf does emit them for some fonts and ligatures.
CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
SQL_NOISE = re.compile(r"\[SQL:.*", re.DOTALL)


def sanitize_text(text: str) -> str:
    """Remove characters Postgres cannot store and normalise line endings."""
    cleaned = CONTROL_CHARS.sub("", text.replace("\r\n", "\n").replace("\r", "\n"))
    return cleaned.replace("\u00a0", " ")


def concise_error(exc: Exception) -> str:
    """A short, user-facing reason instead of a SQLAlchemy dump."""
    message = str(exc).splitlines()[0] if str(exc) else exc.__class__.__name__
    message = SQL_NOISE.sub("", message).strip()
    return message[:300] or exc.__class__.__name__


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
            pages.append(sanitize_text(page.extract_text() or ""))
        except Exception:
            pages.append("")

    total = sum(len(page.strip()) for page in pages)
    if total < MIN_TEXT_CHARS:
        raise ExtractionError(
            "No extractable text found (the PDF is likely scanned; OCR/vision is required)"
        )
    return pages


def _page_has_meaningful_image(
    page: object,
    *,
    repeated_xrefs: set[int],
    min_image_px: int,
) -> bool:
    """Return True if the PyMuPDF page contains at least one non-trivial, non-logo image."""
    try:
        infos = page.get_image_info(xrefs=True)  # type: ignore[attr-defined]
    except Exception:
        return False

    for info in infos:
        xref = int(info.get("xref") or 0)
        if xref and xref in repeated_xrefs:
            continue
        width = int(info.get("width") or 0)
        height = int(info.get("height") or 0)
        if width >= min_image_px and height >= min_image_px:
            return True
    return False


def _render_page_png(page: object, max_dim_px: int = MAX_RENDER_DIM_PX) -> bytes:
    """Render a PyMuPDF page to PNG bytes, scaling so the longest side <= max_dim_px."""
    import pymupdf

    rect = page.rect  # type: ignore[attr-defined]
    longest = max(float(rect.width), float(rect.height), 1.0)
    zoom = min(2.0, max_dim_px / longest)
    matrix = pymupdf.Matrix(zoom, zoom)
    pix = page.get_pixmap(matrix=matrix, alpha=False)  # type: ignore[attr-defined]
    return bytes(pix.tobytes("png"))


async def extract_pages_with_vision(
    data: bytes,
    *,
    vision: VisionDescriber | None = None,
    max_vision_pages: int = 15,
    min_image_px: int = 140,
) -> list[str]:
    """Extract text from each PDF page, using a local vision model for scans and diagrams."""
    if vision is None:
        return extract_pages(data)

    import pymupdf

    try:
        doc = pymupdf.open(stream=data, filetype="pdf")
    except Exception as exc:
        raise ExtractionError(f"Could not read PDF: {exc}") from exc

    try:
        page_count = len(doc)
        # Count image xrefs across pages so repeated header/footer logos are skipped.
        xref_counts: Counter[int] = Counter()
        if page_count >= 3:
            for page_index in range(page_count):
                page = doc[page_index]
                seen_on_page: set[int] = set()
                for img in page.get_images(full=True):
                    xref = int(img[0])
                    if xref:
                        seen_on_page.add(xref)
                xref_counts.update(seen_on_page)
        repeated_xrefs = {xref for xref, count in xref_counts.items() if count >= 2}

        pages: list[str] = []
        vision_calls = 0
        last_vision_error: str | None = None

        for page_index in range(page_count):
            page = doc[page_index]
            page_num = page_index + 1
            text = sanitize_text(page.get_text("text") or "")
            is_low_text = len(text.strip()) < MIN_TEXT_CHARS
            has_diagram = _page_has_meaningful_image(
                page,
                repeated_xrefs=repeated_xrefs,
                min_image_px=min_image_px,
            )

            if (is_low_text or has_diagram) and vision_calls < max_vision_pages:
                vision_calls += 1
                try:
                    png_bytes = _render_page_png(page)
                    description = sanitize_text(
                        await vision.describe_image(
                            png_bytes,
                            page_number=page_num,
                            context_hint=text,
                        )
                    ).strip()
                    if description:
                        visual_block = f"[Visual content on page {page_num}]\n{description}"
                        text = f"{text.strip()}\n\n{visual_block}" if text.strip() else visual_block
                except VisionError as exc:
                    last_vision_error = str(exc)
                    logger.warning("Vision extraction skipped on page %d: %s", page_num, exc)

            pages.append(text)
    finally:
        doc.close()

    total = sum(len(page.strip()) for page in pages)
    if total < MIN_TEXT_CHARS:
        if last_vision_error:
            raise ExtractionError(last_vision_error)
        raise ExtractionError(
            "No extractable text found (the PDF is likely scanned and vision produced no text)"
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
    vision: VisionDescriber | None = None,
    max_vision_pages: int = 15,
    min_image_px: int = 140,
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
        pages = await extract_pages_with_vision(
            data,
            vision=vision,
            max_vision_pages=max_vision_pages,
            min_image_px=min_image_px,
        )
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
            failed.error = concise_error(exc)
            await session.commit()
        raise


async def find_by_hash(
    session: AsyncSession, digest: str, course_id: str | None
) -> Document | None:
    """A duplicate only exists within the same course."""
    statement = select(Document).where(
        Document.sha256 == digest,
        Document.course_id.is_(None) if course_id is None else Document.course_id == course_id,
    )
    result = await session.execute(statement)
    return result.scalar_one_or_none()
