-- Durable, account-scoped records used by the LeadMASTER workspace UI.
CREATE TABLE IF NOT EXISTS leadmaster_records (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  collection TEXT NOT NULL,
  value_json TEXT NOT NULL CHECK (json_valid(value_json)),
  idempotency_key TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  UNIQUE (account_id, collection, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_leadmaster_records_account_collection_updated
  ON leadmaster_records(account_id, collection, updated_at DESC);
