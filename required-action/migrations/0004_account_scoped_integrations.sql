-- Account-owned integration resources. Every API key and integration belongs to one account.
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'My LeadMASTER workspace',
  owner_email TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS account_members (
  account_id TEXT NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('owner','admin','developer','viewer')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY(account_id,email),
  FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_account_members_email ON account_members(email);

ALTER TABLE developer_api_keys ADD COLUMN account_id TEXT REFERENCES accounts(id);
ALTER TABLE developer_email_requests ADD COLUMN account_id TEXT REFERENCES accounts(id);
ALTER TABLE developer_webhooks ADD COLUMN account_id TEXT REFERENCES accounts(id);

-- Preserve current records by grouping existing API-key owners into isolated accounts.
INSERT OR IGNORE INTO accounts(id,name,owner_email,created_at,updated_at)
SELECT 'acct_' || lower(hex(randomblob(16))),
       'My LeadMASTER workspace',
       lower(trim(created_by)),
       MIN(created_at),
       MIN(created_at)
FROM developer_api_keys
WHERE created_by IS NOT NULL AND trim(created_by) <> ''
GROUP BY lower(trim(created_by));

INSERT OR IGNORE INTO account_members(account_id,email,role,created_at)
SELECT id,owner_email,'owner',created_at FROM accounts;

UPDATE developer_api_keys
SET account_id=(SELECT id FROM accounts WHERE owner_email=lower(trim(developer_api_keys.created_by)))
WHERE account_id IS NULL;

UPDATE developer_email_requests
SET account_id=(SELECT account_id FROM developer_api_keys WHERE developer_api_keys.id=developer_email_requests.api_key_id)
WHERE account_id IS NULL;

UPDATE developer_webhooks
SET account_id=(SELECT account_id FROM developer_api_keys WHERE developer_api_keys.id=developer_webhooks.api_key_id)
WHERE account_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_developer_api_keys_account ON developer_api_keys(account_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_developer_email_requests_account ON developer_email_requests(account_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_developer_webhooks_account ON developer_webhooks(account_id,created_at DESC);
