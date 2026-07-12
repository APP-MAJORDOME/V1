-- Lien compte utilisateur ↔ membre du foyer (join multi-comptes)
ALTER TABLE household_members ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_household_members_user_id
  ON household_members(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_household_members_user_id ON household_members(user_id);
