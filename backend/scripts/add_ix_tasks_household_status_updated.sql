-- Liste filtrée par foyer + statut + tri updated_at (GET /tasks, agrégats).
-- Préféré : depuis backend/ → `alembic upgrade head` (voir alembic/versions/).
-- Sinon : exécuter ce fichier une fois sur une base déjà créée.

CREATE INDEX IF NOT EXISTS ix_tasks_household_status_updated
  ON tasks (household_id, status, updated_at);
