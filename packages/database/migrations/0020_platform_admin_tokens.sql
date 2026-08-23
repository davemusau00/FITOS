CREATE TABLE IF NOT EXISTS "platform_admin_tokens" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "revoked_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "uq_platform_admin_tokens_hash" UNIQUE ("token_hash")
);
CREATE INDEX IF NOT EXISTS "idx_platform_admin_tokens_user" ON "platform_admin_tokens" ("user_id");
