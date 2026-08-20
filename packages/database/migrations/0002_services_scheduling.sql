CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE "services" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
  "branch_id" uuid REFERENCES "branches"("id") ON DELETE SET NULL,
  "name" varchar(160) NOT NULL,
  "slug" varchar(120) NOT NULL,
  "service_type" varchar(30) NOT NULL,
  "duration_minutes" integer NOT NULL,
  "default_capacity" integer,
  "amount_minor" bigint,
  "currency" varchar(3),
  "public_visible" boolean NOT NULL DEFAULT false,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "service_type_valid" CHECK ("service_type" IN ('class', 'appointment', 'facility', 'access')),
  CONSTRAINT "service_duration_positive" CHECK ("duration_minutes" > 0),
  CONSTRAINT "service_capacity_positive" CHECK ("default_capacity" IS NULL OR "default_capacity" > 0),
  CONSTRAINT "service_price_complete" CHECK (("amount_minor" IS NULL) = ("currency" IS NULL)),
  CONSTRAINT "service_price_nonnegative" CHECK ("amount_minor" IS NULL OR "amount_minor" >= 0)
);
CREATE UNIQUE INDEX "uq_services_tenant_branch_slug" ON "services" ("tenant_id", COALESCE("branch_id", '00000000-0000-0000-0000-000000000000'::uuid), "slug");
CREATE INDEX "idx_services_tenant_branch_active" ON "services" ("tenant_id", "branch_id", "is_active");

CREATE TABLE "rooms" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
  "branch_id" uuid NOT NULL REFERENCES "branches"("id") ON DELETE RESTRICT,
  "name" varchar(120) NOT NULL,
  "capacity" integer,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "room_capacity_positive" CHECK ("capacity" IS NULL OR "capacity" > 0),
  CONSTRAINT "uq_rooms_tenant_branch_name" UNIQUE ("tenant_id", "branch_id", "name")
);
CREATE INDEX "idx_rooms_tenant_branch_active" ON "rooms" ("tenant_id", "branch_id", "is_active");

CREATE TABLE "schedule_occurrences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
  "branch_id" uuid NOT NULL REFERENCES "branches"("id") ON DELETE RESTRICT,
  "service_id" uuid NOT NULL REFERENCES "services"("id") ON DELETE RESTRICT,
  "trainer_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "room_id" uuid REFERENCES "rooms"("id") ON DELETE SET NULL,
  "starts_at" timestamptz NOT NULL,
  "ends_at" timestamptz NOT NULL,
  "capacity" integer NOT NULL,
  "status" varchar(30) NOT NULL DEFAULT 'scheduled',
  "cancellation_reason" varchar(255),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "occurrence_period_valid" CHECK ("ends_at" > "starts_at"),
  CONSTRAINT "occurrence_capacity_positive" CHECK ("capacity" > 0),
  CONSTRAINT "occurrence_status_valid" CHECK ("status" IN ('scheduled', 'cancelled')),
  CONSTRAINT "occurrence_cancellation_reason_consistent" CHECK (("status" = 'cancelled') = ("cancellation_reason" IS NOT NULL))
);
CREATE INDEX "idx_occurrences_tenant_branch_starts" ON "schedule_occurrences" ("tenant_id", "branch_id", "starts_at");
CREATE INDEX "idx_occurrences_tenant_service_starts" ON "schedule_occurrences" ("tenant_id", "service_id", "starts_at");
ALTER TABLE "schedule_occurrences" ADD CONSTRAINT "occurrence_room_no_collision"
  EXCLUDE USING gist ("tenant_id" WITH =, "room_id" WITH =, tstzrange("starts_at", "ends_at", '[)') WITH &&)
  WHERE ("status" = 'scheduled' AND "room_id" IS NOT NULL);
ALTER TABLE "schedule_occurrences" ADD CONSTRAINT "occurrence_trainer_no_collision"
  EXCLUDE USING gist ("tenant_id" WITH =, "trainer_user_id" WITH =, tstzrange("starts_at", "ends_at", '[)') WITH &&)
  WHERE ("status" = 'scheduled' AND "trainer_user_id" IS NOT NULL);

CREATE FUNCTION assert_service_references_belong_to_tenant() RETURNS trigger AS $$
BEGIN
  IF NEW.branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM branches WHERE id = NEW.branch_id AND tenant_id = NEW.tenant_id) THEN
    RAISE EXCEPTION 'service branch must belong to the service tenant';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER services_tenant_guard BEFORE INSERT OR UPDATE OF tenant_id, branch_id ON services
FOR EACH ROW EXECUTE FUNCTION assert_service_references_belong_to_tenant();

CREATE FUNCTION assert_room_references_belong_to_tenant() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM branches WHERE id = NEW.branch_id AND tenant_id = NEW.tenant_id) THEN
    RAISE EXCEPTION 'room branch must belong to the room tenant';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER rooms_tenant_guard BEFORE INSERT OR UPDATE OF tenant_id, branch_id ON rooms
FOR EACH ROW EXECUTE FUNCTION assert_room_references_belong_to_tenant();

CREATE FUNCTION assert_occurrence_references_belong_to_tenant() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM branches WHERE id = NEW.branch_id AND tenant_id = NEW.tenant_id) THEN
    RAISE EXCEPTION 'occurrence branch must belong to the occurrence tenant';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM services WHERE id = NEW.service_id AND tenant_id = NEW.tenant_id AND (branch_id IS NULL OR branch_id = NEW.branch_id)) THEN
    RAISE EXCEPTION 'occurrence service must belong to the tenant and branch';
  END IF;
  IF NEW.room_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM rooms WHERE id = NEW.room_id AND tenant_id = NEW.tenant_id AND branch_id = NEW.branch_id) THEN
    RAISE EXCEPTION 'occurrence room must belong to the tenant and branch';
  END IF;
  IF NEW.trainer_user_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM tenant_users WHERE tenant_id = NEW.tenant_id AND user_id = NEW.trainer_user_id AND status = 'active') THEN
    RAISE EXCEPTION 'occurrence trainer must be active tenant staff';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER schedule_occurrences_tenant_guard BEFORE INSERT OR UPDATE OF tenant_id, branch_id, service_id, room_id, trainer_user_id ON schedule_occurrences
FOR EACH ROW EXECUTE FUNCTION assert_occurrence_references_belong_to_tenant();
