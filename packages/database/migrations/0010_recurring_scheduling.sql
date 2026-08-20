CREATE TABLE "schedule_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
  "branch_id" uuid NOT NULL REFERENCES "branches"("id") ON DELETE RESTRICT,
  "service_id" uuid NOT NULL REFERENCES "services"("id") ON DELETE RESTRICT,
  "trainer_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "room_id" uuid REFERENCES "rooms"("id") ON DELETE SET NULL,
  "timezone" varchar(80) NOT NULL,
  "days_of_week" integer[] NOT NULL,
  "local_start_time" varchar(5) NOT NULL,
  "duration_minutes" integer NOT NULL,
  "capacity" integer NOT NULL,
  "effective_start_date" date NOT NULL,
  "effective_end_date" date,
  "materialized_through" date,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "schedule_template_days_valid" CHECK (
    cardinality("days_of_week") BETWEEN 1 AND 7
    AND "days_of_week" <@ ARRAY[0,1,2,3,4,5,6]
  ),
  CONSTRAINT "schedule_template_time_valid" CHECK ("local_start_time" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$'),
  CONSTRAINT "schedule_template_duration_valid" CHECK ("duration_minutes" BETWEEN 1 AND 1440),
  CONSTRAINT "schedule_template_capacity_valid" CHECK ("capacity" > 0),
  CONSTRAINT "schedule_template_dates_valid" CHECK (
    "effective_end_date" IS NULL OR "effective_end_date" >= "effective_start_date"
  ),
  CONSTRAINT "schedule_template_materialization_valid" CHECK (
    "materialized_through" IS NULL
    OR (
      "materialized_through" >= "effective_start_date"
      AND ("effective_end_date" IS NULL OR "materialized_through" <= "effective_end_date")
    )
  )
);

CREATE INDEX "idx_schedule_templates_tenant_branch_active"
  ON "schedule_templates" ("tenant_id", "branch_id", "is_active");

ALTER TABLE "schedule_occurrences"
  ADD COLUMN "template_id" uuid REFERENCES "schedule_templates"("id") ON DELETE RESTRICT;
CREATE UNIQUE INDEX "uq_occurrences_template_starts"
  ON "schedule_occurrences" ("template_id", "starts_at")
  WHERE "template_id" IS NOT NULL;

CREATE TABLE "schedule_exceptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
  "template_id" uuid NOT NULL REFERENCES "schedule_templates"("id") ON DELETE RESTRICT,
  "occurrence_id" uuid NOT NULL REFERENCES "schedule_occurrences"("id") ON DELETE RESTRICT,
  "exception_type" varchar(30) NOT NULL,
  "reason" varchar(255) NOT NULL,
  "original_starts_at" timestamptz NOT NULL,
  "created_by_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "schedule_exception_type_valid" CHECK ("exception_type" IN ('cancelled', 'overridden')),
  CONSTRAINT "schedule_exception_reason_nonblank" CHECK (length(trim("reason")) > 0),
  CONSTRAINT "uq_schedule_exceptions_occurrence_type" UNIQUE ("occurrence_id", "exception_type")
);

CREATE INDEX "idx_schedule_exceptions_tenant_template"
  ON "schedule_exceptions" ("tenant_id", "template_id", "created_at");

CREATE FUNCTION assert_schedule_template_references_belong_to_tenant() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM branches WHERE id = NEW.branch_id AND tenant_id = NEW.tenant_id) THEN
    RAISE EXCEPTION 'schedule template branch must belong to the template tenant';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM services
    WHERE id = NEW.service_id AND tenant_id = NEW.tenant_id
      AND (branch_id IS NULL OR branch_id = NEW.branch_id)
  ) THEN
    RAISE EXCEPTION 'schedule template service must belong to the tenant and branch';
  END IF;
  IF NEW.room_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM rooms
    WHERE id = NEW.room_id AND tenant_id = NEW.tenant_id AND branch_id = NEW.branch_id AND is_active
  ) THEN
    RAISE EXCEPTION 'schedule template room must belong to the tenant and branch';
  END IF;
  IF NEW.trainer_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM tenant_users
    WHERE tenant_id = NEW.tenant_id AND user_id = NEW.trainer_user_id AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'schedule template trainer must be active tenant staff';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER schedule_templates_tenant_guard
BEFORE INSERT OR UPDATE OF tenant_id, branch_id, service_id, room_id, trainer_user_id
ON schedule_templates FOR EACH ROW
EXECUTE FUNCTION assert_schedule_template_references_belong_to_tenant();

CREATE OR REPLACE FUNCTION assert_occurrence_references_belong_to_tenant() RETURNS trigger AS $$
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
  IF NEW.template_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM schedule_templates
    WHERE id = NEW.template_id AND tenant_id = NEW.tenant_id AND branch_id = NEW.branch_id
      AND service_id = NEW.service_id
  ) THEN
    RAISE EXCEPTION 'occurrence template must belong to the tenant, branch, and service';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER schedule_occurrences_tenant_guard ON schedule_occurrences;
CREATE TRIGGER schedule_occurrences_tenant_guard
BEFORE INSERT OR UPDATE OF tenant_id, branch_id, service_id, room_id, trainer_user_id, template_id
ON schedule_occurrences FOR EACH ROW
EXECUTE FUNCTION assert_occurrence_references_belong_to_tenant();

CREATE FUNCTION assert_schedule_exception_references_belong_to_tenant() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM schedule_occurrences occurrence
    JOIN schedule_templates template ON template.id = occurrence.template_id
    WHERE occurrence.id = NEW.occurrence_id
      AND occurrence.tenant_id = NEW.tenant_id
      AND template.id = NEW.template_id
      AND template.tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'schedule exception references must belong to one tenant and template';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM tenant_users
    WHERE tenant_id = NEW.tenant_id AND user_id = NEW.created_by_user_id
  ) THEN
    RAISE EXCEPTION 'schedule exception actor must belong to the tenant';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER schedule_exceptions_tenant_guard
BEFORE INSERT OR UPDATE OF tenant_id, template_id, occurrence_id, created_by_user_id
ON schedule_exceptions FOR EACH ROW
EXECUTE FUNCTION assert_schedule_exception_references_belong_to_tenant();
