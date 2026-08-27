-- Scope NEW.member_id only to member identity/session trigger invocations.
CREATE OR REPLACE FUNCTION assert_member_identity_and_reservation_tenant() RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME IN ('member_identities', 'member_sessions') THEN
    IF NOT EXISTS (
      SELECT 1 FROM members WHERE id = NEW.member_id AND tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'member identity/session member must belong to tenant';
    END IF;
  ELSIF TG_TABLE_NAME = 'public_reservations' THEN
    IF NEW.branch_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM branches WHERE id = NEW.branch_id AND tenant_id = NEW.tenant_id
    ) THEN
      RAISE EXCEPTION 'reservation branch must belong to tenant';
    END IF;
    IF NEW.service_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM services
      WHERE id = NEW.service_id AND tenant_id = NEW.tenant_id
        AND (NEW.branch_id IS NULL OR branch_id IS NULL OR branch_id = NEW.branch_id)
    ) THEN
      RAISE EXCEPTION 'reservation service must belong to tenant and branch';
    END IF;
    IF NEW.occurrence_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM schedule_occurrences
      WHERE id = NEW.occurrence_id AND tenant_id = NEW.tenant_id
        AND (NEW.branch_id IS NULL OR branch_id = NEW.branch_id)
    ) THEN
      RAISE EXCEPTION 'reservation occurrence must belong to tenant and branch';
    END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
