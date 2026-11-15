-- One short-lived verification lease per account; this table stores no credentials.
CREATE TABLE external_smtp_verification_leases (
  account_id TEXT PRIMARY KEY,
  token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  next_allowed_at INTEGER NOT NULL
);
