"""Index liste tâches par foyer + statut + updated_at.

Révision initiale Alembic : aligne les bases créées avant l’index dans le modèle SQLAlchemy.

Revision ID: 20260203_01
Revises:
Create Date: 2026-02-03
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260203_01"
down_revision = None
branch_labels = None
depends_on = None

INDEX_NAME = "ix_tasks_household_status_updated"
TABLE_NAME = "tasks"


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if not insp.has_table(TABLE_NAME):
        return
    existing = {ix["name"] for ix in insp.get_indexes(TABLE_NAME)}
    if INDEX_NAME not in existing:
        op.create_index(
            INDEX_NAME,
            TABLE_NAME,
            ["household_id", "status", "updated_at"],
            unique=False,
        )


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if not insp.has_table(TABLE_NAME):
        return
    existing = {ix["name"] for ix in insp.get_indexes(TABLE_NAME)}
    if INDEX_NAME in existing:
        op.drop_index(INDEX_NAME, table_name=TABLE_NAME)
