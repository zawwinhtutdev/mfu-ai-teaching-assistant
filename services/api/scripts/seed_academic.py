"""Seed the academic tables with the demo university.

Idempotent: re-running updates names/roles and re-creates courses/enrollments.

    python scripts/seed_academic.py
"""

from __future__ import annotations

import asyncio

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import get_settings

TEACHERS = [
    ("teacher-1", "anan.suwan@mfu.ac.th", "Dr. Anan Suwan", "School of Information Technology"),
    (
        "teacher-2",
        "malee.chaiyaporn@mfu.ac.th",
        "Dr. Malee Chaiyaporn",
        "School of Information Technology",
    ),
    ("teacher-3", "somchai.prasert@mfu.ac.th", "Ajarn Somchai Prasert", "School of Management"),
]

STUDENTS = [
    ("student-1", "kanya.wong@mfu.ac.th", "Kanya Wong", 3),
    ("student-2", "niran.chai@mfu.ac.th", "Niran Chai", 3),
    ("student-3", "pim.srisuk@mfu.ac.th", "Pim Srisuk", 2),
    ("student-4", "thanakorn.roj@mfu.ac.th", "Thanakorn Roj", 4),
    ("student-5", "araya.kitt@mfu.ac.th", "Araya Kitt", 2),
    ("student-6", "krit.phan@mfu.ac.th", "Krit Phan", 4),
]

COURSES = [
    ("course-csb321", "CSB321", "Software Business Entrepreneurship", "teacher-1"),
    ("course-csd323", "CSD323", "Seminar in Software Engineering", "teacher-1"),
    ("course-csd322", "CSD322", "Platform Development", "teacher-2"),
    ("course-csa411", "CSA411", "Software Automation Testing with AI", "teacher-2"),
    ("course-csm324", "CSM324", "Introduction to Formal English", "teacher-3"),
    ("course-gen311", "GEN311", "Global Citizenship", "teacher-3"),
    ("course-ai-edu", "AI-EDU", "AI for Edu week (staffs)", "teacher-3"),
]

ENROLLMENTS = {
    "student-1": ["course-csb321", "course-csd322", "course-csm324"],
    "student-2": ["course-csb321", "course-csd322"],
    "student-3": ["course-csd323", "course-gen311"],
    "student-4": ["course-csd323", "course-csm324", "course-ai-edu"],
    "student-5": ["course-csd322", "course-csm324"],
    "student-6": ["course-csb321", "course-gen311"],
}


async def seed() -> None:
    settings = get_settings()
    engine = create_async_engine(settings.database_url)

    async with engine.begin() as connection:
        for person_id, email, full_name, department in TEACHERS:
            await connection.execute(
                text(
                    """
                    insert into people (id, email, full_name, role, department)
                    values (:id, :email, :full_name, 'teacher', :department)
                    on conflict (id) do update
                       set email = excluded.email,
                           full_name = excluded.full_name,
                           department = excluded.department
                    """
                ),
                {
                    "id": person_id,
                    "email": email,
                    "full_name": full_name,
                    "department": department,
                },
            )

        for person_id, email, full_name, year in STUDENTS:
            await connection.execute(
                text(
                    """
                    insert into people (id, email, full_name, role, year)
                    values (:id, :email, :full_name, 'student', :year)
                    on conflict (id) do update
                       set email = excluded.email,
                           full_name = excluded.full_name,
                           year = excluded.year
                    """
                ),
                {"id": person_id, "email": email, "full_name": full_name, "year": year},
            )

        await connection.execute(
            text(
                """
                insert into people (id, email, full_name, role)
                values ('admin-1', 'admin@mfu.ac.th', 'MFU Admin', 'admin')
                on conflict (id) do update set email = excluded.email
                """
            )
        )

        for course_id, code, title, teacher_id in COURSES:
            await connection.execute(
                text(
                    """
                    insert into courses (id, code, title, semester, teacher_id)
                    values (:id, :code, :title, 'fall-2025', :teacher_id)
                    on conflict (id) do update
                       set code = excluded.code,
                           title = excluded.title,
                           teacher_id = excluded.teacher_id
                    """
                ),
                {"id": course_id, "code": code, "title": title, "teacher_id": teacher_id},
            )

        await connection.execute(text("delete from enrollments"))
        for student_id, course_ids in ENROLLMENTS.items():
            for course_id in course_ids:
                await connection.execute(
                    text(
                        """
                        insert into enrollments (student_id, course_id)
                        values (:student_id, :course_id)
                        on conflict do nothing
                        """
                    ),
                    {"student_id": student_id, "course_id": course_id},
                )

        counts = (
            await connection.execute(
                text(
                    """
                    select (select count(*) from people) as people,
                           (select count(*) from courses) as courses,
                           (select count(*) from enrollments) as enrollments
                    """
                )
            )
        ).one()
        print(f"seeded: {counts.people} people, {counts.courses} courses, "
              f"{counts.enrollments} enrollments")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
