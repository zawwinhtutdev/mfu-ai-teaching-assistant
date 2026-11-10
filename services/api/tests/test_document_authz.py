"""Authorization on documents and retrieval.

These are the regressions found by probing the running service: a student could
delete another course's document, upload into a course they were not enrolled
in, and read every course's chunks by omitting ``course_id``. Each test pins one
of those closed.
"""

from __future__ import annotations

import uuid

import pytest

from app.academic import course_is_readable, require_course_manager
from app.models import Person


def _person(role: str = "teacher") -> Person:
    return Person(id=f"p-{uuid.uuid4().hex[:6]}", email="x@mfu.ac.th", full_name="X", role=role)


def test_course_is_readable_is_scoped_for_students() -> None:
    scope = ["course-csd322"]
    assert course_is_readable(scope, "course-csd322") is True
    assert course_is_readable(scope, "course-csb321") is False


def test_document_without_a_course_is_not_readable_by_scoped_callers() -> None:
    """An unscoped document must never be reachable by omitting a filter."""
    assert course_is_readable(["course-csd322"], None) is False


def test_document_without_a_course_is_readable_by_admins() -> None:
    # ``None`` is the admin-only unrestricted scope.
    assert course_is_readable(None, None) is True
    assert course_is_readable(None, "course-csb321") is True


def test_empty_scope_reads_nothing() -> None:
    assert course_is_readable([], "course-csd322") is False
    assert course_is_readable([], None) is False


def test_students_cannot_manage_materials() -> None:
    from fastapi import HTTPException

    with pytest.raises(HTTPException) as denied:
        require_course_manager(_person("student"))
    assert denied.value.status_code == 403


def test_teachers_and_admins_can_manage_materials() -> None:
    require_course_manager(_person("teacher"))
    require_course_manager(_person("admin"))
