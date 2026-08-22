CREATE OR REPLACE FUNCTION prevent_overlapping_equipment_allocations() RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'reserved' AND EXISTS (
    SELECT 1 FROM occurrence_equipment_allocations a
    JOIN schedule_occurrences existing ON existing.id = a.occurrence_id
    JOIN schedule_occurrences incoming ON incoming.id = NEW.occurrence_id
    WHERE a.asset_id = NEW.asset_id AND a.tenant_id = NEW.tenant_id AND a.status = 'reserved' AND a.id <> NEW.id
      AND existing.starts_at < incoming.ends_at AND existing.ends_at > incoming.starts_at
  ) THEN RAISE EXCEPTION 'equipment asset already reserved for overlapping occurrence'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS occurrence_equipment_overlap_guard ON occurrence_equipment_allocations;
CREATE TRIGGER occurrence_equipment_overlap_guard BEFORE INSERT OR UPDATE ON occurrence_equipment_allocations FOR EACH ROW EXECUTE FUNCTION prevent_overlapping_equipment_allocations();
