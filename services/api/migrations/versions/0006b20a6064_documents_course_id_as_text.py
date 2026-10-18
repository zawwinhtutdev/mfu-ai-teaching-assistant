"""documents course_id as text

Revision ID: 0006b20a6064
Revises: c5a0580548a0
Create Date: 2026-10-20 00:45:22.491171
"""

from __future__ import annotations

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op


revision: str = '0006b20a6064'
down_revision: str | None = 'c5a0580548a0'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Course ids differ between demo data ("course-csb321") and Supabase (UUID),
    # and they live in another database, so store them as plain text.
    op.execute(
        "alter table documents alter column course_id type text using course_id::text"
    )


def downgrade() -> None:
    op.execute(
        "alter table documents alter column course_id type uuid using course_id::uuid"
    )


