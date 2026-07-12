-- F1-1 conseil foyer + F1-8 type foyer + invitations + F1-3 briefing
ALTER TABLE households ADD COLUMN IF NOT EXISTS household_type VARCHAR(64) NOT NULL DEFAULT 'famille';
ALTER TABLE households ADD COLUMN IF NOT EXISTS invite_code VARCHAR(32);
ALTER TABLE households ADD COLUMN IF NOT EXISTS last_morning_briefing_date VARCHAR(10) NOT NULL DEFAULT '';
ALTER TABLE households ADD COLUMN IF NOT EXISTS last_equity_council_week VARCHAR(10) NOT NULL DEFAULT '';
ALTER TABLE households ADD COLUMN IF NOT EXISTS briefing_hour INTEGER NOT NULL DEFAULT 7;

CREATE UNIQUE INDEX IF NOT EXISTS ix_households_invite_code ON households(invite_code) WHERE invite_code IS NOT NULL;

ALTER TABLE household_moi_wellness ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_moi_wellness_household_user ON household_moi_wellness(household_id, user_id);
