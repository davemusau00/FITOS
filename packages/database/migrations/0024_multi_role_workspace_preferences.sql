CREATE TABLE IF NOT EXISTS "tenant_user_roles" (
  "tenant_user_id" uuid NOT NULL REFERENCES "tenant_users"("id") ON DELETE CASCADE,
  "role_id" uuid NOT NULL REFERENCES "roles"("id") ON DELETE RESTRICT,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "tenant_user_roles_pkey" PRIMARY KEY ("tenant_user_id", "role_id")
);

INSERT INTO "tenant_user_roles" ("tenant_user_id", "role_id")
SELECT "id", "role_id" FROM "tenant_users"
ON CONFLICT ("tenant_user_id", "role_id") DO NOTHING;

CREATE TABLE IF NOT EXISTS "user_workspace_preferences" (
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "tenant_id" uuid NOT NULL REFERENCES "tenants"("id") ON DELETE CASCADE,
  "workspace" varchar(30) NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT "user_workspace_preferences_pkey" PRIMARY KEY ("user_id", "tenant_id")
);

ALTER TABLE "tenant_user_roles"
  ADD CONSTRAINT "tenant_user_roles_tenant_guard"
  CHECK ("tenant_user_id" IS NOT NULL AND "role_id" IS NOT NULL);
