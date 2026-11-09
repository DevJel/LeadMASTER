-- Durable send fence. Apply before deploying the new queue consumer.
CREATE TABLE mail_send_claims (
 source TEXT NOT NULL CHECK (source IN ('admin','developer')),
 request_id TEXT NOT NULL,
 state TEXT NOT NULL CHECK (state IN ('started','accepted','failed','unknown')),
 claimed_at INTEGER NOT NULL,
 completed_at INTEGER,
 PRIMARY KEY (source, request_id)
);
CREATE INDEX idx_mail_send_claims_pending ON mail_send_claims(state,claimed_at);
