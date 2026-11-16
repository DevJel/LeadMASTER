-- Fresh LeadMASTER core schema for Turso. No D1 data is imported.
CREATE TABLE auth_challenges (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_auth_challenges_email_created ON auth_challenges(email, created_at DESC);

CREATE TABLE auth_sessions (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER
);
CREATE INDEX idx_auth_sessions_email ON auth_sessions(email);
CREATE INDEX idx_auth_sessions_expiry ON auth_sessions(expires_at);

CREATE TABLE auth_rate_limits (
  bucket_key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE inbound_mail (
  id TEXT PRIMARY KEY,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  subject TEXT NOT NULL DEFAULT '',
  message_id TEXT,
  received_at INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  delivery_status TEXT NOT NULL DEFAULT 'received',
  parse_status TEXT NOT NULL DEFAULT 'pending',
  archived_at INTEGER,
  read_at INTEGER
);
CREATE INDEX idx_inbound_mail_received ON inbound_mail(received_at DESC);
CREATE INDEX idx_inbound_mail_archived ON inbound_mail(archived_at);
