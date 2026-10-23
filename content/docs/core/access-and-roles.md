---
title: Roles and access
description: What students, teachers, and admins can do, and how the server enforces course access.
---

Access is decided by the database, not by the screen. The interface hides what you cannot use, and the service refuses it even if you ask directly.

## Roles

| Role | Sees | Can upload | Can ask |
| --- | --- | --- | --- |
| Student | Courses they are enrolled in | No | Yes, within those courses |
| Teacher | Courses they teach | Yes, for those courses | Yes |
| Admin | All courses | No | For support and review |

## How access is checked

Every request that names a course goes through the same check:

1. The caller's identity is resolved to a person row by email.
2. The person's role and course list are read from the database.
3. A teacher must own the course; a student must be enrolled; an admin is unrestricted.
4. Anything else is refused with **403**.

```text
GET /v1/documents?course_id=course-csb321   as a student not enrolled
→ 403 {"detail": "You do not have access to this course"}
```

The same rule applies to chat: asking a question scoped to another course is refused before retrieval runs.

## What this prevents

- Editing a URL or request body to read another course's files.
- A student uploading material into a course.
- A teacher uploading into a course they do not teach.
- An unknown account reading anything at all.

Filtering the list in the browser would look the same in the UI but would protect nothing. The check has to happen where the data lives.

## When access looks wrong

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Course missing from the selector | No enrollment row / not the owning teacher | Add the enrollment or reassign the course |
| Upload control missing | Account role is not `teacher` | Sign in with a teacher account |
| 403 on a course you expect | Enrollment exists for a different account | Confirm the signed-in email |
| Everything empty after sign-in | Session belongs to an old or unknown account | Sign out and sign in again |

> If a page looks empty, check the account before assuming the data is missing.
