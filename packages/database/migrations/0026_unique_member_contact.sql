CREATE UNIQUE INDEX IF NOT EXISTS "uq_members_tenant_contact" ON "members" ("tenant_id", "contact_id");
