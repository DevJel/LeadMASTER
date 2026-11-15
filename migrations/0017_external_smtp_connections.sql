-- Encrypted credential envelopes only; never store cleartext passwords.
-- Connections start unverified and cannot yet be used for delivery.
CREATE TABLE external_smtp_connections (
  id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  server TEXT NOT NULL,
  port INTEGER NOT NULL,
  security TEXT NOT NULL CHECK(security IN ('tls','starttls')),
  credential_key_id TEXT NOT NULL,
  credential_envelope TEXT NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1,
  verification_status TEXT NOT NULL DEFAULT 'unverified' CHECK(verification_status IN ('unverified','verified')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  revoked_at INTEGER,
  PRIMARY KEY (account_id,id)
);
CREATE INDEX idx_external_smtp_connections_account ON external_smtp_connections(account_id,revoked_at,created_at,id);
