---
title: Local AI models
description: Run chat and embeddings on your own machine with Ollama, and switch providers without changing the app.
---

The platform ships with local models by default. Nothing you type, upload, or ask leaves the machine unless you configure a cloud provider.

## Default models

| Purpose | Model | Notes |
| --- | --- | --- |
| Chat | `qwen2.5:7b` | Good instruction following, runs on a laptop GPU or Apple silicon |
| Embeddings | `nomic-embed-text` | 768 dimensions, matches the database schema |

```bash
ollama pull qwen2.5:7b
ollama pull nomic-embed-text
```

## Choosing a provider

| Setting | Behaviour |
| --- | --- |
| `AI_PROVIDER=ollama` | Local models only; works offline |
| `AI_PROVIDER=gemini` | Cloud models; needs an API key |
| `AI_PROVIDER=stub` | Deterministic fakes for tests, no model needed |
| `AI_PROVIDER=auto` | Gemini when a key is present, otherwise Ollama |

The embedding provider follows the same rule. Chat and embeddings must agree on dimensions, which is why both default to 768.

## Privacy

With `ollama`:

- Prompts and documents stay local.
- The only network traffic is between the web app, the service, and Ollama on the same machine.
- Model downloads happen once, when you pull them.

With `gemini`, the passages sent in the prompt leave the machine. Uploaded files themselves stay in your database.

## Performance

| Workload | Typical local result |
| --- | --- |
| Grounded answer | p50 ~2.4 s, p95 ~6.2 s |
| Ungrounded chat | slower; the model tends to keep writing |
| Ingestion | 1–2 s per 16-page PDF |

A 7B model is the sweet spot for a laptop. Larger models improve phrasing but cost latency, and a small model plus good retrieval usually beats a large model with poor retrieval.

## Changing models

1. Pull the model with Ollama.
2. Set `OLLAMA_MODEL` (and `OLLAMA_EMBED_MODEL`) in the environment.
3. Restart the service.
4. Re-run the evaluation to confirm quality did not drop.

Changing the embedding model invalidates existing vectors: re-ingest documents after switching, because old and new vectors are not comparable.

> The model is replaceable. Retrieval quality, course scoping, and citation checks are what make answers trustworthy.
