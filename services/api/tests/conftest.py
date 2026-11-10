"""Shared test doubles.

The chat and search routes resolve the caller's identity and course scope from
the database before doing any work, so the hermetic (no-Postgres) tests need a
session that answers exactly those two lookups. Anything else is a test bug and
raises rather than silently returning nothing.
"""

from __future__ import annotations

from app.models import Person


class _Rows:
    def __init__(self, rows: list[object]) -> None:
        self._rows = rows

    def scalars(self) -> _Rows:
        return self

    def all(self) -> list[object]:
        return self._rows

    def scalar_one_or_none(self) -> object | None:
        return self._rows[0] if self._rows else None


class FakeSession:
    """Answers ``get_person`` and ``course_ids_for`` only.

    ``known`` mirrors "this token belongs to someone with a platform account";
    ``role`` decides whether the scope is teaching or enrollment, and
    ``courses`` is the resulting scope.
    """

    def __init__(
        self,
        *,
        email: str = "s@mfu.ac.th",
        role: str = "student",
        courses: tuple[str, ...] = (),
        known: bool = True,
    ) -> None:
        self.email = email
        self.known = known
        self.person = Person(
            id=f"p-{email.lower()}", email=email.lower(), full_name="Test", role=role
        )
        self.courses = courses

    async def execute(self, statement: object, *args: object, **kwargs: object) -> _Rows:
        sql = str(statement)
        if "FROM people" in sql:
            return _Rows([self.person] if self.known else [])
        if "FROM enrollments" in sql or "FROM courses" in sql:
            return _Rows(list(self.courses))
        raise AssertionError(f"Unexpected query in a hermetic test: {sql}")
