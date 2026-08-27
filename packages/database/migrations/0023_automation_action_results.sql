CREATE TABLE IF NOT EXISTS automation_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name varchar(200) NOT NULL,
  description text,
  trigger_type varchar(80) NOT NULL,
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  action_type varchar(80) NOT NULL,
  action_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  total_executions integer NOT NULL DEFAULT 0,
  last_executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS automation_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES automation_rules(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  status varchar(40) NOT NULL DEFAULT 'pending',
  trigger_event varchar(80) NOT NULL,
  target_entity_id uuid,
  target_entity_name varchar(160),
  message text,
  idempotency_key varchar(255),
  executed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_automation_rules_tenant ON automation_rules (tenant_id, is_active);
CREATE INDEX IF NOT EXISTS idx_automation_runs_rule ON automation_runs (rule_id);
CREATE INDEX IF NOT EXISTS idx_automation_runs_tenant_date ON automation_runs (tenant_id, executed_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_automation_runs_idempotency ON automation_runs (idempotency_key);

ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS action_id uuid;
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS action_type varchar(80);
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS provider varchar(100);
ALTER TABLE automation_runs ADD COLUMN IF NOT EXISTS external_id varchar(255);
CREATE INDEX IF NOT EXISTS idx_automation_runs_action ON automation_runs (tenant_id, action_id);
