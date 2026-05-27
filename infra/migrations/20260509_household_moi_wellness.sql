CREATE TABLE IF NOT EXISTS household_moi_wellness (
    id SERIAL PRIMARY KEY,
    household_id INTEGER NOT NULL UNIQUE REFERENCES households(id),
    journal_text TEXT NOT NULL DEFAULT '',
    cycle_day INTEGER NOT NULL DEFAULT 18,
    moments_json TEXT NOT NULL DEFAULT '[]',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_household_moi_wellness_household_id
    ON household_moi_wellness (household_id);
