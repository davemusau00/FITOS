CREATE TABLE service_inventory_requirements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE, item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  quantity_per_session integer NOT NULL CHECK (quantity_per_session > 0), UNIQUE (tenant_id, service_id, item_id)
);
CREATE TABLE inventory_consumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT, item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  service_id uuid REFERENCES services(id) ON DELETE SET NULL, reference_type varchar(40) NOT NULL, reference_id uuid,
  quantity integer NOT NULL CHECK (quantity > 0), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE (tenant_id, item_id, reference_type, reference_id)
);
CREATE INDEX idx_inventory_consumptions_tenant_item ON inventory_consumptions(tenant_id, item_id, created_at DESC);
