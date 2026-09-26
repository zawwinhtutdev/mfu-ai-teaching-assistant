"""Hybrid retrieval endpoint."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentPrincipal
from app.config import Settings, get_settings
from app.db import get_session
from app.rag.factory import get_embedder
from app.rag.search import hybrid_search
from app.schemas import SearchHitOut, SearchRequest, SearchResponse

router = APIRouter(tags=["search"])

SettingsDep = Annotated[Settings, Depends(get_settings)]
SessionDep = Annotated[AsyncSession, Depends(get_session)]


@router.post("/v1/search", response_model=SearchResponse, summary="Hybrid search over chunks")
async def search(
    request: SearchRequest,
    principal: CurrentPrincipal,
    settings: SettingsDep,
    session: SessionDep,
) -> SearchResponse:
    embedder = get_embedder(settings)
    vector = await embedder.embed_query(request.query)

    hits = await hybrid_search(
        session,
        query=request.query,
        vector=vector,
        course_id=request.course_id,
        limit=request.limit,
    )

    return SearchResponse(
        query=request.query,
        hits=[
            SearchHitOut(
                chunk_id=hit.chunk_id,
                document_id=hit.document_id,
                filename=hit.filename,
                content=hit.content,
                page_from=hit.page_from,
                page_to=hit.page_to,
                section=hit.section,
                score=round(hit.score, 6),
                similarity=round(hit.similarity, 4) if hit.similarity is not None else None,
                citation=_citation(hit.filename, hit.page_from, hit.page_to, hit.section),
            )
            for hit in hits
        ],
    )


def _citation(
    filename: str,
    page_from: int | None,
    page_to: int | None,
    section: str | None,
) -> str:
    parts = [filename]
    if page_from and page_to and page_to != page_from:
        parts.append(f"pp. {page_from}–{page_to}")
    elif page_from:
        parts.append(f"p. {page_from}")
    if section:
        parts.append(f'§ {section}')
    return ", ".join(parts)
