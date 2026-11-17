"""Deterministic citation repair.

Small models often answer correctly but attach the wrong source number: the
fact is in source [1], the sentence says [2]. Prompting does not fix this
reliably (measured: 76% support with three different prompts).

Because we own the chunks, we can check the claim against every supplied source
and rewrite the marker when another source clearly supports it better. This is
deterministic and auditable: every change is reported, never silent.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.rag.context import Source

MARKER_RE = re.compile(r"\[(\d+)\]")
# Sentence-ish segments ending at a citation marker.
SEGMENT_RE = re.compile(r"[^.!?\n]{8,}\[\d+\]")
STOPWORDS = {
    "the", "and", "for", "with", "that", "this", "when", "are", "use", "used",
    "should", "must", "will", "from", "into", "not", "but", "its", "their",
    "they", "have", "has", "was", "were", "which", "what", "than", "then",
}
MIN_OVERLAP = 0.20
MARGIN = 0.15


@dataclass(frozen=True)
class Revision:
    sentence: str
    from_n: int
    to_n: int


def _tokens(text: str) -> set[str]:
    words = re.findall(r"[a-zA-Z0-9_.]+", text.lower())
    return {word for word in words if len(word) > 2 and word not in STOPWORDS}


def _overlap(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / len(a)


def repair_citations(text: str, sources: list[Source]) -> tuple[str, list[Revision]]:
    """Rewrite citation markers that point at a source which does not support them."""
    if not sources:
        return text, []

    by_number = {source.n: source for source in sources}
    revisions: list[Revision] = []

    for segment in SEGMENT_RE.findall(text):
        marker = MARKER_RE.search(segment)
        if marker is None:
            continue
        cited = int(marker.group(1))
        if cited not in by_number:
            continue

        claim = _tokens(segment[: marker.start()])
        scores = {
            number: _overlap(claim, _tokens(source.content))
            for number, source in by_number.items()
        }
        best = max(scores, key=lambda number: scores[number])

        if (
            best != cited
            and scores[best] >= MIN_OVERLAP
            and scores[best] - scores[cited] >= MARGIN
        ):
            revisions.append(Revision(sentence=segment.strip(), from_n=cited, to_n=best))

    repaired = text
    for revision in revisions:
        # Replace only within the specific sentence that was judged wrong.
        repaired = repaired.replace(
            revision.sentence,
            revision.sentence.replace(
                f"[{revision.from_n}]", f"[{revision.to_n}]", 1
            ),
            1,
        )

    # Collapse consecutive duplicate citations such as "[2] [2]" or "[2][2]".
    repaired = re.sub(r"(\[\d+\])(?:\s*\1)+", r"\1", repaired)

    return repaired, revisions
