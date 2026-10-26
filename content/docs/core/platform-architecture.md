---
title: How the platform is built
description: The web app, the Python service, PostgreSQL with pgvector, and the local models that answer questions.
---

MFU AI Teaching Assistant is a web application plus a separate Python service. The web app handles sign-in, portals, and screens. The service owns retrieval, documents, and the database.

## Components

| Layer | Technology | Responsibility |
| --- | --- | --- |
| Web app | Next.js (App Router), React, TypeScript, Tailwind | Portals, screens, session handling, server-side proxy routes |
| API service | FastAPI, Pydantic, SQLAlchemy (async) | Authentication checks, documents, retrieval, streaming answers |
| Database | PostgreSQL 16 + pgvector | People, courses, enrollments, documents, chunks, embeddings |
| Models | Ollama (default), Gemini (optional) | Chat completion and embeddings |
| Packaging | Docker Compose | Runs the web app and service together |

## Request flow

1. The browser calls a Next.js route such as `/api/chat/stream`.
2. The route forwards the request to the Python service with the caller's identity.
3. The service resolves that identity to a person in the database.
4. It checks the course and enrollment, then retrieves passages from that course.
5. It streams the answer back as server-sent events.
6. The browser renders the text and the citations.

The browser never talks to the database directly, and never decides which documents it may read.

## Why two services

Separating them keeps model work and data rules in one place:

- Retrieval, chunking, and embeddings are Python.
- The database schema is owned by the service and migrated with Alembic.
- Screens can change without touching retrieval logic.
- The same API could serve a mobile client later.

## Data model in one table

| Table | Holds |
| --- | --- |
| `people` | Teachers, students, admins; unique email |
| `courses` | Course code, title, owning teacher |
| `enrollments` | Which student takes which course |
| `documents` | One uploaded PDF per course, with status and hash |
| `document_chunks` | Text, embedding, and keyword index per chunk |

Enrollment is a row, not a claim from the browser. That is what makes course scoping enforceable.

## Running it locally

```bash
docker compose --env-file .env.local up --build
```

The web app runs on port 3000 and the service on port 8000. Ollama runs on port 11434 when local models are enabled.

> Model choice, database, and provider are configuration, not code. Changing them does not change the screens.
