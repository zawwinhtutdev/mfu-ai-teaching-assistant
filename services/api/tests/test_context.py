"""Context assembly: numbering, dedupe and budget."""

from __future__ import annotations

import uuid

from app.rag.context import build_context
from app.rag.search import SearchHit

DOC = uuid.uuid4()


def _hit(content: str, page: int = 1, section: str | None = None, score: float = 0.03) -> SearchHit:
    return SearchHit(
        chunk_id=uuid.uuid4(),
        document_id=DOC,
        filename="policy.pdf",
        content=content,
        page_from=page,
        page_to=page,
        section=section,
        score=score,
        similarity=0.8,
    )


def test_sources_are_numbered_from_one() -> None:
    built = build_context([_hit("alpha text one", 1), _hit("beta text two", 2)])
    assert [s.n for s in built.sources] == [1, 2]
    assert built.text.startswith("[1] (policy.pdf, p. 1)")
    assert "[2] (policy.pdf, p. 2)" in built.text


def test_empty_hits_produce_empty_context() -> None:
    built = build_context([])
    assert built.is_empty
    assert built.text == ""


def test_same_page_and_section_is_deduplicated() -> None:
    built = build_context(
        [
            _hit("first passage about grading", 4, "Assessment"),
            _hit("second different wording entirely here", 4, "Assessment"),
        ]
    )
    assert len(built.sources) == 1


def test_near_duplicate_text_is_deduplicated() -> None:
    words = "the grading rubric rewards threat modelling and automated tests in projects"
    built = build_context([_hit(words, 1), _hit(words + " too", 1)])
    assert len(built.sources) == 1


def test_distinct_pages_are_kept() -> None:
    built = build_context([_hit("aaa bbb ccc", 1), _hit("xxx yyy zzz", 2)])
    assert len(built.sources) == 2


def test_budget_stops_adding_sources() -> None:
    hits = [_hit("x" * 300, page=i) for i in range(1, 6)]
    built = build_context(hits, max_chars=700)
    assert len(built.sources) < len(hits)
    assert len(built.text) < 1200


def test_section_label_rendered() -> None:
    built = build_context([_hit("content", 8, "6.1 HTTP Errors")])
    assert "§ 6.1 HTTP Errors" in built.text
