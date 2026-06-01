CREATE TABLE IF NOT EXISTS journal_entries (
    id SERIAL PRIMARY KEY,
    household_id INTEGER NOT NULL REFERENCES households(id),
    user_id INTEGER NOT NULL REFERENCES users(id),
    entry_date VARCHAR(10) NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_journal_entries_household_id ON journal_entries (household_id);
CREATE INDEX IF NOT EXISTS ix_journal_entries_user_id ON journal_entries (user_id);
CREATE INDEX IF NOT EXISTS ix_journal_entries_entry_date ON journal_entries (entry_date);
CREATE INDEX IF NOT EXISTS ix_journal_entries_user_date ON journal_entries (user_id, entry_date);
