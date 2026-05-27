CREATE TABLE IF NOT EXISTS household_budget_envelopes (
    id SERIAL PRIMARY KEY,
    household_id INTEGER NOT NULL REFERENCES households(id),
    slug VARCHAR(64) NOT NULL,
    label VARCHAR(255) NOT NULL,
    spent INTEGER NOT NULL DEFAULT 0,
    budget_cap INTEGER NOT NULL DEFAULT 0,
    color VARCHAR(32) NOT NULL DEFAULT '#6BA898',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (household_id, slug)
);

CREATE INDEX IF NOT EXISTS ix_household_budget_envelopes_household_id
    ON household_budget_envelopes (household_id);

CREATE TABLE IF NOT EXISTS household_meal_plans (
    id SERIAL PRIMARY KEY,
    household_id INTEGER NOT NULL REFERENCES households(id),
    day_key VARCHAR(10) NOT NULL,
    lunch TEXT NOT NULL DEFAULT '',
    dinner TEXT NOT NULL DEFAULT '',
    missing_json TEXT NOT NULL DEFAULT '[]',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    UNIQUE (household_id, day_key)
);

CREATE INDEX IF NOT EXISTS ix_household_meal_plans_household_id
    ON household_meal_plans (household_id);

CREATE INDEX IF NOT EXISTS ix_household_meal_plans_household_day
    ON household_meal_plans (household_id, day_key);
