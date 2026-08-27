ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS action_id uuid;
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS action_type varchar(80);
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS provider varchar(100);
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS external_id varchar(255);
CREATE INDEX IF NOT EXISTS idx_automation_runs_action ON automation_runs (tenant_id, action_id);
