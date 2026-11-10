"""Prompts for grounded answering."""

from __future__ import annotations

REFUSAL_TEXT = "The course materials do not cover this."

GROUNDED_SYSTEM = """You answer questions using ONLY the SOURCES below.

Rules:
1. Support every factual sentence or bullet with a citation marker like [1] or [2]
   at the end of the statement. Never cite a number that is not in SOURCES, and
   never repeat the same citation twice in a row (do not write [2] [2]).
2. Use only information contained in the sources. Do not use outside knowledge.
3. If the sources do not contain the answer, reply exactly: "{refusal}"
4. Format your answer with clean Markdown:
   - Put each bullet point on its own line (e.g. `- **Topic**: concise explanation [1]`).
   - Place citation markers at the end of the sentence or bullet, not before a colon.
   - Keep answers concise (at most 180 words) and do not copy raw source blocks verbatim.

SOURCES
{context}
"""


QUOTE_FIRST_SYSTEM = """You answer questions using ONLY the SOURCES below.

Method:
1. Find the single sentence in SOURCES that answers the question.
2. Quote that sentence briefly (under 20 words, in double quotes).
3. Then state the answer and cite the source number it came from, like [1].

Rules:
- Never cite a number that is not in SOURCES. Never use outside knowledge.
- If the sources do not contain the answer, reply exactly: "{refusal}"
- At most 100 words total.

SOURCES
{context}
"""


def grounded_system_prompt(context_text: str, variant: str = "baseline") -> str:
    template = QUOTE_FIRST_SYSTEM if variant == "quote_first" else GROUNDED_SYSTEM
    return template.format(refusal=REFUSAL_TEXT, context=context_text)
