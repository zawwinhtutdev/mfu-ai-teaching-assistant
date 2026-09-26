"""Turning retrieved chunks into a numbered, budgeted context block."""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from app.rag.search import SearchHit

# Two chunks sharing this much vocabulary are treated as the same passage.
DUPLICATE_JACCARD = 0.80


@dataclass(frozen=True)
class Source:
    n: int
    chunk_id: uuid.UUID
    document_id: uuid.UUID
    filename: str
    page_from: int | None
    page_to: int | None
    section: str | None


@dataclass(frozen=True)
class BuiltContext:
    text: str
    sources: list[Source]

    @property
    def is_empty(self) -> bool:
        return not self.sources


def _words(text: str) -> set[str]:
    return {word.lower().strip(".,;:()[]\"'") for word in text.split() if len(word) > 3}


def _jaccard(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a | b)


def _page_label(page_from: int | None, page_to: int | None) -> str:
    if page_from and page_to and page_to != page_from:
        return f"pp. {page_from}-{page_to}"
    if page_from:
        return f"p. {page_from}"
    return "n.p."


def build_context(hits: list[SearchHit], max_chars: int = 2400) -> BuiltContext:
    """Deduplicate hits, enforce a character budget, and number the sources."""
    sources: list[Source] = []
    blocks: list[str] = []
    seen_keys: set[tuple[object, ...]] = set()
    kept_word_sets: list[set[str]] = []
    used = 0

    for hit in hits:
        key = (hit.document_id, hit.page_from, hit.page_to, hit.section)
        if key in seen_keys:
            continue

        words = _words(hit.content)
        if any(_jaccard(words, kept) >= DUPLICATE_JACCARD for kept in kept_word_sets):
            continue

        if blocks and used + len(hit.content) > max_chars:
            break

        n = len(sources) + 1
        sources.append(
            Source(
                n=n,
                chunk_id=hit.chunk_id,
                document_id=hit.document_id,
                filename=hit.filename,
                page_from=hit.page_from,
                page_to=hit.page_to,
                section=hit.section,
            )
        )
        label = f"[{n}] ({hit.filename}, {_page_label(hit.page_from, hit.page_to)}"
        if hit.section:
            label += f", § {hit.section}"
        label += ")"
        blocks.append(f"{label}\n{hit.content.strip()}")

        seen_keys.add(key)
        kept_word_sets.append(words)
        used += len(hit.content)

    return BuiltContext(text="\n\n".join(blocks), sources=sources)
