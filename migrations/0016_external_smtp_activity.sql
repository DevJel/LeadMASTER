-- Internal LeadMASTER submission states only; no provider-wide statistics,
-- credentials, recipients, subjects, or message content are stored here.
CREATE TABLE external_smtp_activity (
  account_id TEXT NOT NULL,
  connection_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('queued','accepted','failed','unknown')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, message_id)
);
CREATE INDEX idx_external_smtp_activity_owner_sender_time
  ON external_smtp_activity(account_id, connection_id, created_at DESC, message_id DESC);
