import {
  boolean,
  check,
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
import { sql } from "drizzle-orm";

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

export const scheduleTemplates = pgTable(
  "schedule_templates",
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
    timezone: varchar("timezone", { length: 80 }).notNull(),
    daysOfWeek: integer("days_of_week").array().notNull(),
    localStartTime: varchar("local_start_time", { length: 5 }).notNull(),
    durationMinutes: integer("duration_minutes").notNull(),
    capacity: integer("capacity").notNull(),
    effectiveStartDate: date("effective_start_date").notNull(),
    effectiveEndDate: date("effective_end_date"),
    materializedThrough: date("materialized_through"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("idx_schedule_templates_tenant_branch_active").on(
      table.tenantId,
      table.branchId,
      table.isActive
    )
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
    templateId: uuid("template_id").references(() => scheduleTemplates.id, {
      onDelete: "restrict"
    }),
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
    ),
    uniqueIndex("uq_occurrences_template_starts").on(table.templateId, table.startsAt)
  ]
);

export const scheduleExceptions = pgTable(
  "schedule_exceptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    templateId: uuid("template_id")
      .notNull()
      .references(() => scheduleTemplates.id, { onDelete: "restrict" }),
    occurrenceId: uuid("occurrence_id")
      .notNull()
      .references(() => scheduleOccurrences.id, { onDelete: "restrict" }),
    exceptionType: varchar("exception_type", { length: 30 }).notNull(),
    reason: varchar("reason", { length: 255 }).notNull(),
    originalStartsAt: timestamp("original_starts_at", { withTimezone: true }).notNull(),
    createdByUserId: uuid("created_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("idx_schedule_exceptions_tenant_template").on(
      table.tenantId,
      table.templateId,
      table.createdAt
    ),
    uniqueIndex("uq_schedule_exceptions_occurrence_type").on(
      table.occurrenceId,
      table.exceptionType
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
    index("idx_payment_transactions_tenant_branch_status_recorded").on(
      table.tenantId,
      table.branchId,
      table.status,
      table.recordedAt
    ),
    index("idx_payment_transactions_tenant_member_recorded").on(
      table.tenantId,
      table.memberId,
      table.recordedAt
    ),
    uniqueIndex("uq_payment_provider_reference")
      .on(table.tenantId, table.method, table.providerRef)
      .where(sql`${table.providerRef} IS NOT NULL`),
    check(
      "payment_amount_positive",
      sql`${table.amountMinor} ~ '^[0-9]+$' AND ${table.amountMinor}::numeric > 0`
    ),
    check("payment_currency_valid", sql`${table.currency} ~ '^[A-Z]{3}$'`),
    check(
      "payment_method_valid",
      sql`${table.method} IN ('cash', 'bank_transfer', 'mpesa', 'card', 'other')`
    ),
    check(
      "payment_status_valid",
      sql`${table.status} IN ('pending', 'completed', 'refunded', 'voided')`
    ),
    check(
      "payment_allocation_valid",
      sql`(
        (${table.allocationType} IS NULL AND ${table.allocationId} IS NULL)
        OR (${table.allocationType} IN ('membership', 'booking') AND ${table.allocationId} IS NOT NULL)
        OR (${table.allocationType} IN ('walkIn', 'other') AND ${table.allocationId} IS NULL)
      ) AND (${table.allocationType} IS NULL OR ${table.memberId} IS NOT NULL)`
    )
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
    occurrenceId: uuid("occurrence_id").references(() => scheduleOccurrences.id, {
      onDelete: "restrict"
    }),
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
    uniqueIndex("uq_attendance_occurrence_member")
      .on(table.tenantId, table.occurrenceId, table.memberId)
      .where(sql`${table.occurrenceId} IS NOT NULL`),
    uniqueIndex("uq_attendance_active_general_visit")
      .on(table.tenantId, table.branchId, table.memberId)
      .where(sql`${table.occurrenceId} IS NULL AND ${table.status} = 'checked_in'`),
    index("idx_attendance_tenant_occurrence_status").on(
      table.tenantId,
      table.occurrenceId,
      table.status
    ),
    index("idx_attendance_tenant_member_created").on(
      table.tenantId,
      table.memberId,
      table.createdAt
    ),
    index("idx_attendance_tenant_branch_status_created").on(
      table.tenantId,
      table.branchId,
      table.status,
      table.createdAt
    ),
    check(
      "attendance_status_valid",
      sql`${table.status} IN ('booked', 'checked_in', 'attended', 'no_show', 'late_cancel')`
    ),
    check(
      "attendance_checkin_timestamp_valid",
      sql`${table.status} NOT IN ('checked_in', 'attended') OR ${table.checkedInAt} IS NOT NULL`
    ),
    check(
      "attendance_override_reason_nonblank",
      sql`${table.overrideReason} IS NULL OR length(trim(${table.overrideReason})) > 0`
    )
  ]
);

// ─── Equipment & Resources ──────────────────────────────────────────────────
export const equipmentPools = pgTable(
  "equipment_pools",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    name: varchar("name", { length: 160 }).notNull(),
    code: varchar("code", { length: 80 }).notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    capacity: integer("capacity").notNull().default(1),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("uq_equipment_pools_code").on(table.tenantId, table.branchId, table.code),
    index("idx_equipment_pools_tenant_branch").on(table.tenantId, table.branchId)
  ]
);

export const equipmentAssets = pgTable(
  "equipment_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    poolId: uuid("pool_id").references(() => equipmentPools.id, { onDelete: "set null" }),
    name: varchar("name", { length: 160 }).notNull(),
    serialNumber: varchar("serial_number", { length: 120 }),
    modelNumber: varchar("model_number", { length: 120 }),
    category: varchar("category", { length: 80 }).notNull(),
    status: varchar("status", { length: 40 }).notNull().default("operational"),
    condition: varchar("condition", { length: 40 }).notNull().default("good"),
    hourlyOperationalCostMinor: integer("hourly_operational_cost_minor").default(0),
    purchaseDate: date("purchase_date"),
    warrantyExpiresAt: date("warranty_expires_at"),
    lastServicedAt: timestamp("last_serviced_at", { withTimezone: true }),
    nextServiceDueAt: timestamp("next_service_due_at", { withTimezone: true }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("idx_equipment_assets_tenant_branch").on(table.tenantId, table.branchId),
    index("idx_equipment_assets_pool").on(table.tenantId, table.poolId),
    index("idx_equipment_assets_status").on(table.tenantId, table.status)
  ]
);

export const equipmentMaintenanceRecords = pgTable(
  "equipment_maintenance_records",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => equipmentAssets.id, { onDelete: "cascade" }),
    performedByUserId: uuid("performed_by_user_id").references(() => users.id, { onDelete: "set null" }),
    serviceType: varchar("service_type", { length: 80 }).notNull(),
    costMinor: integer("cost_minor").notNull().default(0),
    notes: text("notes").notNull(),
    servicedAt: timestamp("serviced_at", { withTimezone: true }).notNull().defaultNow(),
    downtimeHours: numeric("downtime_hours", { precision: 6, scale: 2 }),
    nextServiceDueAt: timestamp("next_service_due_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("idx_maint_records_asset").on(table.tenantId, table.assetId),
    index("idx_maint_records_serviced_at").on(table.tenantId, table.servicedAt)
  ]
);

export const serviceEquipmentRequirements = pgTable(
  "service_equipment_requirements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    serviceId: uuid("service_id")
      .notNull()
      .references(() => services.id, { onDelete: "cascade" }),
    poolId: uuid("pool_id")
      .notNull()
      .references(() => equipmentPools.id, { onDelete: "cascade" }),
    quantityRequired: integer("quantity_required").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("uq_service_equipment_req").on(table.tenantId, table.serviceId, table.poolId)
  ]
);

export const occurrenceEquipmentAllocations = pgTable(
  "occurrence_equipment_allocations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    occurrenceId: uuid("occurrence_id")
      .notNull()
      .references(() => scheduleOccurrences.id, { onDelete: "cascade" }),
    assetId: uuid("asset_id")
      .notNull()
      .references(() => equipmentAssets.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 40 }).notNull().default("reserved"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("uq_occurrence_asset").on(table.tenantId, table.occurrenceId, table.assetId)
  ]
);

// ─── Inventory & Consumables ────────────────────────────────────────────────
export const inventoryItems = pgTable(
  "inventory_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    sku: varchar("sku", { length: 80 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    costPriceMinor: integer("cost_price_minor").notNull().default(0),
    retailPriceMinor: integer("retail_price_minor").notNull().default(0),
    currency: varchar("currency", { length: 3 }).notNull().default("KES"),
    currentStock: integer("current_stock").notNull().default(0),
    reorderPoint: integer("reorder_point").notNull().default(5),
    reorderQuantity: integer("reorder_quantity").notNull().default(20),
    unitOfMeasure: varchar("unit_of_measure", { length: 40 }).notNull().default("unit"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("uq_inventory_sku").on(table.tenantId, table.branchId, table.sku),
    index("idx_inventory_tenant_branch").on(table.tenantId, table.branchId)
  ]
);

export const inventoryMovements = pgTable(
  "inventory_movements",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => inventoryItems.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 40 }).notNull(),
    quantity: integer("quantity").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    reason: varchar("reason", { length: 255 }).notNull(),
    referenceId: varchar("reference_id", { length: 120 }),
    recordedByUserId: uuid("recorded_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("idx_inv_movements_item").on(table.tenantId, table.itemId),
    index("idx_inv_movements_tenant_branch").on(table.tenantId, table.branchId)
  ]
);

export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    poNumber: varchar("po_number", { length: 80 }).notNull(),
    supplierName: varchar("supplier_name", { length: 160 }).notNull(),
    status: varchar("status", { length: 40 }).notNull().default("draft"),
    totalAmountMinor: integer("total_amount_minor").notNull().default(0),
    currency: varchar("currency", { length: 3 }).notNull().default("KES"),
    itemsJson: jsonb("items_json").notNull().default(sql`'[]'::jsonb`),
    issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
    receivedAt: timestamp("received_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("uq_po_number").on(table.tenantId, table.branchId, table.poNumber)
  ]
);

export const purchaseOrderLines = pgTable(
  "purchase_order_lines",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id").notNull().references(() => branches.id, { onDelete: "restrict" }),
    purchaseOrderId: uuid("purchase_order_id").notNull().references(() => purchaseOrders.id, { onDelete: "cascade" }),
    itemId: uuid("item_id").notNull().references(() => inventoryItems.id, { onDelete: "restrict" }),
    quantity: integer("quantity").notNull(),
    unitCostMinor: integer("unit_cost_minor").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("uq_purchase_order_line_item").on(table.purchaseOrderId, table.itemId)]
);

// ─── FITOS Assess & Diagnostics ─────────────────────────────────────────────
export const assessmentDefinitions = pgTable(
  "assessment_definitions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 80 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    deviceVendor: varchar("device_vendor", { length: 80 }).notNull(),
    metricsJson: jsonb("metrics_json").notNull().default(sql`'[]'::jsonb`),
    description: text("description").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("uq_assessment_def_code").on(table.tenantId, table.code)
  ]
);

export const assessmentSessions = pgTable(
  "assessment_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    assessorStaffId: uuid("assessor_staff_id").references(() => users.id, { onDelete: "set null" }),
    definitionId: uuid("definition_id")
      .notNull()
      .references(() => assessmentDefinitions.id, { onDelete: "restrict" }),
    category: varchar("category", { length: 80 }).notNull(),
    status: varchar("status", { length: 40 }).notNull().default("completed"),
    conductedAt: timestamp("conducted_at", { withTimezone: true }).notNull().defaultNow(),
    summary: text("summary").notNull(),
    metricsJson: jsonb("metrics_json").notNull().default(sql`'{}'::jsonb`),
    provenanceJson: jsonb("provenance_json").default(sql`'{}'::jsonb`),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("idx_assess_sessions_member").on(table.tenantId, table.memberId),
    index("idx_assess_sessions_conducted_at").on(table.tenantId, table.conductedAt)
  ]
);

export const assessmentMetricResults = pgTable(
  "assessment_metric_results",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull().references(() => tenants.id, { onDelete: "restrict" }),
    assessmentSessionId: uuid("assessment_session_id").notNull().references(() => assessmentSessions.id, { onDelete: "cascade" }),
    metricKey: varchar("metric_key", { length: 80 }).notNull(),
    valueNumeric: numeric("value_numeric"),
    valueText: text("value_text"),
    unit: varchar("unit", { length: 30 }),
    provenanceJson: jsonb("provenance_json").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [uniqueIndex("uq_assessment_metric_result").on(table.assessmentSessionId, table.metricKey)]
);

export const assessmentDeviceImports = pgTable(
  "assessment_device_imports",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    deviceVendor: varchar("device_vendor", { length: 80 }).notNull(),
    deviceSerial: varchar("device_serial", { length: 120 }),
    fileName: varchar("file_name", { length: 255 }),
    rawChecksum: varchar("raw_checksum", { length: 64 }).notNull(),
    rawPayload: text("raw_payload"),
    parsedRecordsCount: integer("parsed_records_count").notNull().default(0),
    status: varchar("status", { length: 40 }).notNull().default("processed"),
    parserVersion: varchar("parser_version", { length: 80 }).notNull().default("legacy"),
    contentType: varchar("content_type", { length: 100 }),
    errorJson: jsonb("error_json").notNull().default(sql`'[]'::jsonb`),
    importedByUserId: uuid("imported_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true })
  },
  (table) => [
    index("idx_device_imports_tenant_branch").on(table.tenantId, table.branchId)
  ]
);

// ─── FITOS Therapy & Recovery ───────────────────────────────────────────────
export const therapyModalities = pgTable(
  "therapy_modalities",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    code: varchar("code", { length: 80 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    category: varchar("category", { length: 80 }).notNull(),
    defaultDurationMinutes: integer("default_duration_minutes").notNull().default(30),
    contraindicationsJson: jsonb("contraindications_json").notNull().default(sql`'[]'::jsonb`),
    description: text("description").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex("uq_therapy_modality_code").on(table.tenantId, table.code)
  ]
);

export const therapyProtocols = pgTable(
  "therapy_protocols",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    modalityCode: varchar("modality_code", { length: 80 }).notNull(),
    modalityName: varchar("modality_name", { length: 160 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    indication: varchar("indication", { length: 255 }).notNull(),
    targetArea: varchar("target_area", { length: 160 }).notNull(),
    parametersJson: jsonb("parameters_json").notNull().default(sql`'{}'::jsonb`),
    safetyChecklistJson: jsonb("safety_checklist_json").notNull().default(sql`'[]'::jsonb`),
    clinicalNotes: text("clinical_notes").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("idx_therapy_protocols_modality").on(table.tenantId, table.modalityCode)
  ]
);

export const therapySessions = pgTable(
  "therapy_sessions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "restrict" }),
    branchId: uuid("branch_id")
      .notNull()
      .references(() => branches.id, { onDelete: "restrict" }),
    memberId: uuid("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    staffUserId: uuid("staff_user_id").references(() => users.id, { onDelete: "set null" }),
    protocolId: uuid("protocol_id")
      .notNull()
      .references(() => therapyProtocols.id, { onDelete: "restrict" }),
    protocolName: varchar("protocol_name", { length: 160 }).notNull(),
    modalityCode: varchar("modality_code", { length: 80 }).notNull(),
    assetId: uuid("asset_id").references(() => equipmentAssets.id, { onDelete: "set null" }),
    status: varchar("status", { length: 40 }).notNull().default("completed"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    prePainScore: integer("pre_pain_score"),
    postPainScore: integer("post_pain_score"),
    actualDosageJson: jsonb("actual_dosage_json").notNull().default(sql`'{}'::jsonb`),
    adverseReaction: boolean("adverse_reaction").notNull().default(false),
    sessionNotes: text("session_notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow()
  },
  (table) => [
    index("idx_therapy_sessions_member").on(table.tenantId, table.memberId),
    index("idx_therapy_sessions_started_at").on(table.tenantId, table.startedAt)
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
  scheduleTemplates,
  scheduleOccurrences,
  scheduleExceptions,
  bookings,
  membershipPlans,
  memberMemberships,
  creditLedger,
  paymentTransactions,
  attendanceRecords,
  auditEvents,
  idempotencyKeys,
  // Equipment
  equipmentPools,
  equipmentAssets,
  equipmentMaintenanceRecords,
  serviceEquipmentRequirements,
  occurrenceEquipmentAllocations,
  // Inventory
  inventoryItems,
  inventoryMovements,
  purchaseOrders,
  purchaseOrderLines,
  // Assessments
  assessmentDefinitions,
  assessmentSessions,
  assessmentMetricResults,
  assessmentDeviceImports,
  // Therapy
  therapyModalities,
  therapyProtocols,
  therapySessions
};

export type DatabaseSchema = typeof schema;
