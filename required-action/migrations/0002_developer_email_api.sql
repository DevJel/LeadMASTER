-- LeadMASTER developer-owned API credentials and email request records.
CREATE TABLE IF NOT EXISTS developer_api_keys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL UNIQUE,
  key_hash TEXT NOT NULL,
  scopes TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  revoked_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_developer_api_keys_prefix ON developer_api_keys(key_prefix);
CREATE TABLE IF NOT EXISTS developer_email_requests (
  id TEXT PRIMARY KEY,
  api_key_id TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('sending','accepted','failed','unknown')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  error_code TEXT,
  UNIQUE(api_key_id,idempotency_key),
  FOREIGN KEY(api_key_id) REFERENCES developer_api_keys(id)
);
CREATE INDEX IF NOT EXISTS idx_developer_email_requests_key_created ON developer_email_requests(api_key_id,created_at DESC);
