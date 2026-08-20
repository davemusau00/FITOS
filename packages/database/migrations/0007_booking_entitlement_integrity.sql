-- Forward-only hardening of booking/credit invariants. Existing migrations remain immutable.

ALTER TABLE "services"
  ADD COLUMN "credits_required" integer NOT NULL DEFAULT 0,
  ADD COLUMN "cancellation_cutoff_minutes" integer NOT NULL DEFAULT 0,
  ADD COLUMN "restore_credit_on_late_cancel" boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT "service_credits_required_nonnegative" CHECK ("credits_required" >= 0),
  ADD CONSTRAINT "service_cancellation_cutoff_nonnegative" CHECK ("cancellation_cutoff_minutes" >= 0);

ALTER TABLE "bookings"
  ADD COLUMN "credit_membership_id" uuid REFERENCES "member_memberships"("id") ON DELETE RESTRICT,
  ADD COLUMN "credits_debited" integer NOT NULL DEFAULT 0,
  ADD COLUMN "entitlement_override_reason" varchar(255),
  ADD COLUMN "late_cancelled" boolean NOT NULL DEFAULT false,
  ADD CONSTRAINT "booking_credits_debited_nonnegative" CHECK ("credits_debited" >= 0),
  ADD CONSTRAINT "booking_credit_membership_consistent" CHECK (
    ("credits_debited" = 0 AND "credit_membership_id" IS NULL)
    OR ("credits_debited" > 0 AND "credit_membership_id" IS NOT NULL)
  );

CREATE INDEX "idx_member_memberships_entitlement_selection"
  ON "member_memberships" ("tenant_id", "member_id", "status", "ends_at");

CREATE UNIQUE INDEX "uq_credit_ledger_booking_reason"
  ON "credit_ledger" ("booking_id", "reason")
  WHERE "booking_id" IS NOT NULL;

CREATE OR REPLACE FUNCTION assert_booking_references_belong_to_tenant() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM schedule_occurrences
    WHERE id = NEW.occurrence_id AND tenant_id = NEW.tenant_id AND branch_id = NEW.branch_id
  ) THEN
    RAISE EXCEPTION 'booking occurrence must belong to tenant and branch';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM members WHERE id = NEW.member_id AND tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'booking member must belong to booking tenant';
  END IF;
  IF NEW.credit_membership_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM member_memberships
    WHERE id = NEW.credit_membership_id
      AND tenant_id = NEW.tenant_id
      AND member_id = NEW.member_id
  ) THEN
    RAISE EXCEPTION 'booking credit membership must belong to booking tenant and member';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER "bookings_tenant_guard" ON "bookings";
CREATE TRIGGER "bookings_tenant_guard"
BEFORE INSERT OR UPDATE OF tenant_id, branch_id, occurrence_id, member_id, credit_membership_id ON bookings
FOR EACH ROW EXECUTE FUNCTION assert_booking_references_belong_to_tenant();
