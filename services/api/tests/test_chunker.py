"""Chunker unit tests — no database or network."""

from __future__ import annotations

import pytest

from app.rag.chunker import chunk_pages


def test_empty_input_yields_no_chunks() -> None:
    assert chunk_pages([]) == []
    assert chunk_pages(["   ", "\n"]) == []


def test_short_document_is_a_single_chunk() -> None:
    chunks = chunk_pages(["Course policy: late work is capped at 50%."])
    assert len(chunks) == 1
    assert chunks[0].page_from == 1
    assert chunks[0].page_to == 1
    assert "late work" in chunks[0].text


def test_long_document_splits_with_overlap() -> None:
    page = " ".join(f"Sentence number {i} about the syllabus." for i in range(200))
    chunks = chunk_pages([page], target_chars=600, overlap_chars=100)

    assert len(chunks) > 1
    assert all(len(chunk.text) <= 700 for chunk in chunks)
    # Consecutive chunks should share some text (overlap).
    first_tail = chunks[0].text[-40:]
    assert first_tail in chunks[1].text or chunks[1].text[:40] in chunks[0].text


def test_pages_are_tracked() -> None:
    pages = [
        "Page one talks about enrollment.",
        "Page two talks about assessment and grading.",
        "Page three talks about appeals.",
    ]
    chunks = chunk_pages(pages, target_chars=60, overlap_chars=10)

    assert chunks[0].page_from == 1
    assert chunks[-1].page_to == 3
    assert all(c.page_from <= c.page_to for c in chunks)


def test_headings_are_captured_as_sections() -> None:
    page = (
        "# Assessment\n"
        "Assessment consists of quizzes and a final project.\n\n"
        "# Attendance\n"
        "Attendance is recorded every session.\n"
    )
    chunks = chunk_pages([page], target_chars=500, overlap_chars=50)
    sections = {chunk.section for chunk in chunks}
    assert any(s and "Assessment" in s for s in sections)


def test_chunks_do_not_start_mid_word() -> None:
    page = ("alpha " * 300).strip()
    chunks = chunk_pages([page], target_chars=200, overlap_chars=20)
    for chunk in chunks[1:]:
        assert not chunk.text.startswith("pha")


def test_invalid_parameters_rejected() -> None:
    with pytest.raises(ValueError):
        chunk_pages(["text"], target_chars=0)
    with pytest.raises(ValueError):
        chunk_pages(["text"], target_chars=100, overlap_chars=100)
