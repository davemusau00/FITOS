CREATE TABLE IF NOT EXISTS platform_account_recovery_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  subject JSONB NOT NULL,
  verification_metadata JSONB NOT NULL,
  actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  session_revocation JSONB NOT NULL,
  outcome VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending', 'resolved', 'denied')),
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_platform_recovery_cases_tenant_created
  ON platform_account_recovery_cases(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_recovery_cases_outcome
  ON platform_account_recovery_cases(outcome);
