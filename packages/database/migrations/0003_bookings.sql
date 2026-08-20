CREATE TABLE "bookings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
  "branch_id" uuid NOT NULL REFERENCES "branches"("id") ON DELETE RESTRICT,
  "occurrence_id" uuid NOT NULL REFERENCES "schedule_occurrences"("id") ON DELETE RESTRICT,
  "member_id" uuid NOT NULL REFERENCES "members"("id") ON DELETE RESTRICT,
  "status" varchar(30) NOT NULL DEFAULT 'confirmed',
  "source" varchar(30) NOT NULL DEFAULT 'staff',
  "booked_at" timestamptz NOT NULL DEFAULT now(),
  "cancelled_at" timestamptz,
  "cancellation_reason" varchar(255),
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "booking_status_valid" CHECK ("status" IN ('confirmed', 'cancelled')),
  CONSTRAINT "booking_source_valid" CHECK ("source" IN ('staff', 'public', 'member_portal')),
  CONSTRAINT "booking_cancellation_consistent" CHECK (("status" = 'cancelled') = ("cancelled_at" IS NOT NULL AND "cancellation_reason" IS NOT NULL))
);
CREATE INDEX "idx_bookings_tenant_occurrence_status" ON "bookings" ("tenant_id", "occurrence_id", "status");
CREATE INDEX "idx_bookings_tenant_member_booked" ON "bookings" ("tenant_id", "member_id", "booked_at");
CREATE UNIQUE INDEX "uq_active_booking_member_occurrence" ON "bookings" ("tenant_id", "occurrence_id", "member_id") WHERE "status" = 'confirmed';

CREATE FUNCTION assert_booking_references_belong_to_tenant() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM schedule_occurrences WHERE id = NEW.occurrence_id AND tenant_id = NEW.tenant_id AND branch_id = NEW.branch_id) THEN
    RAISE EXCEPTION 'booking occurrence must belong to tenant and branch';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM members WHERE id = NEW.member_id AND tenant_id = NEW.tenant_id) THEN
    RAISE EXCEPTION 'booking member must belong to booking tenant';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER bookings_tenant_guard BEFORE INSERT OR UPDATE OF tenant_id, branch_id, occurrence_id, member_id ON bookings
FOR EACH ROW EXECUTE FUNCTION assert_booking_references_belong_to_tenant();
