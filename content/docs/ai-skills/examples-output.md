---
title: Examples and output formats
description: Show the pattern you want and define the response structure so the result is easier to review and reuse.
---

Examples are useful when a verbal instruction is ambiguous. Output formats are useful when the response must be compared, checked, or transferred into another workflow.

## Use zero-shot instructions first

Start with a direct request when the task is simple.

```text
Turn these learning objectives into five short-answer revision questions. Put the answer key after all questions.
```

## Add examples when consistency matters

Provide one or two short examples that demonstrate the pattern. Do not paste a large collection when a small example is enough.

```text
Convert each topic into a flashcard.

Example
Topic: Photosynthesis converts light energy into chemical energy.
Question: What energy conversion occurs during photosynthesis?
Answer: Light energy is converted into chemical energy.

Now create cards for the topics below.
```

Examples should represent the quality you want. The assistant may repeat weaknesses or bias in a poor example.

## Specify an output format

| Format | Good for |
| --- | --- |
| Numbered steps | Procedures and revision plans. |
| Two-column table | Comparisons, terminology, and feedback. |
| Checklist | Work that must be verified or completed. |
| JSON | Data passed to software; define exact field names. |
| Short sections | Explanations with predictable headings. |

```text
Return exactly four sections: Summary, Key terms, Common mistake, and Self-check question. Keep each section under 80 words.
```

## Request an answer rubric

For practice work, ask the assistant to separate the question, success criteria, and answer guidance.

```text
Create one application question about network security. Then provide a 4-point rubric. Do not show the sample answer until I reply.
```

## Check structured output

Even well-formatted output can contain incorrect content. Check source alignment, calculations, dates, and citations before reusing it. For machine-readable output, also confirm that required fields are present and valid.
