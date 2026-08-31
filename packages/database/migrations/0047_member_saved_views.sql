CREATE TABLE IF NOT EXISTS member_saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name varchar(120) NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_member_saved_views_tenant_user_name UNIQUE (tenant_id, user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_member_saved_views_tenant_user_updated
  ON member_saved_views (tenant_id, user_id, updated_at);
