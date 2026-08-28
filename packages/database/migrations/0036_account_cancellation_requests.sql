CREATE TABLE IF NOT EXISTS "account_cancellation_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "requested_by_user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "status" varchar(30) DEFAULT 'requested' NOT NULL,
  "reason" text,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "idx_account_cancellation_requests_tenant_created" ON "account_cancellation_requests" ("tenant_id", "created_at");
