CREATE TABLE inventory_lots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT, item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  lot_code varchar(100) NOT NULL, expires_on date, quantity_on_hand integer NOT NULL CHECK (quantity_on_hand >= 0), received_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(tenant_id, branch_id, item_id, lot_code)
);
CREATE TABLE inventory_stocktakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT, status varchar(20) NOT NULL DEFAULT 'draft', notes text,
  completed_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL, completed_at timestamptz, created_at timestamptz NOT NULL DEFAULT now(),
  CHECK(status IN ('draft','completed'))
);
CREATE TABLE inventory_stocktake_lines (
  stocktake_id uuid NOT NULL REFERENCES inventory_stocktakes(id) ON DELETE CASCADE, item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  expected_quantity integer NOT NULL, counted_quantity integer NOT NULL CHECK (counted_quantity >= 0), PRIMARY KEY(stocktake_id,item_id)
);
CREATE INDEX idx_inventory_lots_expiry ON inventory_lots(tenant_id, branch_id, expires_on) WHERE expires_on IS NOT NULL;
