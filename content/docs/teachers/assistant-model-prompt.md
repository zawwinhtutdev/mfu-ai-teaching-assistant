---
title: Model and system prompt
description: Select the course, choose an enabled Gemini model, and write the main instruction for the course assistant.
---

Open [Agent Builder](/teacherportal/agentbuilder). Settings are stored per course, so begin by choosing the course you intend to configure.

![General settings in Agent Builder](/docs/agent-builder.png)

## Select the course

Use **Select Course** and verify both course code and title. When you change the selection, the page loads that course’s saved chatbot settings.

Wait for loading to finish before editing. Saving while another course is selected updates that course, not a global assistant.

## Choose an AI model

The current interface offers:

| Model | Intended use |
| --- | --- |
| Gemini 3 Flash | Fast, efficient support for most routine course questions. |
| Gemini 3 Pro | More advanced tasks when additional reasoning quality is worth the extra latency or cost. |

Availability is controlled by the platform. Re-test important workflows after changing the model because output style and detail can differ.

## Write the system prompt

The **System Prompt** is the assistant’s main behavioral instruction. Leaving it empty uses the platform default. A custom prompt should define:

1. **Role** — the course and kind of teaching support.
2. **Audience** — learner level and expected background.
3. **Sources** — which course materials or FAQs to prefer.
4. **Method** — how to explain, question, or scaffold learning.
5. **Boundaries** — what not to invent or complete.
6. **Uncertainty** — what to say when evidence is missing.

```text
You are the AI teaching assistant for CSD322 Software Testing.
Support second-year students using the course materials and approved FAQs.
Explain one step at a time, use short examples, and ask a checking question after complex topics.
Do not invent deadlines, grades, citations, or course policy.
Do not complete restricted assessments. Offer hints and feedback on the student’s own attempt.
When the available course sources do not support an answer, say so and direct the student to the instructor.
```

## Save the general settings

Select **Save Settings** and wait for the success message. Then open course AI Chat and run the same small test set you used before the change.

## Common prompt problems

| Symptom | Likely cause | Improvement |
| --- | --- | --- |
| Answers are too broad | Purpose or audience is missing. | Name the course, learner level, and task. |
| Policy answers are invented | Source and uncertainty rules are weak. | Require source-backed answers and an explicit “not found” response. |
| The assistant gives assignment solutions | Boundaries are missing. | Require hints, questions, and feedback on attempts. |
| Replies are inconsistent | Instructions conflict or are too long. | Remove duplication and rank the most important rules. |
