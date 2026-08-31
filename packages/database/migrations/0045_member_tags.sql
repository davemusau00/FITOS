CREATE TABLE IF NOT EXISTS member_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name varchar(80) NOT NULL,
  color varchar(30),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_member_tags_tenant_name UNIQUE (tenant_id, name)
);

CREATE INDEX IF NOT EXISTS idx_member_tags_tenant_created
  ON member_tags (tenant_id, created_at);

CREATE TABLE IF NOT EXISTS member_tag_assignments (
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES member_tags(id) ON DELETE CASCADE,
  assigned_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (member_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_member_tag_assignments_tenant_member
  ON member_tag_assignments (tenant_id, member_id);

CREATE INDEX IF NOT EXISTS idx_member_tag_assignments_tenant_tag
  ON member_tag_assignments (tenant_id, tag_id);
