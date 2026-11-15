-- Account-owned unsent drafts. Creating or editing a draft never submits mail.
CREATE TABLE email_drafts (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  to_addresses TEXT NOT NULL DEFAULT '',
  cc_addresses TEXT NOT NULL DEFAULT '',
  bcc_addresses TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  text_body TEXT NOT NULL DEFAULT '',
  html_body TEXT,
  revision INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_email_drafts_account_updated ON email_drafts(account_id, updated_at DESC, id);
