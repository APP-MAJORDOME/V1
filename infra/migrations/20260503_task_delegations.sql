-- Notifications de délégation partenaire (SMS/e-mail optionnels + lien d'accusé).

CREATE TABLE IF NOT EXISTS task_delegations (
    id SERIAL PRIMARY KEY,
    household_id INTEGER NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    partner_display_name VARCHAR(255) NOT NULL,
    partner_contact VARCHAR(255),
    task_snapshot_json TEXT NOT NULL DEFAULT '[]',
    ack_token VARCHAR(96) NOT NULL UNIQUE,
    status VARCHAR(32) NOT NULL DEFAULT 'sent',
    acknowledged_at TIMESTAMP WITHOUT TIME ZONE,
    last_sent_at TIMESTAMP WITHOUT TIME ZONE,
    reminder_count INTEGER NOT NULL DEFAULT 0,
    next_reminder_at TIMESTAMP WITHOUT TIME ZONE,
    delivery_channels_json TEXT NOT NULL DEFAULT '[]',
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_task_delegations_household_id ON task_delegations(household_id);
CREATE INDEX IF NOT EXISTS ix_task_delegations_ack_token ON task_delegations(ack_token);
