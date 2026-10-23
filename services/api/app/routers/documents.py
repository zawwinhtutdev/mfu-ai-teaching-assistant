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

from app.academic import assert_course_access, course_ids_for, get_person
from app.auth import CurrentPrincipal
from app.config import Settings, get_settings
from app.db import get_session, get_session_factory
from app.models import Document
from app.rag.factory import get_embedder
from app.rag.ingest import MAX_PDF_BYTES, content_hash, find_by_hash, ingest_pdf
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
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty file")
    if len(data) > MAX_PDF_BYTES:
        raise HTTPException(status_code=413, detail=f"File exceeds {MAX_PDF_BYTES} bytes")

    digest = content_hash(data)
    existing = await find_by_hash(session, digest)
    if existing is not None:
        # Uploading the same file into a course assigns it there, so a file
        # uploaded before course scoping can be filed correctly.
        if course_id and existing.course_id != course_id:
            existing.course_id = course_id
            await session.commit()
            await session.refresh(existing)

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

    if course_id is not None:
        # A client-supplied course id is a request, not a permission.
        await assert_course_access(session, person, course_id)
        statement = statement.where(Document.course_id == course_id)
    else:
        allowed = await course_ids_for(session, person)
        if allowed is not None:
            statement = statement.where(Document.course_id.in_(allowed))

    result = await session.execute(statement)
    return list(result.scalars().all())


@router.get("/{document_id}", response_model=DocumentOut, summary="Document status")
async def get_document(
    document_id: uuid.UUID,
    principal: CurrentPrincipal,
    session: SessionDep,
) -> Document:
    document = await session.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.delete("/{document_id}", status_code=204, summary="Delete a document")
async def delete_document(
    document_id: uuid.UUID,
    principal: CurrentPrincipal,
    session: SessionDep,
) -> Response:
    document = await session.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    await session.delete(document)
    await session.commit()
    return Response(status_code=204)
