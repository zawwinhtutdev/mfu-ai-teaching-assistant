---
title: How answers are grounded
description: From PDF to cited sentence: extraction, chunking, hybrid retrieval, prompting, citation repair, and refusal.
---

Every answer goes through the same pipeline. Understanding it explains both why citations appear and why the assistant sometimes refuses.

## The eight steps

| Step | What happens |
| --- | --- |
| 1. Extract | Text is read page by page; control characters are stripped so the text can be stored safely |
| 2. Chunk | Text is split into ~1,200 character pieces with 200 characters of overlap, keeping page numbers |
| 3. Embed | Each chunk gets a vector (768 dimensions) from the embedding model |
| 4. Index | The same chunk gets a keyword index for exact-term search |
| 5. Retrieve | Your question is matched against both indexes, scoped to one course |
| 6. Fuse | The two ranked lists are merged with reciprocal rank fusion |
| 7. Generate | The top passages are placed in the prompt; the model must answer only from them |
| 8. Check | Citations are verified against the supplied passages and repaired when they point at the wrong source |

## Why both vector and keyword search

Vector search finds meaning ("how much is the fee" matches "tuition cost"). Keyword search finds exact tokens that embeddings blur: course codes, `401`, section numbers, Thai names.

Results are combined with reciprocal rank fusion, which rewards passages that rank well in either list without letting one list dominate.

> On a small corpus the two methods often tie. The keyword branch matters most for exact identifiers, which is exactly where pure embeddings fail.

## Why answers can refuse

After retrieval, the service checks whether the best passage is actually relevant. If nothing clears the relevance bar, it returns:

```text
The course materials do not cover this.
```

The bar is deliberately conservative. Refusing is better than answering from general knowledge, because a plausible wrong answer about a deadline is worse than no answer.

## Citation repair

A small local model sometimes attaches the right claim to the wrong number. After generation, each cited sentence is compared with every supplied passage:

- If another passage supports the sentence clearly better, the marker is rewritten.
- If two passages are too close to call, the marker is left alone.
- Every change is reported with the response, so nothing is silently altered.

Example: `"... not authenticated [2]"` became `[1]` because passage 2 was about response handling and passage 1 was the HTTP errors section.

## How the pipeline is measured

A 25-question evaluation set runs against three retrieval settings and reports:

| Metric | What it tells you |
| --- | --- |
| Recall@5 | Whether the right passage was retrieved at all |
| Refusal accuracy | Whether unanswerable questions were refused |
| Citation validity | Whether every marker points at a supplied source |
| Citation support | Whether the cited passage really contains the claim |
| p50 / p95 latency | Responsiveness on the target hardware |

Current local results: recall@5 100%, refusal accuracy 96–100%, citation validity 100%, citation support about 81% after repair, p50 around 2.4 s.

> Support below 100% is reported honestly. The remaining cases are usually questions whose answer spans two passages, where a single citation cannot represent the whole claim.
