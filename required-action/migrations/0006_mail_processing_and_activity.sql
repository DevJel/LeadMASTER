-- Mail sending queue, message history, notifications and user activity.
ALTER TABLE admin_sent_mail ADD COLUMN queue_status TEXT NOT NULL DEFAULT 'complete';
ALTER TABLE admin_sent_mail ADD COLUMN batch_id TEXT;
ALTER TABLE admin_sent_mail ADD COLUMN deleted_at INTEGER;
ALTER TABLE admin_sent_mail ADD COLUMN delivery_status TEXT;
ALTER TABLE inbound_mail ADD COLUMN deleted_at INTEGER;
ALTER TABLE inbound_mail ADD COLUMN ai_summary TEXT;
ALTER TABLE inbound_mail ADD COLUMN ai_suggested_reply TEXT;
ALTER TABLE developer_email_requests ADD COLUMN deleted_at INTEGER;
ALTER TABLE developer_email_requests ADD COLUMN text_body TEXT;
ALTER TABLE developer_email_requests ADD COLUMN html_body TEXT;
ALTER TABLE developer_email_requests ADD COLUMN delivery_status TEXT;
ALTER TABLE accounts ADD COLUMN owner_name TEXT;
CREATE INDEX IF NOT EXISTS idx_admin_sent_queue ON admin_sent_mail(queue_status,created_at);
CREATE TABLE IF NOT EXISTS workspace_activity (
 id TEXT PRIMARY KEY, actor_email TEXT NOT NULL, action TEXT NOT NULL,
 summary TEXT NOT NULL, target_id TEXT, created_at INTEGER NOT NULL, details_json TEXT
);
CREATE INDEX IF NOT EXISTS idx_workspace_activity_created ON workspace_activity(created_at DESC);
CREATE TABLE IF NOT EXISTS mail_notifications (
 id TEXT PRIMARY KEY, type TEXT NOT NULL, title TEXT NOT NULL,
 message TEXT NOT NULL, target_id TEXT, created_at INTEGER NOT NULL, read_at INTEGER
);
CREATE INDEX IF NOT EXISTS idx_mail_notifications_created ON mail_notifications(created_at DESC);
CREATE TABLE IF NOT EXISTS mail_send_batches (
 id TEXT PRIMARY KEY, created_by TEXT NOT NULL, total_count INTEGER NOT NULL,
 created_at INTEGER NOT NULL, status TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS mail_event_dedup (event_id TEXT PRIMARY KEY, received_at INTEGER NOT NULL);
