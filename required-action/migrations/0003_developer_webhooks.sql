CREATE TABLE IF NOT EXISTS developer_webhooks (
 id TEXT PRIMARY KEY,
 api_key_id TEXT NOT NULL,
 name TEXT NOT NULL,
 target_url TEXT NOT NULL,
 secret_hash TEXT NOT NULL,
 secret_value TEXT NOT NULL,
 events TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 revoked_at INTEGER,
 last_delivery_at INTEGER,
 FOREIGN KEY(api_key_id) REFERENCES developer_api_keys(id)
);
CREATE INDEX IF NOT EXISTS idx_developer_webhooks_key ON developer_webhooks(api_key_id,created_at DESC);
CREATE TABLE IF NOT EXISTS developer_webhook_deliveries (
 id TEXT PRIMARY KEY,
 webhook_id TEXT NOT NULL,
 event_type TEXT NOT NULL,
 event_id TEXT NOT NULL,
 http_status INTEGER,
 attempted_at INTEGER NOT NULL,
 success INTEGER NOT NULL DEFAULT 0,
 FOREIGN KEY(webhook_id) REFERENCES developer_webhooks(id)
);
CREATE INDEX IF NOT EXISTS idx_developer_webhook_deliveries_hook ON developer_webhook_deliveries(webhook_id,attempted_at DESC);
