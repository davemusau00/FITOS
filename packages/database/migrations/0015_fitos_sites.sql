CREATE TABLE site_configs (
  tenant_id uuid PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  theme_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  published_version integer,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE site_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  slug varchar(120) NOT NULL,
  title varchar(160) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'draft',
  sections_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  seo_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  version integer NOT NULL DEFAULT 1,
  published_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, slug),
  CHECK (status IN ('draft','published'))
);
CREATE INDEX idx_site_pages_tenant_status ON site_pages(tenant_id, status);
