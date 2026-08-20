CREATE TABLE "membership_plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
  "branch_id" uuid REFERENCES "branches"("id") ON DELETE SET NULL,
  "name" varchar(160) NOT NULL,
  "slug" varchar(120) NOT NULL,
  "amount_minor" bigint,
  "currency" varchar(3),
  "duration_days" integer,
  "included_credits" integer NOT NULL DEFAULT 0,
  "public_visible" boolean NOT NULL DEFAULT false,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "membership_plan_price_complete" CHECK (("amount_minor" IS NULL) = ("currency" IS NULL)),
  CONSTRAINT "membership_plan_price_nonnegative" CHECK ("amount_minor" IS NULL OR "amount_minor" >= 0),
  CONSTRAINT "membership_plan_duration_positive" CHECK ("duration_days" IS NULL OR "duration_days" > 0),
  CONSTRAINT "membership_plan_credits_nonnegative" CHECK ("included_credits" >= 0)
);
CREATE UNIQUE INDEX "uq_membership_plans_tenant_branch_slug" ON "membership_plans" ("tenant_id", COALESCE("branch_id", '00000000-0000-0000-0000-000000000000'::uuid), "slug");
CREATE INDEX "idx_membership_plans_tenant_active" ON "membership_plans" ("tenant_id", "is_active");

CREATE TABLE "member_memberships" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
  "member_id" uuid NOT NULL REFERENCES "members"("id") ON DELETE RESTRICT,
  "plan_id" uuid REFERENCES "membership_plans"("id") ON DELETE SET NULL,
  "plan_snapshot" jsonb NOT NULL,
  "status" varchar(30) NOT NULL DEFAULT 'active',
  "starts_at" timestamptz NOT NULL,
  "ends_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "member_membership_status_valid" CHECK ("status" IN ('scheduled', 'active', 'paused', 'expired', 'cancelled', 'exhausted')),
  CONSTRAINT "member_membership_period_valid" CHECK ("ends_at" IS NULL OR "ends_at" > "starts_at")
);
CREATE INDEX "idx_member_memberships_tenant_member_status" ON "member_memberships" ("tenant_id", "member_id", "status");

CREATE TABLE "credit_ledger" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
  "membership_id" uuid NOT NULL REFERENCES "member_memberships"("id") ON DELETE RESTRICT,
  "member_id" uuid NOT NULL REFERENCES "members"("id") ON DELETE RESTRICT,
  "delta" integer NOT NULL,
  "reason" varchar(30) NOT NULL,
  "booking_id" uuid REFERENCES "bookings"("id") ON DELETE RESTRICT,
  "note" varchar(255),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "credit_ledger_delta_nonzero" CHECK ("delta" <> 0),
  CONSTRAINT "credit_ledger_reason_valid" CHECK ("reason" IN ('purchase', 'booking', 'cancellation', 'manual_adjustment', 'expiry'))
);
CREATE INDEX "idx_credit_ledger_tenant_membership_created" ON "credit_ledger" ("tenant_id", "membership_id", "created_at");
CREATE UNIQUE INDEX "uq_credit_ledger_booking_consumption" ON "credit_ledger" ("booking_id") WHERE "booking_id" IS NOT NULL AND "reason" = 'booking';

CREATE FUNCTION assert_membership_references_belong_to_tenant() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM members WHERE id = NEW.member_id AND tenant_id = NEW.tenant_id) THEN
    RAISE EXCEPTION 'membership member must belong to tenant';
  END IF;
  IF NEW.plan_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM membership_plans WHERE id = NEW.plan_id AND tenant_id = NEW.tenant_id) THEN
    RAISE EXCEPTION 'membership plan must belong to tenant';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER member_memberships_tenant_guard BEFORE INSERT OR UPDATE OF tenant_id, member_id, plan_id ON member_memberships
FOR EACH ROW EXECUTE FUNCTION assert_membership_references_belong_to_tenant();

CREATE FUNCTION assert_credit_ledger_references_belong_to_tenant() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM member_memberships WHERE id = NEW.membership_id AND tenant_id = NEW.tenant_id AND member_id = NEW.member_id) THEN
    RAISE EXCEPTION 'credit ledger membership must belong to tenant and member';
  END IF;
  IF NEW.booking_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM bookings WHERE id = NEW.booking_id AND tenant_id = NEW.tenant_id AND member_id = NEW.member_id) THEN
    RAISE EXCEPTION 'credit ledger booking must belong to tenant and member';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER credit_ledger_tenant_guard BEFORE INSERT ON credit_ledger
FOR EACH ROW EXECUTE FUNCTION assert_credit_ledger_references_belong_to_tenant();

CREATE FUNCTION prevent_credit_ledger_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'credit ledger is append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER credit_ledger_append_only BEFORE UPDATE OR DELETE ON credit_ledger
FOR EACH ROW EXECUTE FUNCTION prevent_credit_ledger_mutation();
