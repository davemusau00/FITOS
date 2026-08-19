CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE "tenants" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" varchar(160) NOT NULL,
  "slug" varchar(100) NOT NULL,
  "default_timezone" varchar(80) DEFAULT 'Africa/Nairobi' NOT NULL,
  "default_currency" varchar(3) DEFAULT 'KES' NOT NULL,
  "status" varchar(30) DEFAULT 'active' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE UNIQUE INDEX "uq_tenants_slug" ON "tenants" USING btree ("slug");

CREATE TABLE "branches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "name" varchar(160) NOT NULL,
  "slug" varchar(100) NOT NULL,
  "timezone" varchar(80),
  "phone" varchar(40),
  "email" varchar(255),
  "address_line_1" varchar(255),
  "address_line_2" varchar(255),
  "city" varchar(120),
  "country_code" varchar(2) DEFAULT 'KE' NOT NULL,
  "latitude" varchar(16),
  "longitude" varchar(16),
  "is_active" boolean DEFAULT true NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "branches_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "uq_branches_tenant_slug" ON "branches" USING btree ("tenant_id", "slug");
CREATE INDEX "idx_branches_tenant_active" ON "branches" USING btree ("tenant_id", "is_active");

CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" varchar(255),
  "phone_e164" varchar(30),
  "password_hash" text NOT NULL,
  "display_name" varchar(160) NOT NULL,
  "status" varchar(30) DEFAULT 'active' NOT NULL,
  "last_login_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX "idx_users_email" ON "users" USING btree ("email");

CREATE TABLE "roles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid,
  "name" varchar(80) NOT NULL,
  "system_key" varchar(80),
  "is_system" boolean DEFAULT false NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "roles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "uq_roles_tenant_name" ON "roles" USING btree ("tenant_id", "name");
CREATE INDEX "idx_roles_tenant" ON "roles" USING btree ("tenant_id");

CREATE TABLE "permissions" (
  "key" varchar(100) PRIMARY KEY NOT NULL,
  "description" varchar(255) NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE "role_permissions" (
  "role_id" uuid NOT NULL,
  "permission_key" varchar(100) NOT NULL,
  CONSTRAINT "role_permissions_role_id_permission_key_pk" PRIMARY KEY("role_id","permission_key"),
  CONSTRAINT "role_permissions_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE,
  CONSTRAINT "role_permissions_permission_key_permissions_key_fk" FOREIGN KEY ("permission_key") REFERENCES "permissions"("key") ON DELETE CASCADE
);

CREATE TABLE "tenant_users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role_id" uuid NOT NULL,
  "status" varchar(30) DEFAULT 'active' NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "tenant_users_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE,
  CONSTRAINT "tenant_users_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT,
  CONSTRAINT "tenant_users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE RESTRICT
);
CREATE UNIQUE INDEX "uq_tenant_users_tenant_user" ON "tenant_users" USING btree ("tenant_id", "user_id");
CREATE INDEX "idx_tenant_users_tenant_status" ON "tenant_users" USING btree ("tenant_id", "status");

CREATE TABLE "user_branch_access" (
  "tenant_user_id" uuid NOT NULL,
  "branch_id" uuid NOT NULL,
  CONSTRAINT "user_branch_access_tenant_user_id_branch_id_pk" PRIMARY KEY("tenant_user_id","branch_id"),
  CONSTRAINT "user_branch_access_tenant_user_id_tenant_users_id_fk" FOREIGN KEY ("tenant_user_id") REFERENCES "tenant_users"("id") ON DELETE CASCADE,
  CONSTRAINT "user_branch_access_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE CASCADE
);

CREATE TABLE "sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "tenant_user_id" uuid NOT NULL,
  "session_token_hash" text NOT NULL,
  "expires_at" timestamptz NOT NULL,
  "last_seen_at" timestamptz,
  "ip_hash" varchar(128),
  "user_agent_summary" varchar(255),
  "revoked_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "sessions_tenant_user_id_tenant_users_id_fk" FOREIGN KEY ("tenant_user_id") REFERENCES "tenant_users"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "uq_sessions_token_hash" ON "sessions" USING btree ("session_token_hash");
CREATE INDEX "idx_sessions_user_active" ON "sessions" USING btree ("user_id", "expires_at");
CREATE INDEX "idx_sessions_tenant_user_active" ON "sessions" USING btree ("tenant_user_id", "expires_at");

CREATE TABLE "contacts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "first_name" varchar(120) NOT NULL,
  "last_name" varchar(120),
  "phone_raw" varchar(60),
  "phone_e164" varchar(30),
  "email" varchar(255),
  "date_of_birth" date,
  "preferred_branch_id" uuid,
  "source" varchar(80),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "contacts_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
  CONSTRAINT "contacts_preferred_branch_id_branches_id_fk" FOREIGN KEY ("preferred_branch_id") REFERENCES "branches"("id") ON DELETE SET NULL
);
CREATE INDEX "idx_contacts_tenant_phone" ON "contacts" USING btree ("tenant_id", "phone_e164");
CREATE INDEX "idx_contacts_tenant_name" ON "contacts" USING btree ("tenant_id", "first_name", "last_name");

CREATE TABLE "members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "contact_id" uuid NOT NULL,
  "home_branch_id" uuid,
  "member_number" varchar(60),
  "status" varchar(30) DEFAULT 'active' NOT NULL,
  "joined_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "members_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
  CONSTRAINT "members_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "contacts"("id") ON DELETE RESTRICT,
  CONSTRAINT "members_home_branch_id_branches_id_fk" FOREIGN KEY ("home_branch_id") REFERENCES "branches"("id") ON DELETE SET NULL
);
CREATE UNIQUE INDEX "uq_members_tenant_number" ON "members" USING btree ("tenant_id", "member_number");
CREATE INDEX "idx_members_tenant_branch_status" ON "members" USING btree ("tenant_id", "home_branch_id", "status");

CREATE TABLE "audit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "branch_id" uuid,
  "actor_user_id" uuid,
  "action" varchar(120) NOT NULL,
  "resource_type" varchar(80) NOT NULL,
  "resource_id" uuid,
  "before_summary" jsonb,
  "after_summary" jsonb,
  "request_id" varchar(120),
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "audit_events_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT,
  CONSTRAINT "audit_events_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE SET NULL,
  CONSTRAINT "audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL
);
CREATE INDEX "idx_audit_events_tenant_created" ON "audit_events" USING btree ("tenant_id", "created_at" DESC);

CREATE TABLE "idempotency_keys" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id" uuid NOT NULL,
  "operation" varchar(120) NOT NULL,
  "key" varchar(160) NOT NULL,
  "request_fingerprint" varchar(128),
  "response_status" integer,
  "response_body" jsonb,
  "expires_at" timestamptz NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT "idempotency_keys_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "uq_idempotency_keys_tenant_operation_key" ON "idempotency_keys" USING btree ("tenant_id", "operation", "key");
CREATE INDEX "idx_idempotency_keys_expires" ON "idempotency_keys" USING btree ("expires_at");
