CREATE TABLE IF NOT EXISTS leadmaster_reporter_runs (
  id TEXT PRIMARY KEY,
  report_date TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL CHECK (status IN ('running','ready_to_send','sent','failed')),
  started_at INTEGER NOT NULL,
  completed_at INTEGER,
  total_checks INTEGER NOT NULL DEFAULT 0,
  healthy_count INTEGER NOT NULL DEFAULT 0,
  fixed_count INTEGER NOT NULL DEFAULT 0,
  moderate_count INTEGER NOT NULL DEFAULT 0,
  attention_count INTEGER NOT NULL DEFAULT 0,
  manual_count INTEGER NOT NULL DEFAULT 0,
  unable_count INTEGER NOT NULL DEFAULT 0,
  email_status TEXT NOT NULL DEFAULT 'not_attempted' CHECK (email_status IN ('not_attempted','accepted','not_accepted','unknown')),
  email_message_id TEXT,
  report_json TEXT NOT NULL DEFAULT '{}',
  error_summary TEXT
);

CREATE INDEX IF NOT EXISTS idx_leadmaster_reporter_runs_date
  ON leadmaster_reporter_runs(report_date DESC, started_at DESC);
