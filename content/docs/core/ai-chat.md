---
title: AI chat and conversations
description: Start a conversation, see which model answers, attach context, revisit earlier chats, and rate an answer.
---

Open [AI Chat](/chat) when you want general assistance or need to work with a document outside a course workspace. Course-specific chat is also available from each enrolled course.

## Start a new conversation

1. Open **AI Chat** from the platform navigation.
2. Select the model shown beside the message box if you need a different option.
3. Type one focused request.
4. Review the message and send it.

The first message creates a conversation. The address changes to include the conversation ID so the same thread can be opened again.

## Choose a model

The platform runs **local models by default** (`qwen2.5:7b` for chat, `nomic-embed-text` for embeddings), so conversations stay on the machine. If the deployment is configured with a cloud provider, the enabled cloud model appears instead.

For most course questions, the default local model is enough. Deeper reasoning is usually won by better retrieval — the right passages, from the right course — than by a larger model.

> Model names and availability are configuration, not product features. See [Local AI models](/docs/core/local-ai-models) for how the default is chosen.

## Attach supporting files

Use the attachment control when the file is necessary to answer the question. After attaching it, state what the assistant should do with it.

```text
Read the attached table. Identify the three largest changes, explain what may have caused them, and list any assumptions.
```

Do not upload passwords, identity documents, confidential student records, or material you are not authorized to share.

## Continue or revisit a chat

Saved conversations appear in the chat sidebar. Open one to continue with its earlier messages, or start a new conversation when you change course, document, or goal. Keeping unrelated tasks in separate conversations makes later review easier.

## Use document RAG mode

The documents workspace can open chat with **Document RAG mode** enabled for one indexed document. A banner above the composer identifies the selected document. See [Document RAG workspace](/docs/core/document-rag) for the full workflow.

## Rate an answer

Use the thumbs-up or thumbs-down control below an assistant response. Feedback is attached to that response and helps the team identify useful answers and recurring problems.

Before rating an answer, check whether the problem came from the response or from missing context in the question. Add a clearer follow-up when the assistant needs another course name, source, or output format.

## If a conversation does not load

- Confirm that you are signed in with the same account that created it.
- Return to **New chat** and then reopen the conversation from the sidebar.
- Refresh the page once.
- If the error remains, record the conversation address and follow [Troubleshooting](/docs/support/troubleshooting).
