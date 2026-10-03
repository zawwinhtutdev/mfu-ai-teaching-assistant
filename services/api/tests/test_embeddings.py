"""Embedding stub tests — deterministic, unit length, lexical sensitivity."""

from __future__ import annotations

import asyncio
import math

from app.rag.embeddings import StubEmbeddings


def _run(coro: object) -> object:
    return asyncio.run(coro)  # type: ignore[arg-type]


def test_dimension_matches_schema() -> None:
    vectors = _run(StubEmbeddings().embed(["hello world"]))
    assert len(vectors[0]) == 768


def test_vectors_are_unit_length() -> None:
    vectors = _run(StubEmbeddings().embed(["late submission policy", "grading rubric"]))
    for vector in vectors:
        norm = math.sqrt(sum(v * v for v in vector))
        assert abs(norm - 1.0) < 1e-6


def test_deterministic_across_calls() -> None:
    embedder = StubEmbeddings()
    first = _run(embedder.embed(["assessment weightings"]))[0]
    second = _run(embedder.embed(["assessment weightings"]))[0]
    assert first == second


def test_lexical_overlap_scores_higher_than_unrelated() -> None:
    embedder = StubEmbeddings()
    query = _run(embedder.embed_query("late submission penalty"))
    related = _run(embedder.embed(["the late submission penalty is 50 percent"]))[0]
    unrelated = _run(embedder.embed(["campus parking and shuttle timetables"]))[0]

    def cosine(a: list[float], b: list[float]) -> float:
        return sum(x * y for x, y in zip(a, b, strict=True))

    assert cosine(query, related) > cosine(query, unrelated)


def test_empty_text_yields_zero_vector() -> None:
    vector = _run(StubEmbeddings().embed([""]))[0]
    assert all(v == 0.0 for v in vector)
