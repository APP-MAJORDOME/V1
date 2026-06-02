-- Trousseau de mots de passe utilisateur (intégrations marchandes / services).

CREATE TABLE IF NOT EXISTS user_vault_secrets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label VARCHAR(255) NOT NULL,
    service_key VARCHAR(64) NOT NULL DEFAULT 'other',
    username VARCHAR(255),
    password_blob TEXT NOT NULL DEFAULT '',
    login_url VARCHAR(512),
    notes TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_user_vault_secrets_user_id ON user_vault_secrets(user_id);
CREATE INDEX IF NOT EXISTS ix_user_vault_secrets_user_service ON user_vault_secrets(user_id, service_key);
