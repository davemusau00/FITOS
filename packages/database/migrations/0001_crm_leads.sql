CREATE TABLE "leads" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
  "contact_id" uuid NOT NULL REFERENCES "contacts"("id") ON DELETE RESTRICT,
  "branch_id" uuid REFERENCES "branches"("id") ON DELETE SET NULL,
  "owner_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "interest" varchar(255),
  "source" varchar(80),
  "stage" varchar(30) NOT NULL DEFAULT 'new',
  "lost_reason" varchar(255),
  "next_follow_up_at" timestamptz,
  "converted_member_id" uuid REFERENCES "members"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "lead_stage_valid" CHECK ("stage" IN ('new','contacted','trial_booked','trial_completed','offer','joined','lost')),
  CONSTRAINT "lead_lost_reason_consistent" CHECK (("stage" = 'lost') = ("lost_reason" IS NOT NULL))
);
CREATE INDEX "idx_leads_tenant_stage" ON "leads" ("tenant_id", "stage", "created_at");
CREATE INDEX "idx_leads_tenant_branch" ON "leads" ("tenant_id", "branch_id");

CREATE TABLE "lead_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
  "lead_id" uuid NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "actor_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "event_type" varchar(60) NOT NULL,
  "previous_stage" varchar(30),
  "next_stage" varchar(30),
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "idx_lead_events_tenant_lead" ON "lead_events" ("tenant_id", "lead_id", "created_at");

CREATE TABLE "lead_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
  "lead_id" uuid NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "body" text NOT NULL,
  "due_at" timestamptz,
  "assignee_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "completed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "idx_lead_tasks_tenant_lead" ON "lead_tasks" ("tenant_id", "lead_id");

CREATE TABLE "lead_notes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
  "lead_id" uuid NOT NULL REFERENCES "leads"("id") ON DELETE CASCADE,
  "body" text NOT NULL,
  "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "idx_lead_notes_tenant_lead" ON "lead_notes" ("tenant_id", "lead_id", "created_at");

CREATE FUNCTION assert_lead_references_belong_to_tenant() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM contacts WHERE id = NEW.contact_id AND tenant_id = NEW.tenant_id) THEN
    RAISE EXCEPTION 'lead contact must belong to the lead tenant';
  END IF;
  IF NEW.branch_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM branches WHERE id = NEW.branch_id AND tenant_id = NEW.tenant_id) THEN
    RAISE EXCEPTION 'lead branch must belong to the lead tenant';
  END IF;
  IF NEW.converted_member_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM members WHERE id = NEW.converted_member_id AND tenant_id = NEW.tenant_id) THEN
    RAISE EXCEPTION 'converted member must belong to the lead tenant';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER leads_tenant_guard BEFORE INSERT OR UPDATE OF tenant_id, contact_id, branch_id, converted_member_id ON leads
FOR EACH ROW EXECUTE FUNCTION assert_lead_references_belong_to_tenant();

CREATE FUNCTION assert_lead_child_matches_tenant() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM leads WHERE id = NEW.lead_id AND tenant_id = NEW.tenant_id) THEN
    RAISE EXCEPTION 'lead child must belong to the lead tenant';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER lead_events_tenant_guard BEFORE INSERT OR UPDATE OF tenant_id, lead_id ON lead_events
FOR EACH ROW EXECUTE FUNCTION assert_lead_child_matches_tenant();
CREATE TRIGGER lead_tasks_tenant_guard BEFORE INSERT OR UPDATE OF tenant_id, lead_id ON lead_tasks
FOR EACH ROW EXECUTE FUNCTION assert_lead_child_matches_tenant();
CREATE TRIGGER lead_notes_tenant_guard BEFORE INSERT OR UPDATE OF tenant_id, lead_id ON lead_notes
FOR EACH ROW EXECUTE FUNCTION assert_lead_child_matches_tenant();
