CREATE TABLE IF NOT EXISTS platform_plan_definitions (
  key VARCHAR(30) PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  quotas JSONB NOT NULL,
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO platform_plan_definitions (key, name, description, quotas, capabilities)
VALUES
  ('starter', 'FITOS Starter', 'Starter workspace plan', '{"maxMembers":500,"maxStaff":20,"maxBranches":5,"maxAutomationRuns":5000,"maxStorageMb":2048}', '["feature.crm","feature.portal"]'),
  ('pro', 'FITOS Pro', 'Pro workspace plan', '{"maxMembers":2000,"maxStaff":75,"maxBranches":15,"maxAutomationRuns":25000,"maxStorageMb":10240}', '["feature.crm","feature.portal","feature.insights","feature.automations"]'),
  ('business', 'FITOS Business', 'Business workspace plan', '{"maxMembers":10000,"maxStaff":250,"maxBranches":50,"maxAutomationRuns":100000,"maxStorageMb":51200}', '["feature.crm","feature.portal","feature.insights","feature.automations","feature.assessments","feature.therapy","feature.inventory","feature.equipment","feature.sites","feature.integrations"]')
ON CONFLICT (key) DO NOTHING;
