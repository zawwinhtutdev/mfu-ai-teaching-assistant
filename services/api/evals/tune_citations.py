#!/usr/bin/env python3
"""Citation-tuning experiment.

Compares three configurations on the same hybrid retrieval, so we can tell
which change actually moves citation support:

    A  top_k=5  baseline prompt      (current default)
    B  top_k=3  baseline prompt      (fewer candidate sources)
    C  top_k=3  quote-first prompt   (quote the source sentence first)

Usage: python evals/tune_citations.py
"""

from __future__ import annotations

import asyncio
import json
import statistics
import sys
from pathlib import Path
from typing import Any

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent))

from run import load_dataset  # noqa: E402

VARIANTS: list[dict[str, Any]] = [
    {"name": "A baseline (k=5)", "top_k": 5, "prompt_variant": "baseline"},
    {"name": "B k=3", "top_k": 3, "prompt_variant": "baseline"},
    {"name": "C k=3 + quote", "top_k": 3, "prompt_variant": "quote_first"},
]


async def one_case(
    client: httpx.AsyncClient,
    case: dict[str, Any],
    variant: dict[str, Any],
    headers: dict[str, str],
) -> dict[str, Any]:
    payload = {
        "messages": [{"role": "user", "content": case["question"]}],
        "top_k": variant["top_k"],
        "prompt_variant": variant["prompt_variant"],
    }
    text = ""
    sources: list[dict[str, Any]] = []
    done: dict[str, Any] = {}

    async with client.stream("POST", "/v1/chat", json=payload, headers=headers) as response:
        response.raise_for_status()
        async for line in response.aiter_lines():
            if not line.startswith("data: "):
                continue
            raw = line[6:]
            if raw == "[DONE]":
                break
            event = json.loads(raw)
            if event["type"] == "sources":
                sources = event["sources"]
            elif event["type"] == "delta":
                text += event["text"]
            elif event["type"] == "done":
                done = event

    refused = bool(done.get("refusal"))

    def supports(numbers: list[int]) -> bool:
        snippets = [s.get("snippet", "") for s in sources if s["n"] in numbers]
        haystack = " ".join(snippets).lower()
        return any(keyword.lower() in haystack for keyword in case["keywords"])

    import re as _re

    raw_cited = sorted({int(m) for m in _re.findall(r"\[(\d+)\]", text)})
    repaired_cited = done.get("sources_used", [])

    supported: bool | None = None
    supported_repaired: bool | None = None
    if case["keywords"] and not refused:
        supported = supports(raw_cited)
        supported_repaired = supports(repaired_cited)

    return {
        "variant": variant["name"],
        "id": case["id"],
        "type": case["type"],
        "expect": case["expect"],
        "refused": refused,
        "supported": supported,
        "supported_repaired": supported_repaired,
        "revisions": len(done.get("citation_revisions", [])),
        "invalid": len(done.get("invalid_citations", [])),
        "words": len(text.split()),
    }


def pct(values: list[bool]) -> float:
    return 100.0 * sum(values) / len(values) if values else 0.0


async def main() -> int:
    dataset = load_dataset()
    cases = dataset["cases"]
    headers = {"X-Dev-Principal": "eval@mfu.ac.th"}
    rows: list[dict[str, Any]] = []

    async with httpx.AsyncClient(base_url="http://127.0.0.1:8000", timeout=180.0) as client:
        for variant in VARIANTS:
            print(f"running {variant['name']} ...")
            for case in cases:
                rows.append(await one_case(client, case, variant, headers))

    print()
    header = (
        f"{'variant':<18}{'support raw':>13}{'after repair':>14}"
        f"{'revisions':>11}{'refusal':>10}{'bad cite':>10}{'words':>7}"
    )
    print(header)
    print("-" * len(header))
    for variant in VARIANTS:
        subset = [row for row in rows if row["variant"] == variant["name"]]
        answered = [row for row in subset if not row["refused"]]
        support = [row["supported"] for row in answered if row["supported"] is not None]
        repaired = [
            row["supported_repaired"] for row in answered if row["supported_repaired"] is not None
        ]
        refusal = [row["refused"] == (row["expect"] == "refusal") for row in subset]
        words = [row["words"] for row in answered]
        print(
            f"{variant['name']:<18}{pct(support):>12.0f}%{pct(repaired):>13.0f}%"
            f"{sum(row['revisions'] for row in subset):>11}"
            f"{pct(refusal):>9.0f}%{sum(row['invalid'] for row in subset):>10}"
            f"{statistics.mean(words) if words else 0:>7.0f}"
        )

    await asyncio.to_thread(
        Path("evals/tune-results.json").write_text, json.dumps(rows, indent=2)
    )
    print("\nwrote evals/tune-results.json")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
