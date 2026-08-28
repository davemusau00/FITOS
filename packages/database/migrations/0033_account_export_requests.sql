CREATE TABLE IF NOT EXISTS account_export_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  requested_by_user_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status varchar(30) NOT NULL DEFAULT 'requested',
  format varchar(20) NOT NULL DEFAULT 'json',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_account_export_requests_tenant_created
  ON account_export_requests (tenant_id, created_at);
