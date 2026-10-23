"""Enrollment enforcement against a real database.

Each test owns its engine so it can use its own event loop; rows are removed
afterwards. Skipped when Postgres is not reachable.
"""

from __future__ import annotations

import asyncio
import os
import uuid
from collections.abc import Awaitable, Callable

import pytest
from fastapi import HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.academic import assert_course_access, course_ids_for, get_person
from app.auth import Principal
from app.models import Course, Enrollment, Person

DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+asyncpg://ata:ata-local-dev@127.0.0.1:5432/ata",
)


async def _with_session(scenario: Callable[[AsyncSession], Awaitable[None]]) -> None:
    engine = create_async_engine(DATABASE_URL, poolclass=NullPool)
    factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with factory() as session:
            await scenario(session)
    finally:
        await engine.dispose()


def _db_reachable() -> bool:
    async def _ping() -> None:
        await _with_session(lambda session: _check(session))

    async def _check(session: AsyncSession) -> None:
        await session.execute(text("select 1"))

    try:
        asyncio.run(_ping())
        return True
    except Exception:
        return False


pytestmark = pytest.mark.skipif(not _db_reachable(), reason="database not reachable")


def test_teacher_reaches_own_course_and_is_refused_another() -> None:
    async def scenario(session: AsyncSession) -> None:
        suffix = uuid.uuid4().hex[:6]
        teacher_id, other_teacher = f"t-{suffix}", f"t2-{suffix}"
        own_course, foreign_course = f"c-own-{suffix}", f"c-for-{suffix}"
        email = f"teacher-{suffix}@test.local"

        session.add_all(
            [
                Person(id=teacher_id, email=email, full_name="T", role="teacher"),
                Person(
                    id=other_teacher,
                    email=f"other-{suffix}@test.local",
                    full_name="O",
                    role="teacher",
                ),
            ]
        )
        await session.flush()
        session.add_all(
            [
                Course(id=own_course, code=f"OWN{suffix}", title="Own", teacher_id=teacher_id),
                Course(
                    id=foreign_course,
                    code=f"FOR{suffix}",
                    title="Foreign",
                    teacher_id=other_teacher,
                ),
            ]
        )
        await session.commit()

        try:
            principal = Principal(subject=email, email=email, role="teacher")
            person = await get_person(session, principal)
            assert await course_ids_for(session, person) == [own_course]

            await assert_course_access(session, person, own_course)

            with pytest.raises(HTTPException) as denied:
                await assert_course_access(session, person, foreign_course)
            assert denied.value.status_code == 403
        finally:
            await session.execute(
                text("delete from courses where id in (:a, :b)"),
                {"a": own_course, "b": foreign_course},
            )
            await session.execute(
                text("delete from people where id in (:a, :b)"),
                {"a": teacher_id, "b": other_teacher},
            )
            await session.commit()

    asyncio.run(_with_session(scenario))


def test_student_only_sees_enrolled_courses() -> None:
    async def scenario(session: AsyncSession) -> None:
        suffix = uuid.uuid4().hex[:6]
        teacher_id, student_id = f"t-{suffix}", f"s-{suffix}"
        course_id, other_course = f"c-{suffix}", f"c-oth-{suffix}"
        email = f"student-{suffix}@test.local"

        session.add_all(
            [
                Person(
                    id=teacher_id,
                    email=f"teacher-{suffix}@test.local",
                    full_name="T",
                    role="teacher",
                ),
                Person(id=student_id, email=email, full_name="S", role="student"),
            ]
        )
        await session.flush()
        session.add_all(
            [
                Course(id=course_id, code=f"C{suffix}", title="C", teacher_id=teacher_id),
                Course(id=other_course, code=f"O{suffix}", title="O", teacher_id=teacher_id),
            ]
        )
        await session.flush()
        session.add(Enrollment(student_id=student_id, course_id=course_id))
        await session.commit()

        try:
            principal = Principal(subject=email, email=email, role="student")
            person = await get_person(session, principal)
            assert await course_ids_for(session, person) == [course_id]

            with pytest.raises(HTTPException) as denied:
                await assert_course_access(session, person, other_course)
            assert denied.value.status_code == 403
        finally:
            await session.execute(
                text("delete from enrollments where student_id = :s"), {"s": student_id}
            )
            await session.execute(
                text("delete from courses where id in (:a, :b)"),
                {"a": course_id, "b": other_course},
            )
            await session.execute(
                text("delete from people where id in (:a, :b)"),
                {"a": teacher_id, "b": student_id},
            )
            await session.commit()

    asyncio.run(_with_session(scenario))


def test_unknown_caller_is_refused() -> None:
    async def scenario(session: AsyncSession) -> None:
        principal = Principal(subject="ghost@test.local", email="ghost@test.local")
        with pytest.raises(HTTPException) as denied:
            await get_person(session, principal)
        assert denied.value.status_code == 403

    asyncio.run(_with_session(scenario))
