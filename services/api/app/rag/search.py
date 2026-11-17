"""Hybrid retrieval: vector similarity + lexical BM25-ish ranking, fused with RRF.

Vector search alone misses exact identifiers (course codes, "Section 4.2",
error strings); lexical search alone misses paraphrase. Reciprocal Rank Fusion
combines both without needing score calibration between them.

Scoping is authorization, not filtering: every query is constrained to the
course ids the caller may read.
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
    # Cosine similarity from the vector branch; the gate for refusals.
    similarity: float | None = None
    # True when the lexical branch matched: strong evidence even if the
    # embedding similarity happens to be low (e.g. exact identifiers).
    matched_lexically: bool = False


_VECTOR_SQL = """
select c.id, c.document_id, c.content, c.page_from, c.page_to, c.section,
       1 - (c.embedding <=> cast(:vector as vector)) as similarity,
       false as from_lexical,
       row_number() over (order by c.embedding <=> cast(:vector as vector)) as rank
from document_chunks c
where c.document_id in (
    select id from documents
    where (cast(:course_ids as text[]) is null or course_id = any(cast(:course_ids as text[])))
      and (cast(:document_ids as uuid[]) is null or id = any(cast(:document_ids as uuid[])))
)
order by c.embedding <=> cast(:vector as vector)
limit :pool
"""

_LEXICAL_SQL = """
select c.id, c.document_id, c.content, c.page_from, c.page_to, c.section,
       null::float as similarity,
       true as from_lexical,
       row_number() over (order by ts_rank(c.tsv, plainto_tsquery('english', :query)) desc) as rank
from document_chunks c
where c.tsv @@ plainto_tsquery('english', :query)
  and c.document_id in (
      select id from documents
      where (cast(:course_ids as text[]) is null or course_id = any(cast(:course_ids as text[])))
        and (cast(:document_ids as uuid[]) is null or id = any(cast(:document_ids as uuid[])))
  )
order by ts_rank(c.tsv, plainto_tsquery('english', :query)) desc
limit :pool
"""

_FUSE_SQL = """
with vector_hits as ({vector_sql}),
     lexical_hits as ({lexical_sql}),
     fused as (
        select id, document_id, content, page_from, page_to, section,
               sum(score) as score,
               max(similarity) as similarity,
               bool_or(from_lexical) as matched_lexically
        from (
            select id, document_id, content, page_from, page_to, section, similarity,
                   from_lexical, 1.0 / (:rrf_k + rank) as score
            from vector_hits
            union all
            select id, document_id, content, page_from, page_to, section, similarity,
                   from_lexical, 1.0 / (:rrf_k + rank) as score
            from lexical_hits
        ) parts
        group by id, document_id, content, page_from, page_to, section
     )
select f.id, f.document_id, d.filename, f.content, f.page_from, f.page_to,
       f.section, f.score, f.similarity, f.matched_lexically
from fused f
join documents d on d.id = f.document_id
order by f.score desc
limit :limit
"""


_DOC_CHUNKS_SQL = """
with target_docs as (
    select d.id, d.filename, d.created_at,
           coalesce(
               d.page_count,
               (
                   select max(coalesce(c2.page_to, c2.page_from))
                   from document_chunks c2
                   where c2.document_id = d.id
               )
           ) as max_page
    from documents d
    where d.status = 'ready'
      and (cast(:course_ids as text[]) is null or d.course_id = any(cast(:course_ids as text[])))
      and (cast(:document_ids as uuid[]) is null or d.id = any(cast(:document_ids as uuid[])))
)
select c.id, c.document_id, td.filename, c.content, c.page_from, c.page_to, c.section,
       1.0::float as score,
       1.0::float as similarity,
       true as matched_lexically
from document_chunks c
join target_docs td on td.id = c.document_id
where (
    cast(:page_number as integer) is null
    or (
        cast(:page_number as integer) = -1
        and td.max_page is not null
        and c.page_from is not null
        and c.page_from <= td.max_page
        and coalesce(c.page_to, c.page_from) >= td.max_page
    )
    or (
        cast(:page_number as integer) > 0
        and c.page_from is not null
        and c.page_from <= cast(:page_number as integer)
        and coalesce(c.page_to, c.page_from) >= cast(:page_number as integer)
    )
)
order by td.created_at desc, c.chunk_index asc
limit :limit
"""


async def fetch_document_chunks(
    session: AsyncSession,
    *,
    course_ids: list[str] | None = None,
    document_ids: list[uuid.UUID] | None = None,
    page_number: int | None = None,
    limit: int = 10,
) -> list[SearchHit]:
    """Fetch ordered chunks for page-level or document-overview queries."""
    if course_ids is not None and not course_ids:
        return []
    if document_ids is not None and not document_ids:
        return []

    rows = await session.execute(
        text(_DOC_CHUNKS_SQL),
        {
            "course_ids": list(course_ids) if course_ids is not None else None,
            "document_ids": list(document_ids) if document_ids is not None else None,
            "page_number": page_number,
            "limit": limit,
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
            similarity=float(row.similarity) if row.similarity is not None else None,
            matched_lexically=bool(row.matched_lexically),
        )
        for row in rows
    ]


def _vector_literal(vector: list[float]) -> str:
    return "[" + ",".join(f"{v:.6f}" for v in vector) + "]"


async def hybrid_search(
    session: AsyncSession,
    *,
    query: str,
    vector: list[float],
    course_ids: list[str] | None = None,
    document_ids: list[uuid.UUID] | None = None,
    limit: int = 5,
    pool: int = 30,
    mode: str = "hybrid",
) -> list[SearchHit]:
    """Rank chunks for a query inside an explicit course scope.

    ``course_ids`` is the caller's authorization scope, not a UI filter: ``None``
    means unrestricted (admin only) and an empty list means "no courses" and
    returns nothing. Callers pass ``course_scope_for(...)`` directly, so an
    unauthenticated or unscoped request can never read the whole corpus.
    ``document_ids`` optionally narrows retrieval to specific selected PDFs
    within that same authorized course scope.
    """
    if not query.strip():
        return []

    if course_ids is not None and not course_ids:
        return []

    if document_ids is not None and not document_ids:
        return []

    if mode == "vector":
        # Lexical branch disabled: used as an evaluation baseline.
        lexical = (
            "select c.id, c.document_id, c.content, c.page_from, c.page_to, c.section, "
            "null::float as similarity, false as from_lexical, row_number() over () as rank "
            "from document_chunks c where false"
        )
    else:
        lexical = _LEXICAL_SQL

    statement = text(_FUSE_SQL.format(vector_sql=_VECTOR_SQL, lexical_sql=lexical))

    rows = await session.execute(
        statement,
        {
            "vector": _vector_literal(vector),
            "query": query,
            "course_ids": list(course_ids) if course_ids is not None else None,
            "document_ids": list(document_ids) if document_ids is not None else None,
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
            similarity=float(row.similarity) if row.similarity is not None else None,
            matched_lexically=bool(row.matched_lexically),
        )
        for row in rows
    ]
