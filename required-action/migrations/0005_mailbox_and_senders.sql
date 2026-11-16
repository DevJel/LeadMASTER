-- Dedicated LeadMASTER inbound mailbox, outbound audit history and suppression records.
CREATE TABLE IF NOT EXISTS admin_sent_mail (
 id TEXT PRIMARY KEY, recipient TEXT NOT NULL, subject TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('sending','accepted','failed','unknown')),
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, from_email TEXT NOT NULL,
 from_name TEXT NOT NULL, reply_to TEXT NOT NULL, text_body TEXT NOT NULL, error_code TEXT
);
CREATE INDEX IF NOT EXISTS idx_admin_sent_created ON admin_sent_mail(created_at DESC);
CREATE TABLE IF NOT EXISTS email_delivery_events (
 id TEXT PRIMARY KEY, email TEXT NOT NULL, subject TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL, created_at INTEGER NOT NULL, detail TEXT
);
CREATE TABLE IF NOT EXISTS email_unsubscribes (
 id TEXT PRIMARY KEY, email TEXT NOT NULL, source TEXT NOT NULL,
 created_at INTEGER NOT NULL, reason TEXT, UNIQUE(email)
);
CREATE INDEX IF NOT EXISTS idx_unsub_email ON email_unsubscribes(email);
ALTER TABLE developer_email_requests ADD COLUMN from_email TEXT;
ALTER TABLE developer_email_requests ADD COLUMN sender_name TEXT;
ALTER TABLE developer_email_requests ADD COLUMN reply_to TEXT;
