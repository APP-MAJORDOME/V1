CREATE TABLE IF NOT EXISTS household_fridge_items (
    id SERIAL PRIMARY KEY,
    household_id INTEGER NOT NULL REFERENCES households(id),
    label VARCHAR(512) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    qty INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_household_fridge_items_household_id
    ON household_fridge_items (household_id);

CREATE INDEX IF NOT EXISTS ix_household_fridge_items_household_expires
    ON household_fridge_items (household_id, expires_at);
