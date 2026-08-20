-- Forward-only hardening of the internal payment ledger and reconciliation path.

ALTER TABLE "payment_transactions"
  ADD CONSTRAINT "payment_amount_positive"
    CHECK ("amount_minor" ~ '^[0-9]+$' AND "amount_minor"::numeric > 0),
  ADD CONSTRAINT "payment_currency_valid"
    CHECK ("currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "payment_method_valid"
    CHECK ("method" IN ('cash', 'bank_transfer', 'mpesa', 'card', 'other')),
  ADD CONSTRAINT "payment_status_valid"
    CHECK ("status" IN ('pending', 'completed', 'refunded', 'voided')),
  ADD CONSTRAINT "payment_allocation_valid" CHECK (
    (
      ("allocation_type" IS NULL AND "allocation_id" IS NULL)
      OR ("allocation_type" IN ('membership', 'booking') AND "allocation_id" IS NOT NULL)
      OR ("allocation_type" IN ('walkIn', 'other') AND "allocation_id" IS NULL)
    )
    AND ("allocation_type" IS NULL OR "member_id" IS NOT NULL)
  );

CREATE INDEX "idx_payment_transactions_tenant_branch_status_recorded"
  ON "payment_transactions" ("tenant_id", "branch_id", "status", "recorded_at" DESC);
CREATE INDEX "idx_payment_transactions_tenant_member_recorded"
  ON "payment_transactions" ("tenant_id", "member_id", "recorded_at" DESC);
CREATE UNIQUE INDEX "uq_payment_provider_reference"
  ON "payment_transactions" ("tenant_id", "method", "provider_ref")
  WHERE "provider_ref" IS NOT NULL;

CREATE FUNCTION assert_payment_references_belong_to_tenant() RETURNS trigger AS $$
DECLARE
  membership_branch uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM branches
    WHERE id = NEW.branch_id AND tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'payment branch must belong to tenant';
  END IF;
  IF NEW.member_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM members
    WHERE id = NEW.member_id AND tenant_id = NEW.tenant_id
  ) THEN
    RAISE EXCEPTION 'payment member must belong to tenant';
  END IF;
  IF NEW.recorded_by_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM tenant_users
    WHERE tenant_id = NEW.tenant_id
      AND user_id = NEW.recorded_by_user_id
      AND status = 'active'
  ) THEN
    RAISE EXCEPTION 'payment actor must be active in tenant';
  END IF;
  IF NEW.allocation_type = 'booking' AND NOT EXISTS (
    SELECT 1 FROM bookings
    WHERE id = NEW.allocation_id
      AND tenant_id = NEW.tenant_id
      AND branch_id = NEW.branch_id
      AND member_id = NEW.member_id
  ) THEN
    RAISE EXCEPTION 'payment booking allocation must belong to tenant, branch, and member';
  END IF;
  IF NEW.allocation_type = 'membership' THEN
    SELECT NULLIF(plan_snapshot->>'branchId', '')::uuid
      INTO membership_branch
      FROM member_memberships
      WHERE id = NEW.allocation_id
        AND tenant_id = NEW.tenant_id
        AND member_id = NEW.member_id;
    IF NOT FOUND OR (membership_branch IS NOT NULL AND membership_branch <> NEW.branch_id) THEN
      RAISE EXCEPTION 'payment membership allocation must belong to tenant, branch, and member';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "payment_transactions_tenant_guard"
BEFORE INSERT OR UPDATE OF tenant_id, branch_id, member_id, allocation_type, allocation_id, recorded_by_user_id
ON "payment_transactions"
FOR EACH ROW EXECUTE FUNCTION assert_payment_references_belong_to_tenant();

CREATE FUNCTION protect_payment_ledger_history() RETURNS trigger AS $$
BEGIN
  IF NEW.tenant_id <> OLD.tenant_id
    OR NEW.branch_id <> OLD.branch_id
    OR NEW.amount_minor <> OLD.amount_minor
    OR NEW.currency <> OLD.currency
    OR NEW.method <> OLD.method
    OR NEW.reference IS DISTINCT FROM OLD.reference
    OR NEW.provider_ref IS DISTINCT FROM OLD.provider_ref
    OR NEW.recorded_by_user_id IS DISTINCT FROM OLD.recorded_by_user_id
    OR NEW.recorded_at <> OLD.recorded_at
  THEN
    RAISE EXCEPTION 'payment financial history is immutable';
  END IF;

  IF (OLD.member_id IS NOT NULL AND NEW.member_id IS DISTINCT FROM OLD.member_id)
    OR (OLD.allocation_type IS NOT NULL AND NEW.allocation_type IS DISTINCT FROM OLD.allocation_type)
    OR (OLD.allocation_id IS NOT NULL AND NEW.allocation_id IS DISTINCT FROM OLD.allocation_id)
  THEN
    RAISE EXCEPTION 'payment reconciliation cannot be reassigned';
  END IF;

  IF NEW.status <> OLD.status AND NOT (
    (OLD.status = 'pending' AND NEW.status IN ('completed', 'voided'))
    OR (OLD.status = 'completed' AND NEW.status IN ('refunded', 'voided'))
  ) THEN
    RAISE EXCEPTION 'illegal payment status transition from % to %', OLD.status, NEW.status;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "payment_transactions_history_guard"
BEFORE UPDATE ON "payment_transactions"
FOR EACH ROW EXECUTE FUNCTION protect_payment_ledger_history();
