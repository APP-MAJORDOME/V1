-- Coffre documents par foyer (données privées, filtrées par household_id côté API).

CREATE TABLE IF NOT EXISTS household_documents (
    id SERIAL PRIMARY KEY,
    household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    icon VARCHAR(16) NOT NULL DEFAULT '📄',
    name VARCHAR(512) NOT NULL,
    category VARCHAR(128) NOT NULL DEFAULT 'Divers',
    date_label VARCHAR(128),
    expires_at TIMESTAMP WITHOUT TIME ZONE,
    who VARCHAR(255),
    urgent BOOLEAN NOT NULL DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_household_documents_household_id ON household_documents(household_id);
CREATE INDEX IF NOT EXISTS ix_household_documents_category ON household_documents(category);
