CREATE TABLE IF NOT EXISTS household_wallet_cards (
    id SERIAL PRIMARY KEY,
    household_id INTEGER NOT NULL REFERENCES households(id),
    brand VARCHAR(255) NOT NULL,
    points INTEGER NOT NULL DEFAULT 0,
    color VARCHAR(32) NOT NULL DEFAULT '#2B7A4B',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_household_wallet_cards_household_id
    ON household_wallet_cards (household_id);

CREATE TABLE IF NOT EXISTS household_coupons (
    id SERIAL PRIMARY KEY,
    household_id INTEGER NOT NULL REFERENCES households(id),
    label VARCHAR(512) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    discount VARCHAR(64) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ix_household_coupons_household_id
    ON household_coupons (household_id);

CREATE INDEX IF NOT EXISTS ix_household_coupons_household_expires
    ON household_coupons (household_id, expires_at);
