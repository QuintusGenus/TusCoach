"""Add study features: subject columns, notes table, exam columns

Revision ID: e1a2b3c4d5f6
Revises: 3ae893026a14
Create Date: 2026-02-16

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "e1a2b3c4d5f6"
down_revision: Union[str, None] = "3ae893026a14"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Add 'subject' column to study_sessions
    op.add_column("study_sessions", sa.Column("subject", sa.String(100), nullable=True))

    # 2. Add 'exam_name' and 'notes' to mock_exams
    op.add_column("mock_exams", sa.Column("exam_name", sa.String(200), nullable=True))
    op.add_column("mock_exams", sa.Column("notes", sa.Text(), nullable=True))

    # 3. Add 'subject' to mock_exam_breakdowns, make topic_id nullable
    op.add_column("mock_exam_breakdowns", sa.Column("subject", sa.String(100), nullable=True))
    op.alter_column("mock_exam_breakdowns", "topic_id", existing_type=sa.Integer(), nullable=True)

    # 4. Create 'notes' table
    op.create_table(
        "notes",
        sa.Column("id", sa.Integer(), primary_key=True, index=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, index=True),
        sa.Column("subject", sa.String(100), nullable=True),
        sa.Column("title", sa.String(300), nullable=False),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("notes")
    op.drop_column("mock_exam_breakdowns", "subject")
    op.drop_column("mock_exams", "notes")
    op.drop_column("mock_exams", "exam_name")
    op.drop_column("study_sessions", "subject")
