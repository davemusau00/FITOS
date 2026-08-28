-- Scope table-specific NEW fields before PostgreSQL resolves record attributes.
CREATE OR REPLACE FUNCTION assert_advanced_operations_tenant_integrity() RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME IN ('equipment_pools', 'equipment_assets', 'inventory_items', 'assessment_sessions', 'therapy_sessions', 'assessment_device_imports', 'inventory_movements', 'purchase_orders', 'purchase_order_lines', 'equipment_maintenance_records')
     AND NOT EXISTS (SELECT 1 FROM branches WHERE id = NEW.branch_id AND tenant_id = NEW.tenant_id) THEN
    RAISE EXCEPTION '% branch must belong to tenant', TG_TABLE_NAME;
  END IF;
  IF TG_TABLE_NAME = 'equipment_assets' THEN
    IF NEW.pool_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM equipment_pools WHERE id = NEW.pool_id AND tenant_id = NEW.tenant_id AND branch_id = NEW.branch_id) THEN
      RAISE EXCEPTION 'equipment asset pool must belong to tenant and branch';
    END IF;
  ELSIF TG_TABLE_NAME = 'service_equipment_requirements' THEN
    IF NOT EXISTS (SELECT 1 FROM services s JOIN equipment_pools p ON p.id = NEW.pool_id WHERE s.id = NEW.service_id AND s.tenant_id = NEW.tenant_id AND p.tenant_id = NEW.tenant_id AND (s.branch_id IS NULL OR s.branch_id = p.branch_id)) THEN
      RAISE EXCEPTION 'service equipment requirement must be tenant and branch compatible';
    END IF;
  ELSIF TG_TABLE_NAME = 'occurrence_equipment_allocations' THEN
    IF NOT EXISTS (SELECT 1 FROM schedule_occurrences o JOIN equipment_assets a ON a.id = NEW.asset_id WHERE o.id = NEW.occurrence_id AND o.tenant_id = NEW.tenant_id AND a.tenant_id = NEW.tenant_id AND o.branch_id = a.branch_id) THEN
      RAISE EXCEPTION 'occurrence asset allocation must be tenant and branch compatible';
    END IF;
  ELSIF TG_TABLE_NAME = 'inventory_movements' THEN
    IF NOT EXISTS (SELECT 1 FROM inventory_items i WHERE i.id = NEW.item_id AND i.tenant_id = NEW.tenant_id AND i.branch_id = NEW.branch_id) THEN
      RAISE EXCEPTION 'inventory movement item must belong to tenant and branch';
    END IF;
  ELSIF TG_TABLE_NAME = 'purchase_order_lines' THEN
    IF NOT EXISTS (SELECT 1 FROM purchase_orders po JOIN inventory_items i ON i.id = NEW.item_id WHERE po.id = NEW.purchase_order_id AND po.tenant_id = NEW.tenant_id AND po.branch_id = NEW.branch_id AND i.tenant_id = NEW.tenant_id AND i.branch_id = NEW.branch_id) THEN
      RAISE EXCEPTION 'purchase order line must belong to the purchase order tenant and branch';
    END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
