"""add difficulty_label to questions

Revision ID: f3a7c2e1d9b0
Revises: 91830330e3d7
Create Date: 2026-08-20

"""
from typing import Union
from alembic import op
import sqlalchemy as sa

revision: str = 'f3a7c2e1d9b0'
down_revision: Union[str, None] = '91830330e3d7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'questions',
        sa.Column('difficulty_label', sa.String(length=10), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('questions', 'difficulty_label')
