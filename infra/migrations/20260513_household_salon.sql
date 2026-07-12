CREATE TABLE IF NOT EXISTS household_salon_messages (
    id SERIAL PRIMARY KEY,
    household_id INTEGER NOT NULL REFERENCES households(id),
    author_user_id INTEGER REFERENCES users(id),
    author_label VARCHAR(120) NOT NULL DEFAULT '',
    body_text TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    updated_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
);
CREATE INDEX IF NOT EXISTS ix_household_salon_messages_household_id ON household_salon_messages(household_id);
CREATE INDEX IF NOT EXISTS ix_household_salon_messages_created ON household_salon_messages(household_id, created_at);

CREATE TABLE IF NOT EXISTS household_captures (
    id SERIAL PRIMARY KEY,
    household_id INTEGER NOT NULL REFERENCES households(id),
    kind VARCHAR(32) NOT NULL DEFAULT 'suggestion',
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    source VARCHAR(32) NOT NULL DEFAULT 'salon',
    chip VARCHAR(32) NOT NULL DEFAULT 'foyer',
    source_label VARCHAR(255) NOT NULL DEFAULT '',
    excerpt TEXT NOT NULL DEFAULT '',
    inferences_json TEXT NOT NULL DEFAULT '[]',
    cta_primary VARCHAR(64),
    cta_secondary VARCHAR(64),
    payload_json TEXT NOT NULL DEFAULT '{}',
    message_ids_json TEXT NOT NULL DEFAULT '[]',
    created_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc'),
    updated_at TIMESTAMP NOT NULL DEFAULT (NOW() AT TIME ZONE 'utc')
);
CREATE INDEX IF NOT EXISTS ix_household_captures_household_id ON household_captures(household_id);
CREATE INDEX IF NOT EXISTS ix_household_captures_status ON household_captures(household_id, status);
