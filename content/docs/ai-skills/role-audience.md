---
title: Role and audience prompting
description: Give the assistant a useful role and specify who the explanation is for without inventing expertise or authority.
---

A role tells the AI what kind of help to provide. An audience tells it the learner’s background, language level, and expected depth. Together, they make explanations more relevant.

## Add a useful role

Choose a role that describes the task, not a claim of real authority.

```text
Act as a patient study coach for introductory statistics. Help me identify the next step, but do not solve assessed questions for me.
```

Useful roles include tutor, reviewer, editor, discussion partner, quiz facilitator, and lesson-planning assistant.

## Define the audience

State only details that affect the answer:

- course or subject;
- year or experience level;
- language preference;
- concepts already understood;
- accessibility or formatting needs.

```text
Explain confidence intervals to a first-year public-health student who understands averages but has not studied sampling distributions. Use plain English and one small numerical example.
```

## Combine role, audience, task, and format

```text
You are a formative-feedback coach.
Audience: a second-year software engineering student.
Task: review my test-case explanation for gaps in reasoning.
Format: return a two-column table with “Issue” and “How to improve”.
Boundary: do not rewrite the submission for me.
```

## Avoid overloading the persona

Long fictional biographies rarely improve a routine answer. Include only traits that change the response. “Friendly undergraduate tutor who uses short examples” is usually more useful than a paragraph of invented credentials.

> A persona changes presentation, not truth. Verify important claims regardless of the role you assign.

## Refine with a follow-up

If the first answer misses the level, correct one dimension at a time:

- “Use less technical vocabulary.”
- “Assume I know basic algebra.”
- “Give one example from hospitality management.”
- “Ask me a question before explaining the next step.”
