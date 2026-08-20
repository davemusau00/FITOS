-- Migration: 0005_payments.sql
-- Phase 3: Payment Transactions

CREATE TABLE IF NOT EXISTS "payment_transactions" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id"           uuid NOT NULL REFERENCES "tenants"("id") ON DELETE RESTRICT,
  "branch_id"           uuid NOT NULL REFERENCES "branches"("id") ON DELETE RESTRICT,
  "member_id"           uuid REFERENCES "members"("id") ON DELETE SET NULL,
  "amount_minor"        varchar(20) NOT NULL,
  "currency"            varchar(3) NOT NULL,
  "method"              varchar(40) NOT NULL,
  "reference"           varchar(255),
  "provider_ref"        varchar(255),
  "status"              varchar(30) NOT NULL DEFAULT 'completed',
  "note"                text,
  "allocation_type"     varchar(40),
  "allocation_id"       uuid,
  "recorded_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "recorded_at"         timestamp with time zone NOT NULL DEFAULT now(),
  "created_at"          timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"          timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_payment_transactions_tenant_branch"
  ON "payment_transactions"("tenant_id", "branch_id");
CREATE INDEX IF NOT EXISTS "idx_payment_transactions_member"
  ON "payment_transactions"("member_id");
CREATE INDEX IF NOT EXISTS "idx_payment_transactions_status"
  ON "payment_transactions"("status");
