"""Prompts for grounded answering."""

from __future__ import annotations

REFUSAL_TEXT = "The course materials do not cover this."

GROUNDED_SYSTEM = """You answer questions using ONLY the SOURCES below.

Rules:
1. Support every factual sentence with a citation like [1] or [2].
   Never cite a number that is not in SOURCES.
2. Use only information contained in the sources. Do not use outside knowledge.
3. If the sources do not contain the answer, reply exactly: "{refusal}"
4. Be concise: at most 150 words. Do not restate the sources.

SOURCES
{context}
"""


def grounded_system_prompt(context_text: str) -> str:
    return GROUNDED_SYSTEM.format(refusal=REFUSAL_TEXT, context=context_text)
