-- Additive only. Existing requests remain NULL because the original submitted
-- payload (in particular optional sender_name) cannot be reconstructed safely.
ALTER TABLE developer_email_requests ADD COLUMN request_fingerprint TEXT;
