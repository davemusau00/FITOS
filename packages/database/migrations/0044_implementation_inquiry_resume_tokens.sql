ALTER TABLE implementation_inquiries
  ADD COLUMN IF NOT EXISTS resume_token_hash varchar(64),
  ADD COLUMN IF NOT EXISTS resume_token_expires_at timestamptz;

