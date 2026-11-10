-- Optional carbon-copy and blind-carbon-copy recipients for admin composed mail.
ALTER TABLE admin_sent_mail ADD COLUMN cc TEXT NOT NULL DEFAULT '[]';
ALTER TABLE admin_sent_mail ADD COLUMN bcc TEXT NOT NULL DEFAULT '[]';
