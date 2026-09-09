---
title: Build a course assistant
description: Configure focused instructions and test an AI assistant before students use it.
---

Open [Agent Builder](/teacherportal/agentbuilder) from the teacher portal. The builder stores a separate configuration for each course and organizes it into **General Settings**, **Behavior & Tone**, and **Course Rules**.

![Teacher Agent Builder](/docs/agent-builder.png)

## Configuration workflow

1. Select the course by code and title.
2. Under **General Settings**, choose the model and review the system prompt.
3. Under **Behavior & Tone**, choose the communication tone.
4. Under **Course Rules**, add the approved grading policy and course boundaries.
5. Select **Save Settings**.
6. Test the assistant from the course workspace.

## Define the assistant’s purpose

State the course, audience, and tasks it should support.

```text
You are a teaching assistant for Introduction to Data Science. Help first-year students understand course concepts using the uploaded materials. Use short explanations and ask a checking question after difficult topics.
```

## Add response rules

Useful rules include:

- Prefer the uploaded course material when it contains the answer.
- Say when the available material does not support a claim.
- Do not invent grades, deadlines, policies, or citations.
- Guide students through reasoning instead of completing restricted assessments.
- Use language appropriate for the course level.

## Test before sharing

Test ordinary questions, ambiguous questions, questions outside the course scope, and requests that should be declined. Check that the assistant admits uncertainty and points students to the correct official source.

## Improve the configuration

When an answer is consistently weak, determine whether the instructions are unclear or the necessary source material is missing. Change one part at a time and repeat the same test questions.

## Detailed setup guides

- [Model and system prompt](/docs/teachers/assistant-model-prompt)
- [Tone, grading, and rules](/docs/teachers/assistant-tone-rules)
- [Test the assistant](/docs/teachers/test-assistant)
