CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id uuid REFERENCES branches(id) ON DELETE SET NULL,
  title varchar(180) NOT NULL,
  description text,
  assignee_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  priority varchar(20) NOT NULL DEFAULT 'normal',
  status varchar(20) NOT NULL DEFAULT 'open',
  due_at timestamptz,
  resource_type varchar(80),
  resource_id uuid,
  created_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_tenant_status_due
  ON tasks (tenant_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_assignee_status
  ON tasks (tenant_id, assignee_user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_tenant_branch
  ON tasks (tenant_id, branch_id);

INSERT INTO permissions (key, description)
VALUES
  ('task:read', 'View cross-domain staff tasks'),
  ('task:manage', 'Create and manage cross-domain staff tasks')
ON CONFLICT (key) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_key)
SELECT roles.id, permissions.key
FROM roles
JOIN permissions ON permissions.key IN ('task:read', 'task:manage')
WHERE roles.system_key IN ('owner', 'manager', 'reception', 'trainer', 'finance')
ON CONFLICT DO NOTHING;
