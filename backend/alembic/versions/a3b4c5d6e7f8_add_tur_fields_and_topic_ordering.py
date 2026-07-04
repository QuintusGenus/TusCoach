"""Add tur fields and topic ordering

Revision ID: a3b4c5d6e7f8
Revises: f2b3c4d5e6a7
Create Date: 2026-02-17

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "a3b4c5d6e7f8"
down_revision: Union[str, None] = "f2b3c4d5e6a7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("study_plans", sa.Column("tur_number", sa.Integer(), nullable=True))
    op.add_column("plan_tasks", sa.Column("phase", sa.String(20), nullable=True))
    op.add_column("plan_tasks", sa.Column("subject_block_order", sa.Integer(), nullable=True))
    op.add_column("topics", sa.Column("sort_order", sa.Integer(), server_default="0", nullable=False))


def downgrade() -> None:
    op.drop_column("topics", "sort_order")
    op.drop_column("plan_tasks", "subject_block_order")
    op.drop_column("plan_tasks", "phase")
    op.drop_column("study_plans", "tur_number")
