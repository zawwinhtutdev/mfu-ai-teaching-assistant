"""Citation repair: rewrite markers that point at the wrong source."""

from __future__ import annotations

import uuid

from app.rag.citation_repair import repair_citations
from app.rag.context import Source


def _source(n: int, content: str) -> Source:
    return Source(
        n=n,
        chunk_id=uuid.uuid4(),
        document_id=uuid.uuid4(),
        filename="doc.pdf",
        page_from=n,
        page_to=n,
        section=None,
        content=content,
    )


def test_correct_marker_is_untouched() -> None:
    sources = [
        _source(1, "Use 401 when the user is not authenticated."),
        _source(2, "Route handlers keep checks, orchestration and response output."),
    ]
    text = "Use 401 when the user is not authenticated [1]."
    repaired, revisions = repair_citations(text, sources)
    assert repaired == text
    assert revisions == []


def test_wrong_marker_is_rewritten() -> None:
    sources = [
        _source(1, "Use 401 when the user is not authenticated."),
        _source(2, "Route handlers keep checks, orchestration and response output."),
    ]
    text = "Use 401 when the user is not authenticated [2]."
    repaired, revisions = repair_citations(text, sources)
    assert "[1]" in repaired
    assert len(revisions) == 1
    assert revisions[0].from_n == 2
    assert revisions[0].to_n == 1


def test_ambiguous_citation_is_left_alone() -> None:
    sources = [
        _source(1, "Assessment is forty percent coursework."),
        _source(2, "Assessment is sixty percent final project."),
    ]
    text = "Assessment is split between coursework and project [1]."
    _, revisions = repair_citations(text, sources)
    assert revisions == []


def test_no_sources_returns_input() -> None:
    text = "Some answer [1]."
    repaired, revisions = repair_citations(text, [])
    assert repaired == text
    assert revisions == []


def test_marker_beyond_sources_is_ignored() -> None:
    sources = [_source(1, "Only one source here.")]
    text = "A claim about something [9]."
    repaired, revisions = repair_citations(text, sources)
    assert repaired == text
    assert revisions == []
