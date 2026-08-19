import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from "drizzle-orm/pg-core";

/**
 * Foundation schema only. New domain tables are introduced with the vertical
 * slice that owns their invariants; no future schema is pre-created.
 */
export const tenants = pgTable(
  "tenants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    defaultTimezone: varchar("default_timezone", { length: 80 })
      .notNull()
      .default("Africa/Nairobi"),
    defaultCurrency: varchar("default_currency", { length: 3 }).notNull().default("KES"),
    status: varchar("status", { length: 30 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("uq_tenants_slug").on(table.slug)]
);

export const branches = pgTable(
  "branches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 100 }).notNull(),
    timezone: varchar("timezone", { length: 80 }),
    phone: varchar("phone", { length: 40 }),
    email: varchar("email", { length: 255 }),
    addressLine1: varchar("address_line_1", { length: 255 }),
    addressLine2: varchar("address_line_2", { length: 255 }),
    city: varchar("city", { length: 120 }),
    countryCode: varchar("country_code", { length: 2 }).notNull().default("KE"),
    latitude: varchar("latitude", { length: 16 }),
    longitude: varchar("longitude", { length: 16 }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("uq_branches_tenant_slug").on(table.tenantId, table.slug),
    index("idx_branches_tenant_active").on(table.tenantId, table.isActive)
  ]
);

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }),
    phoneE164: varchar("phone_e164", { length: 30 }),
    passwordHash: text("password_hash").notNull(),
    displayName: varchar("display_name", { length: 160 }).notNull(),
    status: varchar("status", { length: 30 }).notNull().default("active"),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("idx_users_email").on(table.email)]
);

export const roles = pgTable(
  "roles",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    systemKey: varchar("system_key", { length: 80 }),
    isSystem: boolean("is_system").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("uq_roles_tenant_name").on(table.tenantId, table.name),
    index("idx_roles_tenant").on(table.tenantId)
  ]
);

export const permissions = pgTable("permissions", {
  key: varchar("key", { length: 100 }).primaryKey(),
  description: varchar("description", { length: 255 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
});

export const rolePermissions = pgTable(
  "role_permissions",
  {
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "cascade" }),
    permissionKey: varchar("permission_key", { length: 100 })
      .notNull()
      .references(() => permissions.key, { onDelete: "cascade" })
  },
  (table) => [primaryKey({ columns: [table.roleId, table.permissionKey] })]
);

export const tenantUsers = pgTable(
  "tenant_users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    roleId: uuid("role_id")
      .notNull()
      .references(() => roles.id, { onDelete: "restrict" }),
    status: varchar("status", { length: 30 }).notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("uq_tenant_users_tenant_user").on(table.tenantId, table.userId),
    index("idx_tenant_users_tenant_status").on(table.tenantId, table.status)
  ]
);

export const userBranchAccess = pgTable(
  "user_branch_access",
  {
    tenantUserId: uuid("tenant_user_id")
      .notNull()
      .references(() => tenantUsers.id, { onDelete: "cascade" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "cascade" })
  },
  (table) => [primaryKey({ columns: [table.tenantUserId, table.branchId] })]
);

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tenantUserId: uuid("tenant_user_id")
      .notNull()
      .references(() => tenantUsers.id, { onDelete: "cascade" }),
    sessionTokenHash: text("session_token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    ipHash: varchar("ip_hash", { length: 128 }),
    userAgentSummary: varchar("user_agent_summary", { length: 255 }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("uq_sessions_token_hash").on(table.sessionTokenHash),
    index("idx_sessions_user_active").on(table.userId, table.expiresAt),
    index("idx_sessions_tenant_user_active").on(table.tenantUserId, table.expiresAt)
  ]
);

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    firstName: varchar("first_name", { length: 120 }).notNull(),
    lastName: varchar("last_name", { length: 120 }),
    phoneRaw: varchar("phone_raw", { length: 60 }),
    phoneE164: varchar("phone_e164", { length: 30 }),
    email: varchar("email", { length: 255 }),
    dateOfBirth: date("date_of_birth"),
    preferredBranchId: uuid("preferred_branch_id").references(() => branches.id, {
      onDelete: "set null"
    }),
    source: varchar("source", { length: 80 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("idx_contacts_tenant_phone").on(table.tenantId, table.phoneE164),
    index("idx_contacts_tenant_name").on(table.tenantId, table.firstName, table.lastName)
  ]
);

export const members = pgTable(
  "members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "restrict" }),
    homeBranchId: uuid("home_branch_id").references(() => branches.id, { onDelete: "set null" }),
    memberNumber: varchar("member_number", { length: 60 }),
    status: varchar("status", { length: 30 }).notNull().default("active"),
    joinedAt: timestamp("joined_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("uq_members_tenant_number").on(table.tenantId, table.memberNumber),
    index("idx_members_tenant_branch_status").on(table.tenantId, table.homeBranchId, table.status)
  ]
);

export const auditEvents = pgTable(
  "audit_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    action: varchar("action", { length: 120 }).notNull(),
    resourceType: varchar("resource_type", { length: 80 }).notNull(),
    resourceId: uuid("resource_id"),
    beforeSummary: jsonb("before_summary"),
    afterSummary: jsonb("after_summary"),
    requestId: varchar("request_id", { length: 120 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("idx_audit_events_tenant_created").on(table.tenantId, table.createdAt)]
);

export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    operation: varchar("operation", { length: 120 }).notNull(),
    key: varchar("key", { length: 160 }).notNull(),
    requestFingerprint: varchar("request_fingerprint", { length: 128 }),
    responseStatus: integer("response_status"),
    responseBody: jsonb("response_body"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("uq_idempotency_keys_tenant_operation_key").on(
      table.tenantId,
      table.operation,
      table.key
    ),
    index("idx_idempotency_keys_expires").on(table.expiresAt)
  ]
);

/** Shared type used by API repositories; tenant id is never an optional filter. */
export interface TenantScope {
  tenantId: string;
  branchIds: readonly string[];
}

export interface Money {
  /** String prevents JavaScript precision loss across JSON boundaries. */
  amountMinor: string;
  currency: string;
}

export const schema = {
  tenants,
  branches,
  users,
  roles,
  permissions,
  rolePermissions,
  tenantUsers,
  userBranchAccess,
  sessions,
  contacts,
  members,
  auditEvents,
  idempotencyKeys
};

export type DatabaseSchema = typeof schema;
