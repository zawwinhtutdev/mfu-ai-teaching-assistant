---
title: Document RAG workspace
description: Pick a course, upload a PDF as a teacher, and ask questions answered only from that course's material.
---

Document RAG retrieves passages from your course material before the assistant writes an answer. Every answer is grounded in that course and cites the page it came from.

Teachers upload the material. Students read and ask questions about material for courses they are enrolled in.

## What each role can do

| Role | Upload PDFs | Ask questions | Courses shown |
| --- | --- | --- | --- |
| Teacher | Yes, for courses they teach | Yes | Courses they own |
| Student | No | Yes | Courses they are enrolled in |
| Admin | No | — | All courses (for support) |

The course list comes from the platform database, not from the page. You cannot widen it by editing a URL.

## Open the workspace

- Teachers: **Teacher Portal → Documents RAG**
- Students: **Student Portal → Documents RAG**

## Choose the course first

Use the **Course** selector above the upload area. Everything on the page follows that choice: the document list, the chat, and the citations.

Switching course clears the conversation, because answers from one course must not be mixed with another.

> If a course is not in the list, you are not enrolled in it (student) or you do not teach it (teacher). Ask the course owner or an administrator to check the enrollment.

## Upload material (teachers)

1. Select the course.
2. Choose **Choose a PDF**.
3. Pick one PDF up to **25 MB**.
4. Watch the status change from **queued** to **processing** to **ready**.

What happens after the upload:

1. The PDF is stored and hashed.
2. Text is extracted page by page; scanned PDFs without a text layer are rejected.
3. The text is split into overlapping chunks.
4. Each chunk is embedded and indexed for both vector and keyword search.
5. The document becomes selectable when indexing finishes.

The same file uploaded to a different course becomes a separate document, so each course keeps its own copy.

## Understand document status

| Status | Meaning | What to do |
| --- | --- | --- |
| queued | Accepted and waiting to be processed | Wait a few seconds |
| processing | Text extraction and indexing in progress | Wait; the page refreshes itself |
| ready | Searchable and usable in chat | Ask a question |
| failed | Processing stopped with an error | Read the message, then upload a clean copy |

Common `failed` causes are an encrypted PDF, a scanned image without text, or a file above the size limit. A re-upload of the same file in the same course retries the failed document instead of creating a duplicate.

## Ask a grounded question

1. Select the course.
2. Confirm the document is **ready**.
3. Ask one focused question.

```text
List the assessment components and their percentages.
If a value is not stated in this course's material, say "not covered".
```

## Read the answer

Answers carry numbered citations that map to the sources listed under the reply:

```text
The midterm is on Saturday, 19 September 2026 [1].

[1] Midterm Brief Memo.pdf, p. 1
[2] Course handbook.pdf, pp. 15–16, § 12.3
```

A citation means "this passage supports the sentence", not "this page was read". Open the source to confirm anything important.

## When the material does not cover it

The assistant refuses instead of guessing:

```text
The course materials do not cover this.
```

That refusal is a feature. It means retrieval found nothing relevant in this course, so there was nothing honest to cite. Rephrase the question, or upload the document that covers it.

## Search and clean up

Use the document list to check what the course contains. Remove outdated files so students are not answered from an old edition.

## Get better answers

- Ask about one topic per message.
- Name the section, date, or table you expect the answer to use.
- Prefer "according to this course's material" phrasing.
- Treat the PDF as authoritative and the answer as a guide.

> RAG improves source alignment; it cannot make a wrong source right. If the PDF is outdated, the answer will be outdated too.
