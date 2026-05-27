CREATE TABLE IF NOT EXISTS household_grocery_items (
    id SERIAL PRIMARY KEY,
    household_id INTEGER NOT NULL REFERENCES households(id),
    label VARCHAR(512) NOT NULL,
    done BOOLEAN NOT NULL DEFAULT FALSE,
    delegated BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_household_grocery_items_household_id
    ON household_grocery_items (household_id);

CREATE INDEX IF NOT EXISTS ix_household_grocery_items_household_done
    ON household_grocery_items (household_id, done);
