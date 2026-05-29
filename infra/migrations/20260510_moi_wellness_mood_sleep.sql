ALTER TABLE household_moi_wellness
    ADD COLUMN IF NOT EXISTS sleep_hours REAL NOT NULL DEFAULT 7;

ALTER TABLE household_moi_wellness
    ADD COLUMN IF NOT EXISTS moi_mood INTEGER NOT NULL DEFAULT 3;

ALTER TABLE household_moi_wellness
    ADD COLUMN IF NOT EXISTS home_mood INTEGER;
