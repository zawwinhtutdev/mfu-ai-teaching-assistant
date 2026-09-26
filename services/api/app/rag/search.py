"""Hybrid retrieval: vector similarity + lexical BM25-ish ranking, fused with RRF.

Vector search alone misses exact identifiers (course codes, "Section 4.2",
error strings); lexical search alone misses paraphrase. Reciprocal Rank Fusion
combines both without needing score calibration between them.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

RRF_K = 60


@dataclass(frozen=True)
class SearchHit:
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    filename: str
    content: str
    page_from: int | None
    page_to: int | None
    section: str | None
    score: float


_VECTOR_SQL = """
select c.id, c.document_id, c.content, c.page_from, c.page_to, c.section,
       row_number() over (order by c.embedding <=> cast(:vector as vector)) as rank
from document_chunks c
where (cast(:course_id as uuid) is null or c.document_id in (
    select id from documents where course_id = cast(:course_id as uuid)
))
order by c.embedding <=> cast(:vector as vector)
limit :pool
"""

_LEXICAL_SQL = """
select c.id, c.document_id, c.content, c.page_from, c.page_to, c.section,
       row_number() over (order by ts_rank(c.tsv, plainto_tsquery('english', :query)) desc) as rank
from document_chunks c
where c.tsv @@ plainto_tsquery('english', :query)
  and (cast(:course_id as uuid) is null or c.document_id in (
      select id from documents where course_id = cast(:course_id as uuid)
  ))
order by ts_rank(c.tsv, plainto_tsquery('english', :query)) desc
limit :pool
"""

_FUSE_SQL = """
with vector_hits as ({vector_sql}),
     lexical_hits as ({lexical_sql}),
     fused as (
        select id, document_id, content, page_from, page_to, section,
               sum(score) as score
        from (
            select id, document_id, content, page_from, page_to, section,
                   1.0 / (:rrf_k + rank) as score
            from vector_hits
            union all
            select id, document_id, content, page_from, page_to, section,
                   1.0 / (:rrf_k + rank) as score
            from lexical_hits
        ) parts
        group by id, document_id, content, page_from, page_to, section
     )
select f.id, f.document_id, d.filename, f.content, f.page_from, f.page_to,
       f.section, f.score
from fused f
join documents d on d.id = f.document_id
order by f.score desc
limit :limit
"""


def _vector_literal(vector: list[float]) -> str:
    return "[" + ",".join(f"{v:.6f}" for v in vector) + "]"


async def hybrid_search(
    session: AsyncSession,
    *,
    query: str,
    vector: list[float],
    course_id: uuid.UUID | None = None,
    limit: int = 5,
    pool: int = 30,
) -> list[SearchHit]:
    if not query.strip():
        return []

    statement = text(
        _FUSE_SQL.format(vector_sql=_VECTOR_SQL, lexical_sql=_LEXICAL_SQL)
    )

    rows = await session.execute(
        statement,
        {
            "vector": _vector_literal(vector),
            "query": query,
            "course_id": str(course_id) if course_id else None,
            "pool": pool,
            "limit": limit,
            "rrf_k": RRF_K,
        },
    )

    return [
        SearchHit(
            chunk_id=row.id,
            document_id=row.document_id,
            filename=row.filename,
            content=row.content,
            page_from=row.page_from,
            page_to=row.page_to,
            section=row.section,
            score=float(row.score),
        )
        for row in rows
    ]
