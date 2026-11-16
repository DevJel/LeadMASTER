-- Prevent restoration while an R2 + D1 permanent deletion is in progress.
-- Deploy this schema before code that references deletion_pending.
ALTER TABLE inbound_mail ADD COLUMN deletion_pending INTEGER NOT NULL DEFAULT 0 CHECK (deletion_pending IN (0, 1));
