"""Text chunking for retrieval.

Chunks are built from a character stream that records which PDF page each
offset came from, so every chunk can cite the pages (and nearest heading) it
covers. Splits prefer paragraph breaks, then sentence boundaries, and never
cut mid-word.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

HEADING_RE = re.compile(
    r"^\s*(?:#{1,6}\s+\S.*|\d+(?:\.\d+)*\.?\s+[A-Z][^.!?]{2,80}|[A-Z][A-Z0-9 &/,'()\-]{3,80})$"
)
SENTENCE_RE = re.compile(r"(?<=[.!?])\s+")


@dataclass(frozen=True)
class Chunk:
    text: str
    page_from: int
    page_to: int
    section: str | None


@dataclass(frozen=True)
class _PageMark:
    offset: int
    page: int


@dataclass(frozen=True)
class _Heading:
    offset: int
    title: str


def _build_stream(pages: list[str]) -> tuple[str, list[_PageMark], list[_Heading]]:
    parts: list[str] = []
    marks: list[_PageMark] = []
    headings: list[_Heading] = []
    cursor = 0

    for index, page_text in enumerate(pages, start=1):
        cleaned = page_text.replace("\r\n", "\n").replace("\r", "\n").strip()
        if not cleaned:
            continue
        marks.append(_PageMark(offset=cursor, page=index))

        for line in cleaned.split("\n"):
            stripped = line.strip()
            if stripped and HEADING_RE.match(stripped) and len(stripped) <= 90:
                # Record the heading at its position within the stream.
                pos = cursor + cleaned.find(stripped)
                headings.append(_Heading(offset=pos, title=stripped.lstrip("#").strip()))

        parts.append(cleaned)
        cursor += len(cleaned) + 2  # "\n\n" separator

    return "\n\n".join(parts), marks, headings


def _page_at(marks: list[_PageMark], offset: int) -> int:
    page = marks[0].page if marks else 1
    for mark in marks:
        if mark.offset <= offset:
            page = mark.page
        else:
            break
    return page


def _section_at(headings: list[_Heading], offset: int) -> str | None:
    title: str | None = None
    for heading in headings:
        if heading.offset <= offset:
            title = heading.title
        else:
            break
    return title


def _choose_split(text: str, start: int, target: int) -> int:
    """Pick an end position close to ``target`` on a natural boundary."""
    end = min(start + target, len(text))
    if end >= len(text):
        return len(text)

    window_start = start + int(target * 0.6)
    window = text[window_start:end]

    paragraph = window.rfind("\n\n")
    if paragraph != -1:
        return window_start + paragraph

    sentences = [m.end() for m in SENTENCE_RE.finditer(window)]
    if sentences:
        return window_start + sentences[-1]

    space = window.rfind(" ")
    if space != -1:
        return window_start + space

    return end


def chunk_pages(
    pages: list[str],
    target_chars: int = 1200,
    overlap_chars: int = 200,
) -> list[Chunk]:
    """Split page texts into overlapping, page-citable chunks."""
    if target_chars <= 0:
        raise ValueError("target_chars must be positive")
    if overlap_chars < 0 or overlap_chars >= target_chars:
        raise ValueError("overlap_chars must be >= 0 and < target_chars")

    text, marks, headings = _build_stream(pages)
    if not text.strip():
        return []

    chunks: list[Chunk] = []
    start = 0
    length = len(text)

    while start < length:
        end = _choose_split(text, start, target_chars)
        piece = text[start:end].strip()

        if piece:
            chunks.append(
                Chunk(
                    text=piece,
                    page_from=_page_at(marks, start),
                    page_to=_page_at(marks, max(start, end - 1)),
                    section=_section_at(headings, start),
                )
            )

        if end >= length:
            break
        next_start = max(end - overlap_chars, start + 1)
        # Snap the overlap boundary to a word edge when possible.
        space = text.find(" ", next_start, end)
        start = space + 1 if space != -1 else next_start

    return chunks
