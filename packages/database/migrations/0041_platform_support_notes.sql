CREATE TABLE IF NOT EXISTS platform_support_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  category VARCHAR(30) NOT NULL CHECK (category IN ('implementation', 'support', 'account', 'risk')),
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_platform_support_notes_tenant_created ON platform_support_notes(tenant_id, created_at DESC);
