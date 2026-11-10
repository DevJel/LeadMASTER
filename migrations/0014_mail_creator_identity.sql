-- Keep the authenticated workspace actor separate from the optional Reply-To header.
ALTER TABLE admin_sent_mail ADD COLUMN created_by TEXT NOT NULL DEFAULT '';
