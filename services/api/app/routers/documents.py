"""Document upload and ingestion endpoints."""

from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Response,
    UploadFile,
)
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.academic import (
    assert_course_access,
    course_is_readable,
    course_scope_for,
    get_person,
    require_course_manager,
)
from app.auth import CurrentPrincipal
from app.config import Settings, get_settings
from app.db import get_session, get_session_factory
from app.models import Document
from app.rag.factory import get_embedder
from app.rag.ingest import MAX_PDF_BYTES, content_hash, find_by_hash, ingest_pdf
from app.rag.vision import get_vision_describer
from app.schemas import DocumentOut

router = APIRouter(prefix="/v1/documents", tags=["documents"])

SettingsDep = Annotated[Settings, Depends(get_settings)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]


async def _run_ingest(document_id: uuid.UUID, data: bytes, settings: Settings) -> None:
    """Background ingestion: extracts, chunks and embeds the PDF."""
    factory = get_session_factory(settings)
    async with factory() as session:
        try:
            await ingest_pdf(
                session,
                document_id=document_id,
                data=data,
                embedder=get_embedder(settings),
                vision=get_vision_describer(settings),
                max_vision_pages=settings.pdf_vision_max_pages,
                min_image_px=settings.pdf_vision_min_image_px,
                target_chars=settings.chunk_chars,
                overlap_chars=settings.chunk_overlap,
            )
        except Exception:
            # The failure is recorded on the document row inside ingest_pdf.
            return


@router.post("", response_model=DocumentOut, status_code=201, summary="Upload a PDF")
async def upload_document(
    file: Annotated[UploadFile, File(description="PDF file")],
    principal: CurrentPrincipal,
    settings: SettingsDep,
    session: SessionDep,
    background: BackgroundTasks,
    response: Response,
    course_id: Annotated[str | None, Form()] = None,
) -> Document:
    person = await get_person(session, principal)
    require_course_manager(person)

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > MAX_PDF_BYTES:
        raise HTTPException(status_code=413, detail=f"File exceeds {MAX_PDF_BYTES} bytes")

    if course_id is None:
        raise HTTPException(
            status_code=400,
            detail="course_id is required: a document must belong to a course",
        )
    # Materials land in a course the caller actually teaches.
    await assert_course_access(session, person, course_id)

    digest = content_hash(data)
    existing = await find_by_hash(session, digest, course_id)
    if existing is not None:
        # A failed earlier attempt must be retryable with the same file
        # (identical SHA-256 would otherwise short-circuit forever).
        if existing.status == "failed":
            existing.status = "queued"
            existing.error = None
            await session.commit()
            await session.refresh(existing)
            background.add_task(_run_ingest, existing.id, data, settings)
        response.status_code = 200
        return existing

    document = Document(
        filename=file.filename or "upload.pdf",
        content_type=file.content_type,
        size_bytes=len(data),
        sha256=digest,
        course_id=course_id,
        uploaded_by=principal.subject,
        status="queued",
    )
    session.add(document)
    await session.commit()
    await session.refresh(document)

    background.add_task(_run_ingest, document.id, data, settings)
    return document


@router.get("", response_model=list[DocumentOut], summary="List documents")
async def list_documents(
    principal: CurrentPrincipal,
    session: SessionDep,
    course_id: str | None = None,
) -> list[Document]:
    person = await get_person(session, principal)
    statement = select(Document).order_by(Document.created_at.desc()).limit(100)

    scope = await course_scope_for(session, person)

    if course_id is not None:
        # A client-supplied course id is a request, not a permission.
        await assert_course_access(session, person, course_id)
        statement = statement.where(Document.course_id == course_id)
    elif scope is not None:
        # An empty scope is "no courses", so it must match nothing.
        if not scope:
            return []
        statement = statement.where(Document.course_id.in_(scope))

    result = await session.execute(statement)
    return list(result.scalars().all())


@router.get("/{document_id}", response_model=DocumentOut, summary="Document status")
async def get_document(
    document_id: uuid.UUID,
    principal: CurrentPrincipal,
    session: SessionDep,
) -> Document:
    person = await get_person(session, principal)
    document = await session.get(Document, document_id)
    # 404 for a document outside the caller's scope: its existence is not their
    # business, so the response must not distinguish "missing" from "not yours".
    if document is None or not course_is_readable(
        await course_scope_for(session, person), document.course_id
    ):
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.delete("/{document_id}", status_code=204, summary="Delete a document")
async def delete_document(
    document_id: uuid.UUID,
    principal: CurrentPrincipal,
    session: SessionDep,
) -> Response:
    person = await get_person(session, principal)
    require_course_manager(person)

    document = await session.get(Document, document_id)
    if document is None or not course_is_readable(
        await course_scope_for(session, person), document.course_id
    ):
        raise HTTPException(status_code=404, detail="Document not found")

    await session.delete(document)
    await session.commit()
    return Response(status_code=204)
