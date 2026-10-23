---
title: Manage course materials
description: Upload PDFs into the right course, follow processing, and keep the material students are answered from up to date.
---

Course materials are the source of truth for course-grounded answers. A student asking a question in CSB321 is answered from CSB321's documents only.

## Where to upload

Open **Teacher Portal → Documents RAG**. Upload controls appear only for teachers, and only for courses you teach.

| You see | Because |
| --- | --- |
| Only your courses in the selector | The course list comes from the database, filtered by ownership |
| An upload control | Your account role is `teacher` |
| An empty list for a new course | No material has been filed there yet |

## Upload a PDF

1. Select the course.
2. Choose **Choose a PDF**.
3. Select a PDF up to **25 MB**.
4. Wait for the status to reach **ready**.

Requirements for a good upload:

- The PDF has a real text layer (not a scan or photo).
- The file is not password protected.
- The filename describes the content, for example `CSB321-week-04-pricing.pdf`.

## What the platform does with the file

1. Stores the file and records its SHA-256 hash.
2. Extracts text page by page.
3. Splits text into overlapping chunks (about 1,200 characters with 200 characters of overlap).
4. Creates an embedding per chunk and a keyword index of the same text.
5. Marks the document **ready** when every chunk is stored.

Because retrieval uses both embeddings and keywords, exact terms such as course codes, error numbers, or Thai names are still found reliably.

## Status meaning

| Status | What it means | Action |
| --- | --- | --- |
| queued | Accepted, not started | Wait |
| processing | Extracting and indexing | Wait; do not re-upload |
| ready | Usable in chat | Ask questions |
| failed | Processing stopped | Read the message and upload a clean copy |

Re-uploading the identical file to the same course retries a failed document rather than duplicating it. The same file in another course is stored separately, so each course owns its copy.

## Keep material current

- Replace last semester's file instead of adding a second edition.
- Check the page count and chunk count after processing; a suspiciously low count usually means a scanned PDF.
- Remove a document once the course no longer uses it, so students are not answered from it.

## Test before students do

Ask the assistant three questions after uploading:

1. One factual question whose answer you know.
2. One question about a specific section or table.
3. One question the document does **not** answer.

The first two should answer with citations. The third should refuse with "The course materials do not cover this." If it invents an answer, the material is probably ambiguous or too broad.

> Uploading is a teacher action. Students can read and ask, but cannot add or remove material.
