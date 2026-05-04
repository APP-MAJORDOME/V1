-- Faits mémorisés par foyer (contexte long terme pour MajIA / Alfred).

CREATE TABLE IF NOT EXISTS household_memory_facts (
    id SERIAL PRIMARY KEY,
    household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    fact_text TEXT NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_household_memory_facts_household_id ON household_memory_facts(household_id);
