"""Academic data: people, courses and enrollment enforcement.

The database is the single source of truth. Routes call `course_ids_for` or
`assert_course_access` instead of trusting a client-supplied course id.
"""

from __future__ import annotations

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentPrincipal
from app.db import get_session
from app.models import Course, Enrollment, Person

SessionDep = Annotated[AsyncSession, Depends(get_session)]


class CourseOut(BaseModel):
    id: str
    code: str
    title: str
    description: str | None = None
    semester: str
    teacher_id: str
    teacher_name: str | None = None
    enrolled_students: int = 0
    created_at: datetime


async def get_person(session: AsyncSession, principal: CurrentPrincipal) -> Person:
    """Resolve the caller to a database person. Unknown callers are refused."""
    email = (principal.email or principal.subject or "").lower()
    if not email:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Unknown caller")

    person = (
        await session.execute(select(Person).where(func.lower(Person.email) == email))
    ).scalar_one_or_none()

    if person is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No account found for this caller",
        )
    return person


async def course_ids_for(session: AsyncSession, person: Person) -> list[str] | None:
    """Course ids this person may touch. None means unrestricted (admin)."""
    if person.role == "admin":
        return None

    if person.role == "teacher":
        rows = await session.execute(select(Course.id).where(Course.teacher_id == person.id))
        return list(rows.scalars().all())

    rows = await session.execute(
        select(Enrollment.course_id).where(Enrollment.student_id == person.id)
    )
    return list(rows.scalars().all())


async def assert_course_access(session: AsyncSession, person: Person, course_id: str) -> None:
    """403 unless this person teaches or is enrolled in the course."""
    allowed = await course_ids_for(session, person)
    if allowed is None:
        return
    if course_id not in allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have access to this course",
        )


async def course_scope_for(session: AsyncSession, person: Person) -> list[str] | None:
    """The retrieval scope for a caller.

    ``None`` means unrestricted and is reserved for admins. Everything else is a
    concrete list, and an empty list is a real answer ("no courses"), not "all" —
    a caller with no enrollments must retrieve nothing rather than everything.
    """
    return await course_ids_for(session, person)


def require_course_manager(person: Person) -> None:
    """403 unless this person may add or remove course materials."""
    if person.role not in ("teacher", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only teachers can manage course materials",
        )


def course_is_readable(scope: list[str] | None, course_id: str | None) -> bool:
    """Whether a course id falls inside a caller's scope.

    A document with no course belongs to no scope, so only an unrestricted
    caller (admin) may see it — it can never be exposed by an omitted filter.
    """
    if scope is None:
        return True
    if course_id is None:
        return False
    return course_id in scope


router = APIRouter(tags=["academic"])


async def _courses_with_counts(session: AsyncSession, course_ids: list[str]) -> list[CourseOut]:
    if not course_ids:
        return []

    rows = await session.execute(
        select(
            Course,
            Person.full_name,
            func.count(Enrollment.student_id),
        )
        .join(Person, Person.id == Course.teacher_id)
        .outerjoin(Enrollment, Enrollment.course_id == Course.id)
        .where(Course.id.in_(course_ids))
        .group_by(Course.id, Person.full_name)
        .order_by(Course.code)
    )

    return [
        CourseOut(
            id=course.id,
            code=course.code,
            title=course.title,
            description=course.description,
            semester=course.semester,
            teacher_id=course.teacher_id,
            teacher_name=teacher_name,
            enrolled_students=count,
            created_at=course.created_at,
        )
        for course, teacher_name, count in rows.all()
    ]


@router.get("/me/courses", response_model=list[CourseOut], summary="Courses for the caller")
async def my_courses(
    principal: CurrentPrincipal,
    session: SessionDep,
) -> list[CourseOut]:
    person = await get_person(session, principal)
    allowed = await course_ids_for(session, person)

    if allowed is None:
        rows = await session.execute(select(Course.id))
        allowed = list(rows.scalars().all())

    return await _courses_with_counts(session, allowed)


@router.get("/courses/{course_id}", response_model=CourseOut, summary="One course")
async def get_course(
    course_id: str,
    principal: CurrentPrincipal,
    session: SessionDep,
) -> CourseOut:
    person = await get_person(session, principal)
    await assert_course_access(session, person, course_id)

    courses = await _courses_with_counts(session, [course_id])
    if not courses:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Course not found")
    return courses[0]


@router.get("/stats", summary="Platform statistics (admin)")
async def platform_stats(
    principal: CurrentPrincipal,
    session: SessionDep,
) -> dict[str, object]:
    person = await get_person(session, principal)
    if person.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin only")

    by_role = dict(
        (await session.execute(select(Person.role, func.count()).group_by(Person.role))).all()
    )
    courses = (await session.execute(select(func.count()).select_from(Course))).scalar_one()
    enrollments = (await session.execute(select(func.count()).select_from(Enrollment))).scalar_one()

    from app.models import Document, DocumentChunk

    documents = (await session.execute(select(func.count()).select_from(Document))).scalar_one()
    chunks = (await session.execute(select(func.count()).select_from(DocumentChunk))).scalar_one()
    ready = (
        await session.execute(
            select(func.count()).select_from(Document).where(Document.status == "ready")
        )
    ).scalar_one()
    failed = (
        await session.execute(
            select(func.count()).select_from(Document).where(Document.status == "failed")
        )
    ).scalar_one()

    return {
        "totalUsers": sum(by_role.values()),
        "roleCounts": {
            "student": by_role.get("student", 0),
            "teacher": by_role.get("teacher", 0),
            "admin": by_role.get("admin", 0),
        },
        "totalCourses": courses,
        "totalEnrollments": enrollments,
        "totalDocuments": documents,
        "totalChunks": chunks,
        "documentsReady": ready,
        "documentsFailed": failed,
        # Not modelled yet: report zero rather than inventing numbers.
        "totalConversations": 0,
        "totalAuditLogs": 0,
        "notifications": {
            "queued": 0,
            "processing": 0,
            "sent": 0,
            "failed": 0,
            "canceled": 0,
        },
        "consents": {"total": 0, "granted": 0, "revoked": 0},
    }
