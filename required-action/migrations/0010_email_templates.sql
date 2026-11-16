-- Plain-text templates are account-owned; no secrets or recipient lists are stored.
CREATE TABLE email_templates (
 id TEXT PRIMARY KEY,
 account_id TEXT NOT NULL,
 name TEXT NOT NULL COLLATE NOCASE,
 subject TEXT NOT NULL,
 text_body TEXT NOT NULL,
 html_body TEXT,
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 UNIQUE(account_id, name)
);
CREATE INDEX idx_email_templates_account_updated ON email_templates(account_id,updated_at DESC);

-- Optional HTML for admin email; plain text remains required as an alternative.
ALTER TABLE admin_sent_mail ADD COLUMN html_body TEXT;
