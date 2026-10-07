#!/usr/bin/env python3
"""Grounded-answering evaluation.

Runs every dataset case through three configurations and reports retrieval
recall, refusal accuracy, citation validity and latency.

    python evals/run.py                       # stub or real model, whichever the API has
    python evals/run.py --token "$TOKEN"      # authenticate a normal deployment
    python evals/run.py --dev-principal demo@mfu.ac.th

Recall is measured on ``/v1/search`` (chunk text), not on the generated answer,
so it stays meaningful even when the model is a stub. Answer text is scored for
citation presence, and refusals are scored against the `expect` field.
"""

from __future__ import annotations

import argparse
import asyncio
import json
import statistics
import sys
import time
from pathlib import Path
from typing import Any

import httpx
import yaml

ROOT = Path(__file__).resolve().parent
CONFIGS: dict[str, dict[str, Any]] = {
    "no-retrieval": {"use_retrieval": False},
    "vector": {"use_retrieval": True, "retrieval_mode": "vector"},
    "hybrid": {"use_retrieval": True, "retrieval_mode": "hybrid"},
}
TOP_K = 5


def load_dataset() -> dict[str, Any]:
    with (ROOT / "dataset.yaml").open() as handle:
        return yaml.safe_load(handle)


async def search_once(
    client: httpx.AsyncClient, case: dict[str, Any], headers: dict[str, str]
) -> list[dict[str, Any]]:
    response = await client.post(
        "/v1/search",
        json={"query": case["question"], "limit": TOP_K},
        headers=headers,
    )
    response.raise_for_status()
    return response.json()["hits"]


async def chat_once(
    client: httpx.AsyncClient,
    case: dict[str, Any],
    config: dict[str, Any],
    headers: dict[str, str],
) -> dict[str, Any]:
    payload = {
        "messages": [{"role": "user", "content": case["question"]}],
        "top_k": TOP_K,
        **config,
    }
    started = time.perf_counter()
    text = ""
    sources: list[dict[str, Any]] = []
    done: dict[str, Any] = {}
    provider: str | None = None

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
            elif event["type"] == "start":
                provider = event["provider"]
            elif event["type"] == "delta":
                text += event["text"]
            elif event["type"] == "done":
                done = event
            elif event["type"] == "error":
                done = {"error": event["message"]}

    return {
        "text": text,
        "sources": sources,
        "done": done,
        "provider": provider,
        "latency_ms": (time.perf_counter() - started) * 1000,
    }


def keyword_hit(hits: list[dict[str, Any]], keywords: list[str]) -> bool:
    if not keywords:
        return True
    haystack = " ".join(hit["content"] for hit in hits).lower()
    return any(keyword.lower() in haystack for keyword in keywords)


async def run_case(
    client: httpx.AsyncClient,
    case: dict[str, Any],
    config_name: str,
    headers: dict[str, str],
) -> dict[str, Any]:
    config = CONFIGS[config_name]
    result = await chat_once(client, case, config, headers)

    expected_refusal = case["expect"] == "refusal"
    refused = bool(result["done"].get("refusal"))
    text = result["text"]
    cited = "[" in text and "]" in text

    # Does a cited source actually contain the expected terms?
    cited_numbers = result["done"].get("sources_used", [])
    cited_snippets = [
        source.get("snippet", "")
        for source in result["sources"]
        if source["n"] in cited_numbers
    ]
    support_haystack = " ".join(cited_snippets).lower()
    citation_supported: bool | None = None
    if case["keywords"] and not refused:
        citation_supported = any(
            keyword.lower() in support_haystack for keyword in case["keywords"]
        )

    recall: bool | None = None
    if config.get("use_retrieval") and case["keywords"]:
        hits = await search_once(client, case, headers)
        recall = keyword_hit(hits, case["keywords"])

    return {
        "id": case["id"],
        "type": case["type"],
        "expect": case["expect"],
        "config": config_name,
        "provider": result["provider"],
        "refused": refused,
        "refusal_ok": refused == expected_refusal,
        "grounded": bool(result["sources"]),
        "sources": len(result["sources"]),
        "citation_present": cited,
        "citation_supported": citation_supported,
        "invalid_citations": result["done"].get("invalid_citations", []),
        "recall": recall,
        "latency_ms": round(result["latency_ms"], 1),
        "error": result["done"].get("error"),
        "answer": text[:280],
    }


def summarise(rows: list[dict[str, Any]], config: str) -> dict[str, Any]:
    subset = [row for row in rows if row["config"] == config]
    answerable = [row for row in subset if row["expect"] == "answer"]
    recalls = [row["recall"] for row in subset if row["recall"] is not None]
    latencies = [row["latency_ms"] for row in subset]
    answered = [row for row in answerable if not row["refused"]]

    def pct(values: list[bool]) -> float:
        return 100.0 * sum(values) / len(values) if values else 0.0

    return {
        "config": config,
        "recall@5": pct(recalls) if recalls else None,
        "refusal_acc": pct([row["refusal_ok"] for row in subset]),
        "citation_rate": pct([row["citation_present"] for row in answered]),
        "citation_support": pct(
            [row["citation_supported"] for row in answered if row["citation_supported"] is not None]
        ),
        "grounded_rate": pct([row["grounded"] for row in answered]),
        "invalid_citations": sum(1 for row in subset if row["invalid_citations"]),
        "p50_ms": round(statistics.median(latencies), 1) if latencies else 0,
        "p95_ms": round(
            statistics.quantiles(latencies, n=20)[-1] if len(latencies) > 2 else max(latencies),
            1,
        )
        if latencies
        else 0,
        "cases": len(subset),
        "errors": sum(1 for row in subset if row["error"]),
    }


def print_table(summaries: list[dict[str, Any]], provider: str | None) -> None:
    print(f"\nmodel provider: {provider or 'unknown'}\n")
    header = (
        f"{'config':<14}{'recall@5':>10}{'refusal':>10}{'citation':>10}"
        f"{'grounded':>10}{'cite sup.':>11}{'bad cite':>10}{'p50 ms':>9}{'p95 ms':>9}"
    )
    print(header)
    print("-" * len(header))
    for row in summaries:
        recall = f"{row['recall@5']:.0f}%" if row["recall@5"] is not None else "n/a"
        print(
            f"{row['config']:<14}{recall:>10}{row['refusal_acc']:>9.0f}%"
            f"{row['citation_rate']:>9.0f}%{row['grounded_rate']:>9.0f}%"
            f"{row['citation_support']:>10.0f}%"
            f"{row['invalid_citations']:>10}{row['p50_ms']:>9.0f}{row['p95_ms']:>9.0f}"
        )


async def main() -> int:
    parser = argparse.ArgumentParser(description="Run the grounded-answering eval")
    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--token", default=None, help="Supabase access token")
    parser.add_argument("--dev-principal", default=None, help="X-Dev-Principal value")
    parser.add_argument("--out", default=str(ROOT / "results.json"))
    args = parser.parse_args()

    headers: dict[str, str] = {}
    if args.token:
        headers["Authorization"] = f"Bearer {args.token}"
    elif args.dev_principal:
        headers["X-Dev-Principal"] = args.dev_principal
    else:
        headers["X-Dev-Principal"] = "eval@mfu.ac.th"

    dataset = load_dataset()
    cases = dataset["cases"]
    rows: list[dict[str, Any]] = []
    provider: str | None = None

    async with httpx.AsyncClient(base_url=args.base_url, timeout=120.0) as client:
        for config_name in CONFIGS:
            for case in cases:
                row = await run_case(client, case, config_name, headers)
                provider = provider or row["provider"]
                rows.append(row)
                status = "ok" if not row["error"] else f"ERROR: {row['error']}"
                print(f"  [{config_name:<12}] {case['id']:<26} {status}")

    summaries = [summarise(rows, config_name) for config_name in CONFIGS]
    print_table(summaries, provider)

    payload = json.dumps({"summary": summaries, "rows": rows}, indent=2)
    await asyncio.to_thread(Path(args.out).write_text, payload)
    print(f"\nwrote {args.out}")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
