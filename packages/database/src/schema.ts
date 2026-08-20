import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
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
    latitude: numeric("latitude", { precision: 9, scale: 6 }),
    longitude: numeric("longitude", { precision: 9, scale: 6 }),
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

export const leads = pgTable(
  "leads",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
    ownerUserId: uuid("owner_user_id").references(() => users.id, { onDelete: "set null" }),
    interest: varchar("interest", { length: 255 }),
    source: varchar("source", { length: 80 }),
    stage: varchar("stage", { length: 30 }).notNull().default("new"),
    lostReason: varchar("lost_reason", { length: 255 }),
    nextFollowUpAt: timestamp("next_follow_up_at", { withTimezone: true }),
    convertedMemberId: uuid("converted_member_id").references(() => members.id, {
      onDelete: "set null"
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("idx_leads_tenant_stage").on(table.tenantId, table.stage, table.createdAt),
    index("idx_leads_tenant_branch").on(table.tenantId, table.branchId)
  ]
);

export const leadEvents = pgTable(
  "lead_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    eventType: varchar("event_type", { length: 60 }).notNull(),
    previousStage: varchar("previous_stage", { length: 30 }),
    nextStage: varchar("next_stage", { length: 30 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("idx_lead_events_tenant_lead").on(table.tenantId, table.leadId, table.createdAt)
  ]
);

export const leadTasks = pgTable(
  "lead_tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    dueAt: timestamp("due_at", { withTimezone: true }),
    assigneeUserId: uuid("assignee_user_id").references(() => users.id, { onDelete: "set null" }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("idx_lead_tasks_tenant_lead").on(table.tenantId, table.leadId)]
);

export const leadNotes = pgTable(
  "lead_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => leads.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("idx_lead_notes_tenant_lead").on(table.tenantId, table.leadId, table.createdAt)]
);

export const services = pgTable(
  "services",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    serviceType: varchar("service_type", { length: 30 }).notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    defaultCapacity: integer("default_capacity"),
    creditsRequired: integer("credits_required").notNull().default(0),
    cancellationCutoffMinutes: integer("cancellation_cutoff_minutes").notNull().default(0),
    restoreCreditOnLateCancel: boolean("restore_credit_on_late_cancel").notNull().default(false),
    amountMinor: text("amount_minor"),
    currency: varchar("currency", { length: 3 }),
    publicVisible: boolean("public_visible").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("uq_services_tenant_branch_slug").on(table.tenantId, table.branchId, table.slug),
    index("idx_services_tenant_branch_active").on(table.tenantId, table.branchId, table.isActive)
  ]
);

export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 120 }).notNull(),
    capacity: integer("capacity"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("uq_rooms_tenant_branch_name").on(table.tenantId, table.branchId, table.name),
    index("idx_rooms_tenant_branch_active").on(table.tenantId, table.branchId, table.isActive)
  ]
);

export const scheduleOccurrences = pgTable(
  "schedule_occurrences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "restrict" }),
    trainerUserId: uuid("trainer_user_id").references(() => users.id, { onDelete: "set null" }),
    roomId: uuid("room_id").references(() => rooms.id, { onDelete: "set null" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    capacity: integer("capacity").notNull(),
    status: varchar("status", { length: 30 }).notNull().default("scheduled"),
    cancellationReason: varchar("cancellation_reason", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("idx_occurrences_tenant_branch_starts").on(
      table.tenantId,
      table.branchId,
      table.startsAt
    ),
    index("idx_occurrences_tenant_service_starts").on(
      table.tenantId,
      table.serviceId,
      table.startsAt
    )
  ]
);

export const bookings = pgTable(
  "bookings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    occurrenceId: uuid("occurrence_id")
      .notNull()
      .references(() => scheduleOccurrences.id, { onDelete: "restrict" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    status: varchar("status", { length: 30 }).notNull().default("confirmed"),
    source: varchar("source", { length: 30 }).notNull().default("staff"),
    bookedAt: timestamp("booked_at", { withTimezone: true }).notNull().defaultNow(),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancellationReason: varchar("cancellation_reason", { length: 255 }),
    // The forward migration adds the FK; keeping this as a UUID avoids a schema declaration cycle.
    creditMembershipId: uuid("credit_membership_id"),
    creditsDebited: integer("credits_debited").notNull().default(0),
    entitlementOverrideReason: varchar("entitlement_override_reason", { length: 255 }),
    lateCancelled: boolean("late_cancelled").notNull().default(false),
    createdByUserId: uuid("created_by_user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("idx_bookings_tenant_occurrence_status").on(
      table.tenantId,
      table.occurrenceId,
      table.status
    ),
    index("idx_bookings_tenant_member_booked").on(table.tenantId, table.memberId, table.bookedAt)
  ]
);

export const membershipPlans = pgTable(
  "membership_plans",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 120 }).notNull(),
    amountMinor: text("amount_minor"),
    currency: varchar("currency", { length: 3 }),
    durationDays: integer("duration_days"),
    includedCredits: integer("included_credits").notNull().default(0),
    publicVisible: boolean("public_visible").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [index("idx_membership_plans_tenant_active").on(table.tenantId, table.isActive)]
);

export const memberMemberships = pgTable(
  "member_memberships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    planId: uuid("plan_id").references(() => membershipPlans.id, { onDelete: "set null" }),
    planSnapshot: jsonb("plan_snapshot").notNull(),
    status: varchar("status", { length: 30 }).notNull().default("active"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("idx_member_memberships_tenant_member_status").on(
      table.tenantId,
      table.memberId,
      table.status
    )
  ]
);

export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    membershipId: uuid("membership_id")
      .notNull()
      .references(() => memberMemberships.id, { onDelete: "restrict" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    delta: integer("delta").notNull(),
    reason: varchar("reason", { length: 30 }).notNull(),
    bookingId: uuid("booking_id").references(() => bookings.id, { onDelete: "restrict" }),
    note: varchar("note", { length: 255 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("idx_credit_ledger_tenant_membership_created").on(
      table.tenantId,
      table.membershipId,
      table.createdAt
    ),
    uniqueIndex("uq_credit_ledger_booking_reason").on(table.bookingId, table.reason)
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

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export const paymentTransactions = pgTable(
  "payment_transactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    memberId: uuid("member_id").references(() => members.id, { onDelete: "set null" }),
    amountMinor: varchar("amount_minor", { length: 20 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull(),
    method: varchar("method", { length: 40 }).notNull(),
    reference: varchar("reference", { length: 255 }),
    providerRef: varchar("provider_ref", { length: 255 }),
    status: varchar("status", { length: 30 }).notNull().default("completed"),
    note: text("note"),
    allocationType: varchar("allocation_type", { length: 40 }),
    allocationId: uuid("allocation_id"),
    recordedByUserId: uuid("recorded_by_user_id").references(() => users.id, {
      onDelete: "set null"
    }),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("idx_payment_transactions_tenant_branch").on(table.tenantId, table.branchId),
    index("idx_payment_transactions_member").on(table.memberId),
    index("idx_payment_transactions_status").on(table.status)
  ]
);

// ---------------------------------------------------------------------------
// Attendance
// ---------------------------------------------------------------------------

export const attendanceRecords = pgTable(
  "attendance_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    occurrenceId: uuid("occurrence_id")
      .notNull()
      .references(() => scheduleOccurrences.id, { onDelete: "restrict" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "restrict" }),
    status: varchar("status", { length: 30 }).notNull().default("checked_in"),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    overrideReason: text("override_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("idx_attendance_records_occurrence").on(table.occurrenceId),
    index("idx_attendance_records_member").on(table.memberId),
    index("idx_attendance_records_tenant_branch").on(table.tenantId, table.branchId)
  ]
);

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
  leads,
  leadEvents,
  leadTasks,
  leadNotes,
  services,
  rooms,
  scheduleOccurrences,
  bookings,
  membershipPlans,
  memberMemberships,
  creditLedger,
  paymentTransactions,
  attendanceRecords,
  auditEvents,
  idempotencyKeys
};

export type DatabaseSchema = typeof schema;
