ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "is_platform_admin" boolean NOT NULL DEFAULT false;
