---
title: Document RAG workspace
description: Upload supported files, wait for indexing, select a ready document, and ask grounded questions.
---

Document RAG retrieves relevant passages from a selected file before the AI writes its answer. Use it when the answer should come from a particular lecture, policy, report, or set of notes.

![Documents RAG workspace](/docs/document-rag.png)

## Open the workspace

Open **Documents RAG** from the student or teacher portal, or go to the documents area from AI Chat. The left panel contains your files; the right panel becomes a document-focused chat after you select a ready file.

## Upload a document

1. Choose the upload action.
2. Select one or more supported files.
3. Keep each file at or below **4 MB**.
4. Wait for the upload and indexing status to finish.

Supported uploads include PDF, Word, PowerPoint, Excel, OpenDocument, TXT, Markdown, CSV, JSON, HTML, and XML.

Use descriptive filenames such as `BIO1202-week-04-cell-division.pdf`. A clear name makes the correct source easier to find later.

## Understand document status

| Status | Meaning | What to do |
| --- | --- | --- |
| Pending | The file was accepted and is waiting to be indexed. | Wait, then refresh the list. |
| Ready | The document can be selected for RAG chat. | Open it and ask a focused question. |
| Failed or unavailable | Indexing did not complete successfully. | Use **Reindex** or upload a clean copy. |

The page periodically checks pending documents. Do not upload repeated copies while the first file is still processing.

## Ask a grounded question

Select a ready document, then ask for a specific fact, section, comparison, or study activity.

```text
Using only this document, list the assessment components and their percentages. If a value is not stated, say “not found in the selected document.”
```

The document banner confirms that RAG mode is active. If you open a general chat instead, the selected document may no longer be part of the request.

## Search and manage files

Use document search to filter by filename. You can open a source file, remove a file you no longer need, or request reindexing when its search index is not ready.

Deleting a document removes it from your document workspace. Confirm that it is no longer needed before using this action.

## Get a better answer

- Name the section, term, date, or table you expect the answer to use.
- Ask for short quotations only when necessary, and compare them with the original file.
- Break broad requests into one topic at a time.
- Tell the assistant to identify information that is missing rather than guessing.

> RAG improves source alignment; it does not guarantee that every statement is correct. The selected document remains the authoritative source.
