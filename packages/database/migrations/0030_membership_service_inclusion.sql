ALTER TABLE membership_plans
  ADD COLUMN IF NOT EXISTS included_service_ids jsonb;
