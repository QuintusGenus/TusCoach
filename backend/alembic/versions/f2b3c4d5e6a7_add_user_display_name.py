"""Add display_name to users table

Revision ID: f2b3c4d5e6a7
Revises: e1a2b3c4d5f6
Create Date: 2026-02-17

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "f2b3c4d5e6a7"
down_revision: Union[str, None] = "e1a2b3c4d5f6"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("users", sa.Column("display_name", sa.String(100), nullable=True))


def downgrade() -> None:
    op.drop_column("users", "display_name")
