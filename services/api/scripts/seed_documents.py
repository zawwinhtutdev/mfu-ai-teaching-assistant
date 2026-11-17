"""Seed the demo course documents.

Idempotent: a document whose bytes are already in a course is left alone, and a
document that previously failed ingestion is retried rather than skipped.

    python scripts/seed_documents.py            # seed
    python scripts/seed_documents.py --check    # report without writing

The fixtures live in ``.local-demo/`` at the repository root. They are the same
PDFs a teacher would upload, so this runs the real ingestion path
(extract -> chunk -> embed) instead of inserting rows by hand: whatever the seed
produces is exactly what an upload produces.
"""

from __future__ import annotations

import argparse
import asyncio
import sys
from dataclasses import dataclass
from pathlib import Path

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import dispose_engine, get_session_factory
from app.models import Document
from app.rag.factory import get_embedder
from app.rag.ingest import content_hash, find_by_hash, ingest_pdf

# Repository root: services/api/scripts/ -> services/api -> services -> repo
REPO_ROOT = Path(__file__).resolve().parents[3]
FIXTURE_DIR = REPO_ROOT / ".local-demo"


@dataclass(frozen=True)
class Fixture:
    filename: str
    course_id: str
    uploaded_by: str


# Mirrors the academic seed in scripts/seed_academic.py: the teacher of each
# course owns its documents, so ``uploaded_by`` stays truthful.
FIXTURES: tuple[Fixture, ...] = (
    Fixture(
        filename="CSB321 Course Handbook.pdf",
        course_id="course-csb321",
        uploaded_by="anan.suwan@mfu.ac.th",
    ),
    Fixture(
        filename="CSD322 Week 5 - Platform Architecture.pdf",
        course_id="course-csd322",
        uploaded_by="malee.chaiyaporn@mfu.ac.th",
    ),
)


async def _seed_one(
    session: AsyncSession, fixture: Fixture, embedder: object
) -> tuple[str, Document | None]:
    """Return (outcome, document) where outcome is created/retried/present/skipped."""
    path = FIXTURE_DIR / fixture.filename
    if not path.exists():
        return "skipped", None

    data = path.read_bytes()
    digest = content_hash(data)

    existing = await find_by_hash(session, digest, fixture.course_id)
    if existing is not None and existing.status == "ready":
        return "present", existing

    if existing is None:
        existing = Document(
            filename=fixture.filename,
            content_type="application/pdf",
            size_bytes=len(data),
            sha256=digest,
            course_id=fixture.course_id,
            uploaded_by=fixture.uploaded_by,
            status="queued",
        )
        session.add(existing)
        await session.commit()
        await session.refresh(existing)
        outcome = "created"
    else:
        # A previous run failed (or was interrupted mid-ingest): retry it.
        existing.status = "queued"
        existing.error = None
        await session.commit()
        outcome = "retried"

    await ingest_pdf(
        session,
        document_id=existing.id,
        data=data,
        embedder=embedder,  # type: ignore[arg-type]
        target_chars=get_settings().chunk_chars,
        overlap_chars=get_settings().chunk_overlap,
    )
    await session.refresh(existing)
    return outcome, existing


async def seed(check_only: bool) -> int:
    settings = get_settings()
    if not FIXTURE_DIR.exists():
        print(f"fixture directory missing: {FIXTURE_DIR}", file=sys.stderr)
        print("expected the demo PDFs from .local-demo/ (see README)", file=sys.stderr)
        return 1

    factory = get_session_factory(settings)
    embedder = get_embedder(settings)

    failures = 0
    async with factory() as session:
        for fixture in FIXTURES:
            path = FIXTURE_DIR / fixture.filename
            if not path.exists():
                print(f"  skip     {fixture.filename} (not found in {FIXTURE_DIR})")
                continue

            if check_only:
                data = path.read_bytes()
                existing = await find_by_hash(session, content_hash(data), fixture.course_id)
                state = existing.status if existing else "missing"
                print(f"  {state:8} {fixture.course_id:16} {fixture.filename}")
                continue

            try:
                outcome, document = await _seed_one(session, fixture, embedder)
            except Exception as exc:  # keep seeding the rest
                failures += 1
                print(f"  FAILED   {fixture.course_id:16} {fixture.filename}: {exc}")
                continue

            if document is None:
                print(f"  skip     {fixture.filename} (not found)")
                continue
            if document.status != "ready":
                failures += 1
                print(
                    f"  FAILED   {fixture.course_id:16} {fixture.filename}: "
                    f"{document.status} — {document.error}"
                )
                continue
            print(
                f"  {outcome:8} {fixture.course_id:16} {fixture.filename} "
                f"({document.page_count}p, {document.chunk_count} chunks)"
            )

    await dispose_engine()
    return 1 if failures else 0


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="report the current state without writing anything",
    )
    args = parser.parse_args()
    raise SystemExit(asyncio.run(seed(check_only=args.check)))


if __name__ == "__main__":
    main()
