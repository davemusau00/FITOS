-- Forward-only hardening for the advanced operations modules.

CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  branch_id uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  purchase_order_id uuid NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_cost_minor integer NOT NULL CHECK (unit_cost_minor >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (purchase_order_id, item_id)
);
CREATE INDEX IF NOT EXISTS idx_purchase_order_lines_tenant_po ON purchase_order_lines (tenant_id, purchase_order_id);

CREATE TABLE IF NOT EXISTS assessment_metric_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  assessment_session_id uuid NOT NULL REFERENCES assessment_sessions(id) ON DELETE CASCADE,
  metric_key varchar(80) NOT NULL,
  value_numeric numeric,
  value_text text,
  unit varchar(30),
  provenance_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (value_numeric IS NOT NULL OR value_text IS NOT NULL),
  UNIQUE (assessment_session_id, metric_key)
);
CREATE INDEX IF NOT EXISTS idx_assessment_metric_results_tenant_session ON assessment_metric_results (tenant_id, assessment_session_id);

ALTER TABLE assessment_device_imports
  ALTER COLUMN raw_payload DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS parser_version varchar(80) NOT NULL DEFAULT 'legacy',
  ADD COLUMN IF NOT EXISTS content_type varchar(100),
  ADD COLUMN IF NOT EXISTS error_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;
CREATE UNIQUE INDEX IF NOT EXISTS uq_device_import_checksum
  ON assessment_device_imports (tenant_id, branch_id, raw_checksum);

CREATE OR REPLACE FUNCTION assert_advanced_operations_tenant_integrity() RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME IN ('equipment_pools', 'equipment_assets', 'inventory_items', 'assessment_sessions', 'therapy_sessions', 'assessment_device_imports', 'inventory_movements', 'purchase_orders', 'purchase_order_lines', 'equipment_maintenance_records')
     AND NOT EXISTS (SELECT 1 FROM branches WHERE id = NEW.branch_id AND tenant_id = NEW.tenant_id) THEN
    RAISE EXCEPTION '% branch must belong to tenant', TG_TABLE_NAME;
  END IF;
  IF TG_TABLE_NAME = 'equipment_assets' AND NEW.pool_id IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM equipment_pools WHERE id = NEW.pool_id AND tenant_id = NEW.tenant_id AND branch_id = NEW.branch_id) THEN
    RAISE EXCEPTION 'equipment asset pool must belong to tenant and branch';
  END IF;
  IF TG_TABLE_NAME = 'service_equipment_requirements' AND NOT EXISTS (
    SELECT 1 FROM services s JOIN equipment_pools p ON p.id = NEW.pool_id
    WHERE s.id = NEW.service_id AND s.tenant_id = NEW.tenant_id AND p.tenant_id = NEW.tenant_id
      AND (s.branch_id IS NULL OR s.branch_id = p.branch_id)
  ) THEN RAISE EXCEPTION 'service equipment requirement must be tenant and branch compatible'; END IF;
  IF TG_TABLE_NAME = 'occurrence_equipment_allocations' AND NOT EXISTS (
    SELECT 1 FROM schedule_occurrences o JOIN equipment_assets a ON a.id = NEW.asset_id
    WHERE o.id = NEW.occurrence_id AND o.tenant_id = NEW.tenant_id AND a.tenant_id = NEW.tenant_id AND o.branch_id = a.branch_id
  ) THEN RAISE EXCEPTION 'occurrence asset allocation must be tenant and branch compatible'; END IF;
  IF TG_TABLE_NAME = 'inventory_movements' AND NOT EXISTS (
    SELECT 1 FROM inventory_items i WHERE i.id = NEW.item_id AND i.tenant_id = NEW.tenant_id AND i.branch_id = NEW.branch_id
  ) THEN RAISE EXCEPTION 'inventory movement item must belong to tenant and branch'; END IF;
  IF TG_TABLE_NAME = 'purchase_order_lines' AND NOT EXISTS (
    SELECT 1 FROM purchase_orders po JOIN inventory_items i ON i.id = NEW.item_id
    WHERE po.id = NEW.purchase_order_id AND po.tenant_id = NEW.tenant_id AND po.branch_id = NEW.branch_id
      AND i.tenant_id = NEW.tenant_id AND i.branch_id = NEW.branch_id
  ) THEN RAISE EXCEPTION 'purchase order line must belong to the purchase order tenant and branch'; END IF;
  IF TG_TABLE_NAME = 'assessment_sessions' AND NOT EXISTS (
    SELECT 1 FROM members m JOIN assessment_definitions d ON d.id = NEW.definition_id
    WHERE m.id = NEW.member_id AND m.tenant_id = NEW.tenant_id AND d.tenant_id = NEW.tenant_id
  ) THEN RAISE EXCEPTION 'assessment references must belong to tenant'; END IF;
  IF TG_TABLE_NAME = 'therapy_sessions' AND NOT EXISTS (
    SELECT 1 FROM members m JOIN therapy_protocols p ON p.id = NEW.protocol_id
    WHERE m.id = NEW.member_id AND m.tenant_id = NEW.tenant_id AND p.tenant_id = NEW.tenant_id
  ) THEN RAISE EXCEPTION 'therapy references must belong to tenant'; END IF;
  IF TG_TABLE_NAME = 'therapy_sessions' AND NEW.asset_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM equipment_assets WHERE id = NEW.asset_id AND tenant_id = NEW.tenant_id AND branch_id = NEW.branch_id
  ) THEN RAISE EXCEPTION 'therapy asset must belong to tenant and branch'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

DO $$ DECLARE t text; BEGIN
  FOREACH t IN ARRAY ARRAY['equipment_pools','equipment_assets','equipment_maintenance_records','service_equipment_requirements','occurrence_equipment_allocations','inventory_items','inventory_movements','purchase_orders','purchase_order_lines','assessment_sessions','assessment_device_imports','therapy_sessions'] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_tenant_guard', t);
    EXECUTE format('CREATE TRIGGER %I BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION assert_advanced_operations_tenant_integrity()', t || '_tenant_guard', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION protect_inventory_movement_history() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'inventory movements are immutable'; END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS inventory_movements_history_guard ON inventory_movements;
CREATE TRIGGER inventory_movements_history_guard BEFORE UPDATE OR DELETE ON inventory_movements
FOR EACH ROW EXECUTE FUNCTION protect_inventory_movement_history();
