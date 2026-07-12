-- Billing Stripe : ids client / abonnement par foyer
ALTER TABLE households ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(128);
ALTER TABLE households ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(128);
CREATE INDEX IF NOT EXISTS ix_households_stripe_customer_id ON households(stripe_customer_id);
