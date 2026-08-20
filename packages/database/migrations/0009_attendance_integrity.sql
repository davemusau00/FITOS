-- Front-desk visits may be independent of a class occurrence.
ALTER TABLE "attendance_records"
  ALTER COLUMN "occurrence_id" DROP NOT NULL,
  ADD CONSTRAINT "attendance_status_valid"
    CHECK ("status" IN ('booked', 'checked_in', 'attended', 'no_show', 'late_cancel')),
  ADD CONSTRAINT "attendance_checkin_timestamp_valid"
    CHECK ("status" NOT IN ('checked_in', 'attended') OR "checked_in_at" IS NOT NULL),
  ADD CONSTRAINT "attendance_override_reason_nonblank"
    CHECK ("override_reason" IS NULL OR length(trim("override_reason")) > 0);

CREATE UNIQUE INDEX "uq_attendance_occurrence_member"
  ON "attendance_records" ("tenant_id", "occurrence_id", "member_id")
  WHERE "occurrence_id" IS NOT NULL;
CREATE UNIQUE INDEX "uq_attendance_active_general_visit"
  ON "attendance_records" ("tenant_id", "branch_id", "member_id")
  WHERE "occurrence_id" IS NULL AND "status" = 'checked_in';
CREATE INDEX "idx_attendance_tenant_occurrence_status"
  ON "attendance_records" ("tenant_id", "occurrence_id", "status");
CREATE INDEX "idx_attendance_tenant_member_created"
  ON "attendance_records" ("tenant_id", "member_id", "created_at" DESC);
CREATE INDEX "idx_attendance_tenant_branch_status_created"
  ON "attendance_records" ("tenant_id", "branch_id", "status", "created_at" DESC);

CREATE FUNCTION assert_attendance_references_belong_to_tenant() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM branches WHERE id = NEW.branch_id AND tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'attendance branch must belong to tenant';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM members WHERE id = NEW.member_id AND tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'attendance member must belong to tenant';
  END IF;
  IF NEW.occurrence_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM schedule_occurrences
    WHERE id = NEW.occurrence_id
      AND tenant_id = NEW.tenant_id
      AND branch_id = NEW.branch_id
      AND status = 'scheduled'
  ) THEN
    RAISE EXCEPTION 'attendance occurrence must be scheduled in tenant and branch';
  END IF;
  IF NEW.actor_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM tenant_users
    WHERE tenant_id = NEW.tenant_id
      AND user_id = NEW.actor_user_id
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'attendance actor must be active in tenant';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "attendance_records_tenant_guard"
BEFORE INSERT OR UPDATE OF tenant_id, branch_id, occurrence_id, member_id, actor_user_id
ON "attendance_records"
FOR EACH ROW EXECUTE FUNCTION assert_attendance_references_belong_to_tenant();

CREATE FUNCTION protect_attendance_history() RETURNS trigger AS $$
DECLARE
  normal_transition boolean;
BEGIN
  IF NEW.tenant_id <> OLD.tenant_id
    OR NEW.branch_id <> OLD.branch_id
    OR NEW.occurrence_id IS DISTINCT FROM OLD.occurrence_id
    OR NEW.member_id <> OLD.member_id
    OR NEW.actor_user_id IS DISTINCT FROM OLD.actor_user_id
    OR (
      NEW.checked_in_at IS DISTINCT FROM OLD.checked_in_at
      AND NOT (
        OLD.checked_in_at IS NULL
        AND NEW.checked_in_at IS NOT NULL
        AND NEW.status IN ('checked_in', 'attended')
      )
    )
    OR NEW.created_at <> OLD.created_at
  THEN
    RAISE EXCEPTION 'attendance identity and check-in history are immutable';
  END IF;

  normal_transition :=
    (OLD.status = NEW.status)
    OR (OLD.status = 'booked' AND NEW.status IN ('checked_in', 'no_show', 'late_cancel'))
    OR (OLD.status = 'checked_in' AND NEW.status = 'attended');

  IF NOT normal_transition AND NOT (
    NEW.override_reason IS DISTINCT FROM OLD.override_reason
    AND NEW.override_reason IS NOT NULL
    AND length(trim(NEW.override_reason)) > 0
  ) THEN
    RAISE EXCEPTION 'illegal attendance transition from % to % requires a new override reason',
      OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "attendance_records_history_guard"
BEFORE UPDATE ON "attendance_records"
FOR EACH ROW EXECUTE FUNCTION protect_attendance_history();
