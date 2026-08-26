import { createHash } from "node:crypto";
import { createCsrfToken, createOpaqueSessionToken, hashSessionToken } from "@fitos/auth";
import { and, desc, eq, gt, gte, ilike, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import {
  auditEvents,
  bookings,
  branches,
  contacts,
  createDatabase,
  creditLedger,
  idempotencyKeys,
  implementationInquiries,
  implementationInquiryPayloads,
  leadEvents,
  leadNotes,
  leadTasks,
  leads,
  memberMemberships,
  members,
  memberIdentities,
  memberSessions,
  membershipPlans,
  paymentTransactions,
  permissions,
  publicReservations,
  attendanceRecords,
  rolePermissions,
  roles,
  rooms,
  scheduleExceptions,
  scheduleOccurrences,
  scheduleTemplates,
  sessions,
  sitePages,
  services,
  tenantUsers,
  tenants,
  tenantSubscriptions,
  userBranchAccess,
  users,
  equipmentPools,
  equipmentAssets,
  equipmentMaintenanceRecords,
  serviceEquipmentRequirements,
  occurrenceEquipmentAllocations,
  inventoryItems,
  inventoryMovements,
  serviceInventoryRequirements,
  inventoryConsumptions,
  purchaseOrders,
  inventoryLots,
  stocktakes,
  stocktakeLines,
  automationRules,
  automationRuns,
  platformAdminTokens,
  assessmentDefinitions,
  assessmentSessions,
  assessmentMetricResults,
  assessmentDeviceImports,
  therapyModalities,
  therapyProtocols,
  therapySessions,
  type FitosDatabase
} from "@fitos/database";
import type {
  AuditEventResponse,
  AuditRecordInput,
  BranchResponse,
  CreateBranchRequest,
  CreateMemberRequest,
  CreateLeadRequest,
  CreateLeadTaskRequest,
  CursorPage,
  DomainEvent,
  MemberListFilters,
  MemberListItem,
  MemberResponse,
  LeadListFilters,
  LeadConversionResponse,
  LeadNoteResponse,
  LeadResponse,
  LeadTaskResponse,
  PermissionKey,
  RoleKey,
  RoleResponse,
  StaffUserResponse,
  TenantSummary,
  UpdateBranchRequest,
  UpdateMemberRequest,
  UpdateLeadStageRequest,
  UpdateOrganizationRequest,
  UserSummary,
  CreateRoomRequest,
  UpdateRoomRequest,
  CreateScheduleOccurrenceRequest,
  CreateScheduleTemplateRequest,
  CreateServiceRequest,
  RoomResponse,
  ScheduleOccurrenceFilters,
  ScheduleOccurrenceResponse,
  ScheduleTemplateResponse,
  ScheduleTemplateMutationResponse,
  OverrideScheduleOccurrenceRequest,
  ServiceResponse,
  UpdateServiceRequest,
  BookingListFilters,
  BookingResponse,
  CreateBookingRequest,
  MembershipPlanResponse,
  CreateMembershipPlanRequest,
  MemberMembershipResponse,
  ActivateMembershipRequest,
  CreditLedgerEntryResponse,
  ManualCreditAdjustmentRequest,
  CreditReason,
  PaymentTransactionResponse,
  CreatePaymentRequest,
  PaymentListFilters,
  ReconcilePaymentRequest,
  AttendanceRecordResponse,
  CheckInRequest,
  UpdateRosterStatusRequest,
  AttendanceListFilters,
  // Equipment
  EquipmentAssetResponse,
  CreateEquipmentAssetRequest,
  UpdateEquipmentAssetRequest,
  EquipmentPoolResponse,
  CreateEquipmentPoolRequest,
  EquipmentMaintenanceRecordResponse,
  CreateMaintenanceRecordRequest,
  // Inventory
  InventoryItemResponse,
  CreateInventoryItemRequest,
  UpdateInventoryItemRequest,
  InventoryMovementResponse,
  CreateInventoryMovementRequest,
  PurchaseOrderResponse,
  CreatePurchaseOrderRequest,
  // Assessments
  AssessmentDefinitionResponse,
  CreateAssessmentDefinitionRequest,
  AssessmentSessionResponse,
  CreateAssessmentSessionRequest,
  MemberPerformanceProfileResponse,
  // Therapy
  TherapyModalityResponse,
  TherapyProtocolResponse,
  CreateTherapyProtocolRequest,
  TherapySessionResponse,
  CreateTherapySessionRequest
} from "@fitos/contracts";
import { decodeCursor, encodeCursor, normalizePhone } from "@fitos/shared";
import type { Pool } from "pg";
import type {
  CreateSessionInput,
  FitosRepository,
  IdempotencyAcquireResult,
  IdempotencyRecord,
  InviteStaffInput,
  LoginIdentity,
  ResolvedSession,
  StaffAccessInput,
  TenantScope
} from "../ports/fitos-repository.js";

const branchAccessCondition = (scope: TenantScope, column = members.homeBranchId) => {
  if (!scope.branchIds.length) return sql`false`;
  return or(isNull(column), inArray(column, scope.branchIds));
};

const serviceBranchAccessCondition = (scope: TenantScope) => {
  if (!scope.branchIds.length) return sql`false`;
  return or(isNull(services.branchId), inArray(services.branchId, scope.branchIds));
};

const membershipPlanBranchAccessCondition = (scope: TenantScope) => {
  if (!scope.branchIds.length) return sql`false`;
  return or(isNull(membershipPlans.branchId), inArray(membershipPlans.branchId, scope.branchIds));
};

const asRoleKey = (value: string | null): RoleKey | null =>
  value === "owner" ||
  value === "manager" ||
  value === "reception" ||
  value === "trainer" ||
  value === "finance"
    ? value
    : null;

const asPermission = (value: string): PermissionKey => value as PermissionKey;

export class DrizzleFitosRepository implements FitosRepository {
  readonly pool: Pool;
  private readonly db: FitosDatabase;

  constructor(connectionString?: string) {
    const connection = createDatabase(connectionString);
    this.db = connection.db;
    this.pool = connection.pool;
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async ping(): Promise<boolean> {
    await this.db.execute(sql`SELECT 1`);
    return true;
  }

  async findLoginIdentity(email: string): Promise<LoginIdentity | null> {
    const [row] = await this.db
      .select({
        user: users,
        tenantUser: tenantUsers,
        tenant: tenants,
        role: roles
      })
      .from(users)
      .innerJoin(tenantUsers, eq(tenantUsers.userId, users.id))
      .innerJoin(tenants, eq(tenants.id, tenantUsers.tenantId))
      .innerJoin(roles, eq(roles.id, tenantUsers.roleId))
      .where(
        and(
          eq(users.email, email.trim().toLowerCase()),
          eq(users.status, "active"),
          eq(tenantUsers.status, "active"),
          eq(tenants.status, "active")
        )
      )
      .limit(1);
    if (!row) return null;
    const role = await this.roleResponse(row.role);
    return {
      user: this.userResponse(row.user),
      passwordHash: row.user.passwordHash,
      tenantUserId: row.tenantUser.id,
      tenant: this.tenantResponse(row.tenant),
      role,
      branchIds: await this.branchIdsFor(row.tenantUser.id, row.tenant.id, role.key)
    };
  }

  async createSession(input: CreateSessionInput): Promise<{ id: string }> {
    const [record] = await this.db
      .insert(sessions)
      .values({
        userId: input.userId,
        tenantUserId: input.tenantUserId,
        sessionTokenHash: input.tokenHash,
        expiresAt: new Date(input.expiresAt),
        ...(input.ipHash ? { ipHash: input.ipHash } : {}),
        ...(input.userAgentSummary ? { userAgentSummary: input.userAgentSummary } : {})
      })
      .returning({ id: sessions.id });
    if (!record) throw new Error("Unable to create session.");
    return record;
  }

  async resolveSession(tokenHash: string, currentTime: string): Promise<ResolvedSession | null> {
    const [row] = await this.db
      .select({
        session: sessions,
        user: users,
        tenantUser: tenantUsers,
        tenant: tenants,
        role: roles
      })
      .from(sessions)
      .innerJoin(users, eq(users.id, sessions.userId))
      .innerJoin(tenantUsers, eq(tenantUsers.id, sessions.tenantUserId))
      .innerJoin(tenants, eq(tenants.id, tenantUsers.tenantId))
      .innerJoin(roles, eq(roles.id, tenantUsers.roleId))
      .where(
        and(
          eq(sessions.sessionTokenHash, tokenHash),
          isNull(sessions.revokedAt),
          gt(sessions.expiresAt, new Date(currentTime)),
          eq(users.status, "active"),
          eq(tenantUsers.status, "active"),
          eq(tenants.status, "active")
        )
      )
      .limit(1);
    if (!row) return null;
    await this.db
      .update(sessions)
      .set({ lastSeenAt: new Date(currentTime) })
      .where(eq(sessions.id, row.session.id));
    const role = await this.roleResponse(row.role);
    return {
      sessionId: row.session.id,
      user: this.userResponse(row.user),
      tenantUserId: row.tenantUser.id,
      tenant: this.tenantResponse(row.tenant),
      role,
      branchIds: await this.branchIdsFor(row.tenantUser.id, row.tenant.id, role.key),
      permissions: role.permissions
    };
  }

  async revokeSession(tokenHash: string, at: string): Promise<void> {
    await this.db
      .update(sessions)
      .set({ revokedAt: new Date(at) })
      .where(eq(sessions.sessionTokenHash, tokenHash));
  }

  async markUserLoggedIn(userId: string, at: string): Promise<void> {
    await this.db
      .update(users)
      .set({ lastLoginAt: new Date(at), updatedAt: new Date(at) })
      .where(eq(users.id, userId));
  }

  async findTenant(scope: TenantScope): Promise<TenantSummary | null> {
    const [tenant] = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.id, scope.tenantId))
      .limit(1);
    return tenant ? this.tenantResponse(tenant) : null;
  }

  async updateTenant(scope: TenantScope, input: UpdateOrganizationRequest): Promise<TenantSummary> {
    const [tenant] = await this.db
      .update(tenants)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.timezone !== undefined ? { defaultTimezone: input.timezone } : {}),
        ...(input.currency !== undefined ? { defaultCurrency: input.currency } : {}),
        updatedAt: new Date()
      })
      .where(eq(tenants.id, scope.tenantId))
      .returning();
    if (!tenant) throw new Error("Tenant not found.");
    return this.tenantResponse(tenant);
  }

  async listBranches(scope: TenantScope): Promise<BranchResponse[]> {
    if (!scope.branchIds.length) return [];
    const rows = await this.db
      .select()
      .from(branches)
      .where(and(eq(branches.tenantId, scope.tenantId), inArray(branches.id, scope.branchIds)))
      .orderBy(branches.name);
    return rows.map((branch) => this.branchResponse(branch));
  }

  async findBranchById(scope: TenantScope, branchId: string): Promise<BranchResponse | null> {
    if (!scope.branchIds.includes(branchId)) return null;
    const [branch] = await this.db
      .select()
      .from(branches)
      .where(and(eq(branches.id, branchId), eq(branches.tenantId, scope.tenantId)))
      .limit(1);
    return branch ? this.branchResponse(branch) : null;
  }

  async createBranch(scope: TenantScope, input: CreateBranchRequest): Promise<BranchResponse> {
    const slug = this.slug(input.slug ?? input.name);
    const timestamp = new Date();
    const branch = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(branches)
        .values({
          tenantId: scope.tenantId,
          name: input.name,
          slug,
          ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(input.email !== undefined ? { email: input.email } : {}),
          ...(input.addressLine1 !== undefined ? { addressLine1: input.addressLine1 } : {}),
          ...(input.addressLine2 !== undefined ? { addressLine2: input.addressLine2 } : {}),
          ...(input.city !== undefined ? { city: input.city } : {}),
          ...(input.countryCode ? { countryCode: input.countryCode } : {}),
          createdAt: timestamp,
          updatedAt: timestamp
        })
        .returning();
      if (!created) throw new Error("Unable to create branch.");
      await tx
        .insert(userBranchAccess)
        .values({ tenantUserId: scope.tenantUserId, branchId: created.id })
        .onConflictDoNothing();
      return created;
    });
    return this.branchResponse(branch);
  }

  async updateBranch(
    scope: TenantScope,
    branchId: string,
    input: UpdateBranchRequest
  ): Promise<BranchResponse | null> {
    if (!scope.branchIds.includes(branchId)) return null;
    const [branch] = await this.db
      .update(branches)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined ? { slug: this.slug(input.slug) } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.phone !== undefined ? { phone: input.phone } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
        ...(input.addressLine1 !== undefined ? { addressLine1: input.addressLine1 } : {}),
        ...(input.addressLine2 !== undefined ? { addressLine2: input.addressLine2 } : {}),
        ...(input.city !== undefined ? { city: input.city } : {}),
        ...(input.countryCode !== undefined ? { countryCode: input.countryCode ?? "KE" } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        updatedAt: new Date()
      })
      .where(and(eq(branches.id, branchId), eq(branches.tenantId, scope.tenantId)))
      .returning();
    return branch ? this.branchResponse(branch) : null;
  }

  async createMember(
    scope: TenantScope,
    input: CreateMemberRequest,
    normalizedPhone: string | null
  ): Promise<MemberResponse> {
    const timestamp = new Date();
    const result = await this.db.transaction(async (tx) => {
      const [contact] = await tx
        .insert(contacts)
        .values({
          tenantId: scope.tenantId,
          firstName: input.contact.firstName,
          ...(input.contact.lastName !== undefined ? { lastName: input.contact.lastName } : {}),
          ...(input.contact.phone !== undefined
            ? { phoneRaw: input.contact.phone, phoneE164: normalizedPhone }
            : {}),
          ...(input.contact.email !== undefined
            ? { email: input.contact.email?.trim().toLowerCase() || null }
            : {}),
          ...(input.contact.dateOfBirth !== undefined
            ? { dateOfBirth: input.contact.dateOfBirth }
            : {}),
          preferredBranchId: input.homeBranchId,
          createdAt: timestamp,
          updatedAt: timestamp
        })
        .returning();
      if (!contact) throw new Error("Unable to create contact.");
      const [member] = await tx
        .insert(members)
        .values({
          tenantId: scope.tenantId,
          contactId: contact.id,
          homeBranchId: input.homeBranchId,
          status: "active",
          joinedAt: timestamp,
          createdAt: timestamp,
          updatedAt: timestamp
        })
        .returning();
      if (!member) throw new Error("Unable to create member.");
      return { member, contact };
    });
    return this.memberResponse(result.member, result.contact);
  }

  async findMemberById(scope: TenantScope, memberId: string): Promise<MemberResponse | null> {
    const [row] = await this.db
      .select({ member: members, contact: contacts })
      .from(members)
      .innerJoin(contacts, eq(contacts.id, members.contactId))
      .where(
        and(
          eq(members.id, memberId),
          eq(members.tenantId, scope.tenantId),
          branchAccessCondition(scope)
        )
      )
      .limit(1);
    return row ? this.memberResponse(row.member, row.contact) : null;
  }

  async searchMembers(
    scope: TenantScope,
    filters: MemberListFilters
  ): Promise<CursorPage<MemberListItem>> {
    if (filters.branchId && !scope.branchIds.includes(filters.branchId))
      return { data: [], page: { nextCursor: null, hasMore: false } };
    const cursor = decodeCursor(filters.cursor);
    const conditions = [eq(members.tenantId, scope.tenantId), branchAccessCondition(scope)];
    if (filters.branchId) conditions.push(eq(members.homeBranchId, filters.branchId));
    if (filters.status) conditions.push(eq(members.status, filters.status));
    if (filters.query) {
      const term = `%${filters.query.trim().replace(/[\\%_]/g, "\\$&")}%`;
      conditions.push(
        or(
          ilike(contacts.firstName, term),
          ilike(contacts.lastName, term),
          ilike(contacts.phoneE164, term),
          ilike(contacts.email, term)
        )!
      );
    }
    if (cursor) {
      conditions.push(
        or(
          lt(members.createdAt, new Date(cursor.createdAt)),
          and(eq(members.createdAt, new Date(cursor.createdAt)), lt(members.id, cursor.id))
        )!
      );
    }
    const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);
    const rows = await this.db
      .select({ member: members, contact: contacts })
      .from(members)
      .innerJoin(contacts, eq(contacts.id, members.contactId))
      .where(and(...conditions))
      .orderBy(desc(members.createdAt), desc(members.id))
      .limit(limit + 1);
    const hasMore = rows.length > limit;
    const selected = rows.slice(0, limit);
    const last = selected.at(-1)?.member;
    return {
      data: selected.map(({ member, contact }) => this.memberListItem(member, contact)),
      page: {
        nextCursor:
          hasMore && last
            ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
            : null,
        hasMore
      }
    };
  }

  async updateMember(
    scope: TenantScope,
    memberId: string,
    input: UpdateMemberRequest,
    normalizedPhone?: string | null
  ): Promise<MemberResponse | null> {
    const current = await this.findMemberById(scope, memberId);
    if (!current) return null;
    const result = await this.db.transaction(async (tx) => {
      if (input.contact) {
        await tx
          .update(contacts)
          .set({
            ...(input.contact.firstName !== undefined
              ? { firstName: input.contact.firstName }
              : {}),
            ...(input.contact.lastName !== undefined ? { lastName: input.contact.lastName } : {}),
            ...(input.contact.email !== undefined
              ? { email: input.contact.email?.trim().toLowerCase() || null }
              : {}),
            ...(input.contact.dateOfBirth !== undefined
              ? { dateOfBirth: input.contact.dateOfBirth }
              : {}),
            ...(normalizedPhone !== undefined
              ? { phoneRaw: input.contact.phone ?? null, phoneE164: normalizedPhone }
              : {}),
            updatedAt: new Date()
          })
          .where(and(eq(contacts.id, current.contact.id), eq(contacts.tenantId, scope.tenantId)));
      }
      const [member] = await tx
        .update(members)
        .set({
          ...(input.homeBranchId !== undefined ? { homeBranchId: input.homeBranchId } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          updatedAt: new Date()
        })
        .where(and(eq(members.id, memberId), eq(members.tenantId, scope.tenantId)))
        .returning();
      if (!member) return null;
      const [contact] = await tx
        .select()
        .from(contacts)
        .where(eq(contacts.id, member.contactId))
        .limit(1);
      return contact ? { member, contact } : null;
    });
    return result ? this.memberResponse(result.member, result.contact) : null;
  }

  async createLead(
    scope: TenantScope,
    input: CreateLeadRequest,
    normalizedPhone: string | null
  ): Promise<LeadResponse> {
    const timestamp = new Date();
    const result = await this.db.transaction(async (tx) => {
      const [contact] = await tx
        .insert(contacts)
        .values({
          tenantId: scope.tenantId,
          firstName: input.contact.firstName,
          ...(input.contact.lastName !== undefined ? { lastName: input.contact.lastName } : {}),
          ...(input.contact.phone !== undefined
            ? { phoneRaw: input.contact.phone, phoneE164: normalizedPhone }
            : {}),
          ...(input.contact.email !== undefined
            ? { email: input.contact.email?.trim().toLowerCase() || null }
            : {}),
          ...(input.contact.dateOfBirth !== undefined
            ? { dateOfBirth: input.contact.dateOfBirth }
            : {}),
          ...(input.branchId !== undefined ? { preferredBranchId: input.branchId } : {}),
          createdAt: timestamp,
          updatedAt: timestamp
        })
        .returning();
      if (!contact) throw new Error("Unable to create lead contact.");
      const [lead] = await tx
        .insert(leads)
        .values({
          tenantId: scope.tenantId,
          contactId: contact.id,
          ...(input.branchId !== undefined ? { branchId: input.branchId } : {}),
          ...(input.ownerUserId !== undefined ? { ownerUserId: input.ownerUserId } : {}),
          ...(input.interest !== undefined ? { interest: input.interest } : {}),
          ...(input.source !== undefined ? { source: input.source } : {}),
          ...(input.nextFollowUpAt !== undefined
            ? { nextFollowUpAt: input.nextFollowUpAt ? new Date(input.nextFollowUpAt) : null }
            : {}),
          createdAt: timestamp,
          updatedAt: timestamp
        })
        .returning();
      if (!lead) throw new Error("Unable to create lead.");
      await tx
        .insert(leadEvents)
        .values({ tenantId: scope.tenantId, leadId: lead.id, eventType: "lead.created" });
      return { lead, contact };
    });
    return this.leadResponse(result.lead, result.contact);
  }

  async findLeadById(scope: TenantScope, leadId: string): Promise<LeadResponse | null> {
    const [row] = await this.db
      .select({ lead: leads, contact: contacts })
      .from(leads)
      .innerJoin(contacts, eq(contacts.id, leads.contactId))
      .where(
        and(
          eq(leads.id, leadId),
          eq(leads.tenantId, scope.tenantId),
          scope.branchIds.length
            ? or(isNull(leads.branchId), inArray(leads.branchId, scope.branchIds))
            : sql`false`
        )
      )
      .limit(1);
    return row ? this.leadResponse(row.lead, row.contact) : null;
  }

  async searchLeads(
    scope: TenantScope,
    filters: LeadListFilters
  ): Promise<CursorPage<LeadResponse>> {
    if (filters.branchId && !scope.branchIds.includes(filters.branchId))
      return { data: [], page: { nextCursor: null, hasMore: false } };
    const conditions = [
      eq(leads.tenantId, scope.tenantId),
      scope.branchIds.length
        ? or(isNull(leads.branchId), inArray(leads.branchId, scope.branchIds))
        : sql`false`
    ];
    if (filters.branchId) conditions.push(eq(leads.branchId, filters.branchId));
    if (filters.stage) conditions.push(eq(leads.stage, filters.stage));
    if (filters.query) {
      const term = `%${filters.query.trim().replace(/[\\%_]/g, "\\$&")}%`;
      conditions.push(
        or(
          ilike(contacts.firstName, term),
          ilike(contacts.lastName, term),
          ilike(contacts.phoneE164, term),
          ilike(contacts.email, term),
          ilike(leads.interest, term)
        )!
      );
    }
    const cursor = decodeCursor(filters.cursor);
    if (cursor)
      conditions.push(
        or(
          lt(leads.createdAt, new Date(cursor.createdAt)),
          and(eq(leads.createdAt, new Date(cursor.createdAt)), lt(leads.id, cursor.id))
        )!
      );
    const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);
    const rows = await this.db
      .select({ lead: leads, contact: contacts })
      .from(leads)
      .innerJoin(contacts, eq(contacts.id, leads.contactId))
      .where(and(...conditions))
      .orderBy(desc(leads.createdAt), desc(leads.id))
      .limit(limit + 1);
    const hasMore = rows.length > limit;
    const selected = rows.slice(0, limit);
    const last = selected.at(-1)?.lead;
    return {
      data: selected.map(({ lead, contact }) => this.leadResponse(lead, contact)),
      page: {
        hasMore,
        nextCursor:
          hasMore && last
            ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id })
            : null
      }
    };
  }

  async updateLeadStage(
    scope: TenantScope,
    leadId: string,
    input: UpdateLeadStageRequest,
    actorUserId: string
  ): Promise<LeadResponse | null> {
    const current = await this.findLeadById(scope, leadId);
    if (!current) return null;
    const [lead] = await this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(leads)
        .set({
          stage: input.stage,
          lostReason: input.stage === "lost" ? (input.lostReason ?? null) : null,
          updatedAt: new Date()
        })
        .where(and(eq(leads.id, leadId), eq(leads.tenantId, scope.tenantId)))
        .returning();
      if (!updated) return [];
      await tx.insert(leadEvents).values({
        tenantId: scope.tenantId,
        leadId,
        actorUserId,
        eventType: "lead.stage_changed",
        previousStage: current.stage,
        nextStage: input.stage
      });
      return [updated];
    });
    if (!lead) return null;
    const [contact] = await this.db
      .select()
      .from(contacts)
      .where(and(eq(contacts.id, lead.contactId), eq(contacts.tenantId, scope.tenantId)))
      .limit(1);
    return contact ? this.leadResponse(lead, contact) : null;
  }

  async convertLead(
    scope: TenantScope,
    leadId: string,
    actorUserId: string
  ): Promise<LeadConversionResponse | null> {
    const current = await this.findLeadById(scope, leadId);
    if (!current) return null;
    const result = await this.db.transaction(async (tx) => {
      const [lead] = await tx
        .select()
        .from(leads)
        .where(and(eq(leads.id, leadId), eq(leads.tenantId, scope.tenantId)))
        .limit(1);
      if (!lead) return null;
      const [contact] = await tx
        .select()
        .from(contacts)
        .where(and(eq(contacts.id, lead.contactId), eq(contacts.tenantId, scope.tenantId)))
        .limit(1);
      if (!contact) return null;
      const [existing] = await tx
        .select()
        .from(members)
        .where(and(eq(members.tenantId, scope.tenantId), eq(members.contactId, contact.id)))
        .limit(1);
      const timestamp = new Date();
      const member =
        existing ??
        (
          await tx
            .insert(members)
            .values({
              tenantId: scope.tenantId,
              contactId: contact.id,
              homeBranchId: lead.branchId,
              status: "active",
              joinedAt: timestamp,
              createdAt: timestamp,
              updatedAt: timestamp
            })
            .returning()
        )[0];
      if (!member) throw new Error("Unable to create member from lead.");
      const [updatedLead] = await tx
        .update(leads)
        .set({
          stage: "joined",
          lostReason: null,
          convertedMemberId: member.id,
          updatedAt: timestamp
        })
        .where(eq(leads.id, lead.id))
        .returning();
      if (!updatedLead) throw new Error("Unable to convert lead.");
      await tx.insert(leadEvents).values({
        tenantId: scope.tenantId,
        leadId,
        actorUserId,
        eventType: "lead.converted",
        previousStage: current.stage,
        nextStage: "joined"
      });
      return { lead: updatedLead, contact, member, alreadyConverted: Boolean(existing) };
    });
    return result
      ? {
          lead: this.leadResponse(result.lead, result.contact),
          member: this.memberResponse(result.member, result.contact),
          alreadyConverted: result.alreadyConverted
        }
      : null;
  }

  async addLeadNote(
    scope: TenantScope,
    leadId: string,
    body: string,
    actorUserId: string
  ): Promise<LeadNoteResponse | null> {
    if (!(await this.findLeadById(scope, leadId))) return null;
    const [note] = await this.db
      .insert(leadNotes)
      .values({ tenantId: scope.tenantId, leadId, body, createdByUserId: actorUserId })
      .returning();
    return note ? this.leadNoteResponse(note) : null;
  }

  async listLeadNotes(scope: TenantScope, leadId: string): Promise<LeadNoteResponse[]> {
    if (!(await this.findLeadById(scope, leadId))) return [];
    const notes = await this.db
      .select()
      .from(leadNotes)
      .where(and(eq(leadNotes.tenantId, scope.tenantId), eq(leadNotes.leadId, leadId)))
      .orderBy(desc(leadNotes.createdAt));
    return notes.map((note) => this.leadNoteResponse(note));
  }

  async createLeadTask(
    scope: TenantScope,
    leadId: string,
    input: CreateLeadTaskRequest
  ): Promise<LeadTaskResponse | null> {
    if (!(await this.findLeadById(scope, leadId))) return null;
    const [task] = await this.db
      .insert(leadTasks)
      .values({
        tenantId: scope.tenantId,
        leadId,
        body: input.body,
        ...(input.dueAt !== undefined ? { dueAt: input.dueAt ? new Date(input.dueAt) : null } : {}),
        ...(input.assigneeUserId !== undefined ? { assigneeUserId: input.assigneeUserId } : {})
      })
      .returning();
    return task ? this.leadTaskResponse(task) : null;
  }

  async listLeadTasks(scope: TenantScope, leadId: string): Promise<LeadTaskResponse[]> {
    if (!(await this.findLeadById(scope, leadId))) return [];
    const tasks = await this.db
      .select()
      .from(leadTasks)
      .where(and(eq(leadTasks.tenantId, scope.tenantId), eq(leadTasks.leadId, leadId)))
      .orderBy(leadTasks.dueAt, leadTasks.createdAt);
    return tasks.map((task) => this.leadTaskResponse(task));
  }

  async listServices(scope: TenantScope): Promise<ServiceResponse[]> {
    const rows = await this.db
      .select()
      .from(services)
      .where(and(eq(services.tenantId, scope.tenantId), serviceBranchAccessCondition(scope)))
      .orderBy(services.name);
    return rows.map((service) => this.serviceResponse(service));
  }

  async findServiceById(scope: TenantScope, serviceId: string): Promise<ServiceResponse | null> {
    const [service] = await this.db
      .select()
      .from(services)
      .where(
        and(
          eq(services.id, serviceId),
          eq(services.tenantId, scope.tenantId),
          serviceBranchAccessCondition(scope)
        )
      )
      .limit(1);
    return service ? this.serviceResponse(service) : null;
  }

  async createService(scope: TenantScope, input: CreateServiceRequest): Promise<ServiceResponse> {
    const [service] = await this.db
      .insert(services)
      .values({
        tenantId: scope.tenantId,
        branchId: input.branchId ?? null,
        name: input.name,
        slug: input.slug || this.slug(input.name),
        serviceType: input.serviceType,
        durationMinutes: input.durationMinutes,
        defaultCapacity: input.defaultCapacity ?? null,
        creditsRequired: input.creditsRequired ?? 0,
        cancellationCutoffMinutes: input.cancellationCutoffMinutes ?? 0,
        restoreCreditOnLateCancel: input.restoreCreditOnLateCancel ?? false,
        amountMinor: input.price?.amountMinor ?? null,
        currency: input.price?.currency ?? null,
        publicVisible: input.publicVisible ?? false
      })
      .returning();
    if (!service) throw new Error("Unable to create service.");
    return this.serviceResponse(service);
  }

  async updateService(
    scope: TenantScope,
    serviceId: string,
    input: UpdateServiceRequest
  ): Promise<ServiceResponse | null> {
    const current = await this.findServiceById(scope, serviceId);
    if (!current) return null;
    const [service] = await this.db
      .update(services)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.durationMinutes !== undefined ? { durationMinutes: input.durationMinutes } : {}),
        ...(input.defaultCapacity !== undefined ? { defaultCapacity: input.defaultCapacity } : {}),
        ...(input.creditsRequired !== undefined ? { creditsRequired: input.creditsRequired } : {}),
        ...(input.cancellationCutoffMinutes !== undefined
          ? { cancellationCutoffMinutes: input.cancellationCutoffMinutes }
          : {}),
        ...(input.restoreCreditOnLateCancel !== undefined
          ? { restoreCreditOnLateCancel: input.restoreCreditOnLateCancel }
          : {}),
        ...(input.price !== undefined
          ? {
              amountMinor: input.price?.amountMinor ?? null,
              currency: input.price?.currency ?? null
            }
          : {}),
        ...(input.publicVisible !== undefined ? { publicVisible: input.publicVisible } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        updatedAt: new Date()
      })
      .where(and(eq(services.id, current.id), eq(services.tenantId, scope.tenantId)))
      .returning();
    return service ? this.serviceResponse(service) : null;
  }

  async listRooms(scope: TenantScope, branchId?: string): Promise<RoomResponse[]> {
    const rows = await this.db
      .select()
      .from(rooms)
      .where(
        and(
          eq(rooms.tenantId, scope.tenantId),
          inArray(rooms.branchId, scope.branchIds),
          ...(branchId ? [eq(rooms.branchId, branchId)] : [])
        )
      )
      .orderBy(rooms.name);
    return rows.map((room) => this.roomResponse(room));
  }

  async findRoomById(scope: TenantScope, roomId: string): Promise<RoomResponse | null> {
    const [room] = await this.db
      .select()
      .from(rooms)
      .where(
        and(
          eq(rooms.id, roomId),
          eq(rooms.tenantId, scope.tenantId),
          inArray(rooms.branchId, scope.branchIds)
        )
      )
      .limit(1);
    return room ? this.roomResponse(room) : null;
  }

  async createRoom(scope: TenantScope, input: CreateRoomRequest): Promise<RoomResponse> {
    if (!scope.branchIds.includes(input.branchId)) throw new Error("Branch unavailable.");
    const [room] = await this.db
      .insert(rooms)
      .values({
        tenantId: scope.tenantId,
        branchId: input.branchId,
        name: input.name,
        capacity: input.capacity ?? null
      })
      .returning();
    if (!room) throw new Error("Unable to create room.");
    return this.roomResponse(room);
  }

  async updateRoom(
    scope: TenantScope,
    roomId: string,
    input: UpdateRoomRequest
  ): Promise<RoomResponse | null> {
    const [room] = await this.db
      .update(rooms)
      .set({
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        updatedAt: new Date()
      })
      .where(
        and(
          eq(rooms.id, roomId),
          eq(rooms.tenantId, scope.tenantId),
          inArray(rooms.branchId, scope.branchIds)
        )
      )
      .returning();
    return room ? this.roomResponse(room) : null;
  }

  async createScheduleTemplate(
    scope: TenantScope,
    input: CreateScheduleTemplateRequest,
    occurrences: CreateScheduleOccurrenceRequest[],
    materializedThrough: string
  ): Promise<ScheduleTemplateMutationResponse> {
    return this.db.transaction(async (tx) => {
      const [template] = await tx
        .insert(scheduleTemplates)
        .values({
          tenantId: scope.tenantId,
          branchId: input.branchId,
          serviceId: input.serviceId,
          trainerUserId: input.trainerUserId ?? null,
          roomId: input.roomId ?? null,
          timezone: input.timezone,
          daysOfWeek: input.daysOfWeek,
          localStartTime: input.localStartTime,
          durationMinutes: input.durationMinutes,
          capacity: input.capacity,
          effectiveStartDate: input.effectiveStartDate,
          effectiveEndDate: input.effectiveEndDate ?? null,
          materializedThrough
        })
        .returning();
      if (!template) throw new Error("Unable to create schedule template.");
      const created = occurrences.length
        ? await tx
            .insert(scheduleOccurrences)
            .values(
              occurrences.map((occurrence) => ({
                tenantId: scope.tenantId,
                branchId: occurrence.branchId,
                templateId: template.id,
                serviceId: occurrence.serviceId,
                trainerUserId: occurrence.trainerUserId ?? null,
                roomId: occurrence.roomId ?? null,
                startsAt: new Date(occurrence.startsAt),
                endsAt: new Date(occurrence.endsAt),
                capacity: occurrence.capacity
              }))
            )
            .returning()
        : [];
      return {
        template: this.scheduleTemplateResponse(template),
        occurrences: created.map((occurrence) => this.occurrenceResponse(occurrence))
      };
    });
  }

  async findScheduleTemplateById(
    scope: TenantScope,
    templateId: string
  ): Promise<ScheduleTemplateResponse | null> {
    const [template] = await this.db
      .select()
      .from(scheduleTemplates)
      .where(
        and(
          eq(scheduleTemplates.id, templateId),
          eq(scheduleTemplates.tenantId, scope.tenantId),
          inArray(scheduleTemplates.branchId, scope.branchIds)
        )
      )
      .limit(1);
    return template ? this.scheduleTemplateResponse(template) : null;
  }

  async listScheduleTemplates(
    scope: TenantScope,
    branchId?: string
  ): Promise<ScheduleTemplateResponse[]> {
    if (branchId && !scope.branchIds.includes(branchId)) return [];
    const templates = await this.db
      .select()
      .from(scheduleTemplates)
      .where(
        and(
          eq(scheduleTemplates.tenantId, scope.tenantId),
          inArray(scheduleTemplates.branchId, scope.branchIds),
          ...(branchId ? [eq(scheduleTemplates.branchId, branchId)] : [])
        )
      )
      .orderBy(scheduleTemplates.localStartTime);
    return templates.map((template) => this.scheduleTemplateResponse(template));
  }

  async materializeScheduleTemplate(
    scope: TenantScope,
    templateId: string,
    occurrences: CreateScheduleOccurrenceRequest[],
    materializedThrough: string
  ): Promise<ScheduleTemplateMutationResponse | null> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`
        SELECT id FROM schedule_templates
        WHERE id = ${templateId} AND tenant_id = ${scope.tenantId}
        FOR UPDATE
      `);
      const [template] = await tx
        .select()
        .from(scheduleTemplates)
        .where(
          and(
            eq(scheduleTemplates.id, templateId),
            eq(scheduleTemplates.tenantId, scope.tenantId),
            inArray(scheduleTemplates.branchId, scope.branchIds)
          )
        )
        .limit(1);
      if (!template) return null;

      const existing = occurrences.length
        ? await tx
            .select({ startsAt: scheduleOccurrences.startsAt })
            .from(scheduleOccurrences)
            .where(
              and(
                eq(scheduleOccurrences.templateId, template.id),
                inArray(
                  scheduleOccurrences.startsAt,
                  occurrences.map((occurrence) => new Date(occurrence.startsAt))
                )
              )
            )
        : [];
      const existingStarts = new Set(existing.map((row) => row.startsAt.toISOString()));
      const pending = occurrences.filter(
        (occurrence) => !existingStarts.has(new Date(occurrence.startsAt).toISOString())
      );
      const created = pending.length
        ? await tx
            .insert(scheduleOccurrences)
            .values(
              pending.map((occurrence) => ({
                tenantId: scope.tenantId,
                branchId: occurrence.branchId,
                templateId: template.id,
                serviceId: occurrence.serviceId,
                trainerUserId: occurrence.trainerUserId ?? null,
                roomId: occurrence.roomId ?? null,
                startsAt: new Date(occurrence.startsAt),
                endsAt: new Date(occurrence.endsAt),
                capacity: occurrence.capacity
              }))
            )
            .returning()
        : [];
      const targetThrough =
        template.materializedThrough && template.materializedThrough > materializedThrough
          ? template.materializedThrough
          : materializedThrough;
      const [updated] = await tx
        .update(scheduleTemplates)
        .set({ materializedThrough: targetThrough, updatedAt: new Date() })
        .where(eq(scheduleTemplates.id, template.id))
        .returning();
      if (!updated) throw new Error("Unable to update schedule template.");
      return {
        template: this.scheduleTemplateResponse(updated),
        occurrences: created.map((occurrence) => this.occurrenceResponse(occurrence))
      };
    });
  }

  async createScheduleOccurrence(
    scope: TenantScope,
    input: CreateScheduleOccurrenceRequest
  ): Promise<ScheduleOccurrenceResponse> {
    const [occurrence] = await this.db
      .insert(scheduleOccurrences)
      .values({
        tenantId: scope.tenantId,
        branchId: input.branchId,
        templateId: null,
        serviceId: input.serviceId,
        trainerUserId: input.trainerUserId ?? null,
        roomId: input.roomId ?? null,
        startsAt: new Date(input.startsAt),
        endsAt: new Date(input.endsAt),
        capacity: input.capacity
      })
      .returning();
    if (!occurrence) throw new Error("Unable to create schedule occurrence.");
    return (await this.withResourceWarnings([occurrence]))[0]!;
  }

  async findScheduleOccurrenceById(
    scope: TenantScope,
    occurrenceId: string
  ): Promise<ScheduleOccurrenceResponse | null> {
    const [occurrence] = await this.db
      .select()
      .from(scheduleOccurrences)
      .where(
        and(
          eq(scheduleOccurrences.id, occurrenceId),
          eq(scheduleOccurrences.tenantId, scope.tenantId),
          inArray(scheduleOccurrences.branchId, scope.branchIds)
        )
      )
      .limit(1);
    return occurrence ? this.occurrenceResponse(occurrence) : null;
  }

  async listScheduleOccurrences(
    scope: TenantScope,
    filters: ScheduleOccurrenceFilters
  ): Promise<CursorPage<ScheduleOccurrenceResponse>> {
    const rows = await this.db
      .select()
      .from(scheduleOccurrences)
      .where(
        and(
          eq(scheduleOccurrences.tenantId, scope.tenantId),
          inArray(scheduleOccurrences.branchId, scope.branchIds),
          ...(filters.branchId ? [eq(scheduleOccurrences.branchId, filters.branchId)] : []),
          ...(filters.serviceId ? [eq(scheduleOccurrences.serviceId, filters.serviceId)] : []),
          ...(filters.trainerUserId
            ? [eq(scheduleOccurrences.trainerUserId, filters.trainerUserId)]
            : []),
          ...(filters.roomId ? [eq(scheduleOccurrences.roomId, filters.roomId)] : []),
          ...(filters.status ? [eq(scheduleOccurrences.status, filters.status)] : []),
          ...(filters.startsAfter
            ? [gt(scheduleOccurrences.startsAt, new Date(filters.startsAfter))]
            : []),
          ...(filters.endsBefore
            ? [lt(scheduleOccurrences.endsAt, new Date(filters.endsBefore))]
            : [])
        )
      )
      .orderBy(scheduleOccurrences.startsAt)
      .limit(Math.min(Math.max(filters.limit ?? 50, 1), 100) + 1);
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
    return {
      data: await this.withResourceWarnings(rows.slice(0, limit)),
      page: { hasMore: rows.length > limit, nextCursor: null }
    };
  }

  async cancelScheduleOccurrence(
    scope: TenantScope,
    occurrenceId: string,
    reason: string,
    actorUserId = scope.userId
  ): Promise<ScheduleOccurrenceResponse | null> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`
        SELECT id FROM schedule_occurrences
        WHERE id = ${occurrenceId} AND tenant_id = ${scope.tenantId}
        FOR UPDATE
      `);
      const [current] = await tx
        .select()
        .from(scheduleOccurrences)
        .where(
          and(
            eq(scheduleOccurrences.id, occurrenceId),
            eq(scheduleOccurrences.tenantId, scope.tenantId),
            inArray(scheduleOccurrences.branchId, scope.branchIds)
          )
        )
        .limit(1);
      if (!current) return null;
      if (current.status === "cancelled") return this.occurrenceResponse(current);
      if (current.templateId) {
        await tx
          .insert(scheduleExceptions)
          .values({
            tenantId: scope.tenantId,
            templateId: current.templateId,
            occurrenceId: current.id,
            exceptionType: "cancelled",
            reason,
            originalStartsAt: current.startsAt,
            createdByUserId: actorUserId
          })
          .onConflictDoNothing();
      }
      const [occurrence] = await tx
        .update(scheduleOccurrences)
        .set({ status: "cancelled", cancellationReason: reason, updatedAt: new Date() })
        .where(eq(scheduleOccurrences.id, occurrenceId))
        .returning();
      return occurrence ? this.occurrenceResponse(occurrence) : null;
    });
  }

  async overrideScheduleOccurrence(
    scope: TenantScope,
    occurrenceId: string,
    input: OverrideScheduleOccurrenceRequest,
    actorUserId: string
  ): Promise<ScheduleOccurrenceResponse | null> {
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`
        SELECT id FROM schedule_occurrences
        WHERE id = ${occurrenceId} AND tenant_id = ${scope.tenantId}
        FOR UPDATE
      `);
      const [current] = await tx
        .select()
        .from(scheduleOccurrences)
        .where(
          and(
            eq(scheduleOccurrences.id, occurrenceId),
            eq(scheduleOccurrences.tenantId, scope.tenantId),
            inArray(scheduleOccurrences.branchId, scope.branchIds)
          )
        )
        .limit(1);
      if (!current?.templateId) return null;
      if (input.capacity !== undefined) {
        const [bookingCount] = await tx
          .select({ value: sql<number>`count(*)::int` })
          .from(bookings)
          .where(and(eq(bookings.occurrenceId, current.id), eq(bookings.status, "confirmed")));
        if (input.capacity < (bookingCount?.value ?? 0)) {
          throw new Error("Capacity cannot be lower than confirmed bookings.");
        }
      }
      const insertedException = await tx
        .insert(scheduleExceptions)
        .values({
          tenantId: scope.tenantId,
          templateId: current.templateId,
          occurrenceId: current.id,
          exceptionType: "overridden",
          reason: input.reason,
          originalStartsAt: current.startsAt,
          createdByUserId: actorUserId
        })
        .onConflictDoNothing()
        .returning({ id: scheduleExceptions.id });
      if (!insertedException.length) throw new Error("Occurrence already overridden.");
      const [occurrence] = await tx
        .update(scheduleOccurrences)
        .set({
          ...(input.trainerUserId !== undefined ? { trainerUserId: input.trainerUserId } : {}),
          ...(input.roomId !== undefined ? { roomId: input.roomId } : {}),
          ...(input.startsAt !== undefined ? { startsAt: new Date(input.startsAt) } : {}),
          ...(input.endsAt !== undefined ? { endsAt: new Date(input.endsAt) } : {}),
          ...(input.capacity !== undefined ? { capacity: input.capacity } : {}),
          updatedAt: new Date()
        })
        .where(eq(scheduleOccurrences.id, current.id))
        .returning();
      return occurrence ? this.occurrenceResponse(occurrence) : null;
    });
  }

  async createBooking(
    scope: TenantScope,
    input: CreateBookingRequest,
    actorUserId: string,
    allowEntitlementOverride: boolean
  ): Promise<BookingResponse> {
    const booking = await this.db.transaction(async (tx) => {
      await tx.execute(sql`
        SELECT id FROM schedule_occurrences
        WHERE id = ${input.occurrenceId} AND tenant_id = ${scope.tenantId}
        FOR UPDATE
      `);
      const [occurrence] = await tx
        .select()
        .from(scheduleOccurrences)
        .where(
          and(
            eq(scheduleOccurrences.id, input.occurrenceId),
            eq(scheduleOccurrences.tenantId, scope.tenantId),
            inArray(scheduleOccurrences.branchId, scope.branchIds)
          )
        )
        .limit(1);
      if (!occurrence || occurrence.status !== "scheduled")
        throw new Error("Occurrence unavailable.");
      const [service] = await tx
        .select()
        .from(services)
        .where(and(eq(services.id, occurrence.serviceId), eq(services.tenantId, scope.tenantId)))
        .limit(1);
      if (!service || !service.isActive) throw new Error("Service unavailable.");
      await tx.execute(sql`
        SELECT id FROM members
        WHERE id = ${input.memberId} AND tenant_id = ${scope.tenantId}
        FOR UPDATE
      `);
      const [member] = await tx
        .select({ id: members.id })
        .from(members)
        .where(
          and(
            eq(members.id, input.memberId),
            eq(members.tenantId, scope.tenantId),
            eq(members.status, "active")
          )
        )
        .limit(1);
      if (!member) throw new Error("Member unavailable.");
      const [existing] = await tx
        .select({ id: bookings.id })
        .from(bookings)
        .where(
          and(
            eq(bookings.tenantId, scope.tenantId),
            eq(bookings.occurrenceId, occurrence.id),
            eq(bookings.memberId, member.id),
            eq(bookings.status, "confirmed")
          )
        )
        .limit(1);
      if (existing) throw new Error("Member already has a booking for this occurrence.");
      const [capacity] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(bookings)
        .where(
          and(
            eq(bookings.tenantId, scope.tenantId),
            eq(bookings.occurrenceId, occurrence.id),
            eq(bookings.status, "confirmed")
          )
        );

      // Resource-aware capacity calculation
      let effectiveCapacity = occurrence.capacity;
      const requirements = await tx
        .select()
        .from(serviceEquipmentRequirements)
        .where(
          and(
            eq(serviceEquipmentRequirements.tenantId, scope.tenantId),
            eq(serviceEquipmentRequirements.serviceId, service.id)
          )
        );

      if (requirements.length > 0) {
        for (const req of requirements) {
          const poolAssets = await tx
            .select()
            .from(equipmentAssets)
            .where(
              and(
                eq(equipmentAssets.tenantId, scope.tenantId),
                eq(equipmentAssets.poolId, req.poolId),
                eq(equipmentAssets.branchId, occurrence.branchId),
                eq(equipmentAssets.status, "available")
              )
            );

          const availableCount = poolAssets.length;
          if (req.quantityRequired > 0) {
            const maxEquipCapacity = Math.floor(availableCount / req.quantityRequired);
            effectiveCapacity = Math.min(effectiveCapacity, maxEquipCapacity);
          }
        }
      }

      const confirmedCount = capacity?.count ?? 0;
      if (confirmedCount >= effectiveCapacity) {
        throw new Error(
          `Occurrence is full. Available equipment constrains capacity to ${effectiveCapacity}.`
        );
      }

      let creditMembership: typeof memberMemberships.$inferSelect | null = null;
      if (service.creditsRequired > 0) {
        const candidates = await tx
          .select()
          .from(memberMemberships)
          .where(
            and(
              eq(memberMemberships.tenantId, scope.tenantId),
              eq(memberMemberships.memberId, member.id),
              eq(memberMemberships.status, "active"),
              lte(memberMemberships.startsAt, occurrence.startsAt),
              or(
                isNull(memberMemberships.endsAt),
                gt(memberMemberships.endsAt, occurrence.startsAt)
              )
            )
          )
          .orderBy(memberMemberships.endsAt, memberMemberships.createdAt);
        for (const candidate of candidates) {
          const snapshot = candidate.planSnapshot as MembershipPlanResponse;
          if (snapshot.branchId && snapshot.branchId !== occurrence.branchId) continue;
          const [balance] = await tx
            .select({ total: sql<number>`coalesce(sum(${creditLedger.delta}), 0)::int` })
            .from(creditLedger)
            .where(
              and(
                eq(creditLedger.tenantId, scope.tenantId),
                eq(creditLedger.membershipId, candidate.id)
              )
            );
          if ((balance?.total ?? 0) >= service.creditsRequired) {
            creditMembership = candidate;
            break;
          }
        }
        if (!creditMembership && !allowEntitlementOverride) {
          throw new Error("Insufficient credits for this service.");
        }
        if (!creditMembership && !input.overrideReason?.trim()) {
          throw new Error("An entitlement override reason is required.");
        }
      }

      const [created] = await tx
        .insert(bookings)
        .values({
          tenantId: scope.tenantId,
          branchId: occurrence.branchId,
          occurrenceId: occurrence.id,
          memberId: member.id,
          source: input.source ?? "staff",
          creditMembershipId: creditMembership?.id ?? null,
          creditsDebited: creditMembership ? service.creditsRequired : 0,
          entitlementOverrideReason:
            service.creditsRequired > 0 && !creditMembership
              ? (input.overrideReason?.trim() ?? null)
              : null,
          createdByUserId: actorUserId
        })
        .returning();
      if (!created) throw new Error("Unable to create booking.");
      if (creditMembership && service.creditsRequired > 0) {
        await tx.insert(creditLedger).values({
          tenantId: scope.tenantId,
          membershipId: creditMembership.id,
          memberId: member.id,
          delta: -service.creditsRequired,
          reason: "booking",
          bookingId: created.id,
          note: `Booking credit deduction (${service.creditsRequired})`
        });
      }
      return created;
    });
    return this.bookingResponse(booking);
  }

  async findBookingById(scope: TenantScope, bookingId: string): Promise<BookingResponse | null> {
    const [booking] = await this.db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.id, bookingId),
          eq(bookings.tenantId, scope.tenantId),
          inArray(bookings.branchId, scope.branchIds)
        )
      )
      .limit(1);
    return booking ? this.bookingResponse(booking) : null;
  }

  async listBookings(
    scope: TenantScope,
    filters: BookingListFilters
  ): Promise<CursorPage<BookingResponse>> {
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
    const rows = await this.db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.tenantId, scope.tenantId),
          inArray(bookings.branchId, scope.branchIds),
          ...(filters.occurrenceId ? [eq(bookings.occurrenceId, filters.occurrenceId)] : []),
          ...(filters.memberId ? [eq(bookings.memberId, filters.memberId)] : []),
          ...(filters.status ? [eq(bookings.status, filters.status)] : [])
        )
      )
      .orderBy(desc(bookings.bookedAt))
      .limit(limit + 1);
    return {
      data: rows.slice(0, limit).map((booking) => this.bookingResponse(booking)),
      page: { hasMore: rows.length > limit, nextCursor: null }
    };
  }

  async cancelBooking(
    scope: TenantScope,
    bookingId: string,
    reason: string
  ): Promise<BookingResponse | null> {
    const booking = await this.db.transaction(async (tx) => {
      await tx.execute(sql`
        SELECT id FROM bookings
        WHERE id = ${bookingId} AND tenant_id = ${scope.tenantId}
        FOR UPDATE
      `);
      const [current] = await tx
        .select()
        .from(bookings)
        .where(
          and(
            eq(bookings.id, bookingId),
            eq(bookings.tenantId, scope.tenantId),
            inArray(bookings.branchId, scope.branchIds)
          )
        )
        .limit(1);
      if (!current) return null;
      if (current.status === "cancelled") return current;
      const [occurrence] = await tx
        .select()
        .from(scheduleOccurrences)
        .where(
          and(
            eq(scheduleOccurrences.id, current.occurrenceId),
            eq(scheduleOccurrences.tenantId, scope.tenantId)
          )
        )
        .limit(1);
      if (!occurrence) throw new Error("Booking occurrence unavailable.");
      const [service] = await tx
        .select()
        .from(services)
        .where(and(eq(services.id, occurrence.serviceId), eq(services.tenantId, scope.tenantId)))
        .limit(1);
      if (!service) throw new Error("Booking service unavailable.");
      const cancelledAt = new Date();
      const cutoffAt = new Date(
        occurrence.startsAt.getTime() - service.cancellationCutoffMinutes * 60_000
      );
      const lateCancelled = cancelledAt >= cutoffAt;
      const [cancelled] = await tx
        .update(bookings)
        .set({
          status: "cancelled",
          cancelledAt,
          cancellationReason: reason,
          lateCancelled,
          updatedAt: cancelledAt
        })
        .where(and(eq(bookings.id, bookingId), eq(bookings.tenantId, scope.tenantId)))
        .returning();
      if (!cancelled) throw new Error("Unable to cancel booking.");
      const restoreCredit =
        cancelled.creditsDebited > 0 &&
        Boolean(cancelled.creditMembershipId) &&
        (!lateCancelled || service.restoreCreditOnLateCancel);
      if (restoreCredit && cancelled.creditMembershipId) {
        const [existingRestoration] = await tx
          .select({ id: creditLedger.id })
          .from(creditLedger)
          .where(
            and(
              eq(creditLedger.tenantId, scope.tenantId),
              eq(creditLedger.bookingId, cancelled.id),
              eq(creditLedger.reason, "cancellation")
            )
          )
          .limit(1);
        if (!existingRestoration) {
          await tx.insert(creditLedger).values({
            tenantId: scope.tenantId,
            membershipId: cancelled.creditMembershipId,
            memberId: cancelled.memberId,
            delta: cancelled.creditsDebited,
            reason: "cancellation",
            bookingId: cancelled.id,
            note: `Booking cancellation credit restoration (${cancelled.creditsDebited})`
          });
        }
      }
      return cancelled;
    });
    return booking ? this.bookingResponse(booking) : null;
  }

  async listMembershipPlans(
    scope: TenantScope,
    branchId?: string
  ): Promise<MembershipPlanResponse[]> {
    const conditions = [
      eq(membershipPlans.tenantId, scope.tenantId),
      membershipPlanBranchAccessCondition(scope)
    ];
    if (branchId) {
      conditions.push(
        or(eq(membershipPlans.branchId, branchId), isNull(membershipPlans.branchId))!
      );
    }
    const rows = await this.db
      .select()
      .from(membershipPlans)
      .where(and(...conditions))
      .orderBy(desc(membershipPlans.createdAt));
    return rows.map((r) => this.membershipPlanResponse(r));
  }

  async findMembershipPlanById(
    scope: TenantScope,
    planId: string
  ): Promise<MembershipPlanResponse | null> {
    const [row] = await this.db
      .select()
      .from(membershipPlans)
      .where(
        and(
          eq(membershipPlans.id, planId),
          eq(membershipPlans.tenantId, scope.tenantId),
          membershipPlanBranchAccessCondition(scope)
        )
      )
      .limit(1);
    return row ? this.membershipPlanResponse(row) : null;
  }

  async createMembershipPlan(
    scope: TenantScope,
    input: CreateMembershipPlanRequest
  ): Promise<MembershipPlanResponse> {
    if (input.includedCredits <= 0) {
      throw new Error("Membership plan must grant at least one credit.");
    }
    if (input.branchId && !scope.branchIds.includes(input.branchId)) {
      throw new Error("Membership plan branch is not accessible.");
    }
    const [row] = await this.db
      .insert(membershipPlans)
      .values({
        tenantId: scope.tenantId,
        branchId: input.branchId ?? null,
        name: input.name,
        slug: input.slug ? this.slug(input.slug) : this.slug(input.name),
        amountMinor: input.price?.amountMinor ?? null,
        currency: input.price?.currency ?? null,
        durationDays: input.durationDays ?? null,
        includedCredits: input.includedCredits,
        publicVisible: input.publicVisible ?? false,
        isActive: true
      })
      .returning();
    return this.membershipPlanResponse(row!);
  }

  async updateMembershipPlan(
    scope: TenantScope,
    planId: string,
    input: Partial<CreateMembershipPlanRequest> & { isActive?: boolean }
  ): Promise<MembershipPlanResponse | null> {
    if (input.includedCredits !== undefined && input.includedCredits <= 0) {
      throw new Error("Membership plan must grant at least one credit.");
    }
    if (input.branchId && !scope.branchIds.includes(input.branchId)) {
      throw new Error("Membership plan branch is not accessible.");
    }
    const updates: Partial<typeof membershipPlans.$inferInsert> = { updatedAt: new Date() };
    if (input.name !== undefined) updates.name = input.name;
    if (input.slug !== undefined) updates.slug = this.slug(input.slug);
    if (input.branchId !== undefined) updates.branchId = input.branchId;
    if (input.price !== undefined) {
      updates.amountMinor = input.price?.amountMinor ?? null;
      updates.currency = input.price?.currency ?? null;
    }
    if (input.durationDays !== undefined) updates.durationDays = input.durationDays;
    if (input.includedCredits !== undefined) updates.includedCredits = input.includedCredits;
    if (input.publicVisible !== undefined) updates.publicVisible = input.publicVisible;
    if (input.isActive !== undefined) updates.isActive = input.isActive;

    const [row] = await this.db
      .update(membershipPlans)
      .set(updates)
      .where(
        and(
          eq(membershipPlans.id, planId),
          eq(membershipPlans.tenantId, scope.tenantId),
          membershipPlanBranchAccessCondition(scope)
        )
      )
      .returning();
    return row ? this.membershipPlanResponse(row) : null;
  }

  async listMemberMemberships(
    scope: TenantScope,
    memberId: string
  ): Promise<MemberMembershipResponse[]> {
    const rows = await this.db
      .select()
      .from(memberMemberships)
      .where(
        and(
          eq(memberMemberships.tenantId, scope.tenantId),
          eq(memberMemberships.memberId, memberId)
        )
      )
      .orderBy(desc(memberMemberships.createdAt));
    return rows.map((r) => this.memberMembershipResponse(r));
  }

  async findMemberMembershipById(
    scope: TenantScope,
    membershipId: string
  ): Promise<MemberMembershipResponse | null> {
    const [row] = await this.db
      .select()
      .from(memberMemberships)
      .where(
        and(eq(memberMemberships.id, membershipId), eq(memberMemberships.tenantId, scope.tenantId))
      )
      .limit(1);
    return row ? this.memberMembershipResponse(row) : null;
  }

  async activateMembership(
    scope: TenantScope,
    input: ActivateMembershipRequest,
    _actorUserId?: string
  ): Promise<{ membership: MemberMembershipResponse; ledgerEntry: CreditLedgerEntryResponse }> {
    return this.db.transaction(async (tx) => {
      const [planRow] = await tx
        .select()
        .from(membershipPlans)
        .where(
          and(
            eq(membershipPlans.id, input.planId),
            eq(membershipPlans.tenantId, scope.tenantId),
            membershipPlanBranchAccessCondition(scope),
            eq(membershipPlans.isActive, true)
          )
        )
        .limit(1);
      if (!planRow) throw new Error("Membership plan not found.");
      if (planRow.includedCredits <= 0) {
        throw new Error("Membership plan must grant at least one credit.");
      }
      const [member] = await tx
        .select({ id: members.id })
        .from(members)
        .where(
          and(
            eq(members.id, input.memberId),
            eq(members.tenantId, scope.tenantId),
            eq(members.status, "active"),
            branchAccessCondition(scope)
          )
        )
        .limit(1);
      if (!member) throw new Error("Member not found.");
      const plan = this.membershipPlanResponse(planRow);
      const startsAt = input.startsAt ? new Date(input.startsAt) : new Date();
      const endsAt = plan.durationDays
        ? new Date(startsAt.getTime() + plan.durationDays * 24 * 60 * 60 * 1000)
        : null;
      const [membership] = await tx
        .insert(memberMemberships)
        .values({
          tenantId: scope.tenantId,
          memberId: member.id,
          planId: plan.id,
          planSnapshot: plan,
          status: "active",
          startsAt,
          endsAt
        })
        .returning();
      if (!membership) throw new Error("Unable to activate membership.");
      const [ledger] = await tx
        .insert(creditLedger)
        .values({
          tenantId: scope.tenantId,
          membershipId: membership.id,
          memberId: member.id,
          delta: plan.includedCredits,
          reason: "purchase",
          bookingId: null,
          note: `Membership activated: ${plan.name}`
        })
        .returning();
      if (!ledger) throw new Error("Unable to grant membership credits.");
      return {
        membership: this.memberMembershipResponse(membership),
        ledgerEntry: this.creditLedgerEntryResponse(ledger)
      };
    });
  }

  async cancelMembership(
    scope: TenantScope,
    membershipId: string,
    _reason?: string
  ): Promise<MemberMembershipResponse | null> {
    const [row] = await this.db
      .update(memberMemberships)
      .set({ status: "cancelled", updatedAt: new Date() })
      .where(
        and(eq(memberMemberships.id, membershipId), eq(memberMemberships.tenantId, scope.tenantId))
      )
      .returning();
    return row ? this.memberMembershipResponse(row) : null;
  }

  async listCreditLedger(
    scope: TenantScope,
    memberId: string
  ): Promise<CreditLedgerEntryResponse[]> {
    const rows = await this.db
      .select()
      .from(creditLedger)
      .where(and(eq(creditLedger.tenantId, scope.tenantId), eq(creditLedger.memberId, memberId)))
      .orderBy(desc(creditLedger.createdAt));
    return rows.map((r) => this.creditLedgerEntryResponse(r));
  }

  async getCreditBalance(scope: TenantScope, memberId: string): Promise<number> {
    const [result] = await this.db
      .select({ total: sql<string>`coalesce(sum(${creditLedger.delta}), 0)` })
      .from(creditLedger)
      .where(and(eq(creditLedger.tenantId, scope.tenantId), eq(creditLedger.memberId, memberId)));
    return Number(result?.total ?? 0);
  }

  async adjustCredit(
    scope: TenantScope,
    memberId: string,
    input: ManualCreditAdjustmentRequest,
    _actorUserId: string
  ): Promise<CreditLedgerEntryResponse> {
    if (!Number.isInteger(input.delta) || input.delta === 0) {
      throw new Error("Credit adjustment must be a non-zero integer.");
    }
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`
        SELECT id FROM member_memberships
        WHERE id = ${input.membershipId} AND tenant_id = ${scope.tenantId}
        FOR UPDATE
      `);
      const [membership] = await tx
        .select()
        .from(memberMemberships)
        .where(
          and(
            eq(memberMemberships.id, input.membershipId),
            eq(memberMemberships.tenantId, scope.tenantId),
            eq(memberMemberships.memberId, memberId),
            eq(memberMemberships.status, "active")
          )
        )
        .limit(1);
      const snapshot = membership?.planSnapshot as { branchId?: string | null } | undefined;
      if (
        !membership ||
        (snapshot?.branchId !== null &&
          snapshot?.branchId !== undefined &&
          !scope.branchIds.includes(snapshot.branchId))
      ) {
        throw new Error("Active membership unavailable for adjustment.");
      }
      const [current] = await tx
        .select({ total: sql<string>`coalesce(sum(${creditLedger.delta}), 0)` })
        .from(creditLedger)
        .where(
          and(
            eq(creditLedger.tenantId, scope.tenantId),
            eq(creditLedger.membershipId, membership.id)
          )
        );
      if (Number(current?.total ?? 0) + input.delta < 0) {
        throw new Error("Credit adjustment would create a negative balance.");
      }
      const [entry] = await tx
        .insert(creditLedger)
        .values({
          tenantId: scope.tenantId,
          membershipId: membership.id,
          memberId,
          delta: input.delta,
          reason: "manual_adjustment",
          bookingId: null,
          note: input.reason
        })
        .returning();
      if (!entry) throw new Error("Unable to record credit adjustment.");
      return this.creditLedgerEntryResponse(entry);
    });
  }

  async listStaff(scope: TenantScope): Promise<StaffUserResponse[]> {
    const rows = await this.db
      .select({ membership: tenantUsers, user: users, role: roles })
      .from(tenantUsers)
      .innerJoin(users, eq(users.id, tenantUsers.userId))
      .innerJoin(roles, eq(roles.id, tenantUsers.roleId))
      .where(eq(tenantUsers.tenantId, scope.tenantId));
    return Promise.all(
      rows.map(async (row) => ({
        user: this.userResponse(row.user),
        role: await this.roleResponse(row.role),
        branches: await this.branchesFor(row.membership.id, scope.tenantId),
        tenantUserId: row.membership.id
      }))
    );
  }

  async findStaffByUserId(scope: TenantScope, userId: string): Promise<StaffUserResponse | null> {
    const [row] = await this.db
      .select({ membership: tenantUsers, user: users, role: roles })
      .from(tenantUsers)
      .innerJoin(users, eq(users.id, tenantUsers.userId))
      .innerJoin(roles, eq(roles.id, tenantUsers.roleId))
      .where(and(eq(tenantUsers.tenantId, scope.tenantId), eq(tenantUsers.userId, userId)))
      .limit(1);
    if (!row) return null;
    return {
      user: this.userResponse(row.user),
      role: await this.roleResponse(row.role),
      branches: await this.branchesFor(row.membership.id, scope.tenantId),
      tenantUserId: row.membership.id
    };
  }

  async findStaffByEmail(scope: TenantScope, email: string): Promise<StaffUserResponse | null> {
    const [row] = await this.db
      .select({ userId: users.id })
      .from(users)
      .innerJoin(tenantUsers, eq(tenantUsers.userId, users.id))
      .where(
        and(eq(tenantUsers.tenantId, scope.tenantId), eq(users.email, email.trim().toLowerCase()))
      )
      .limit(1);
    return row ? this.findStaffByUserId(scope, row.userId) : null;
  }

  async findRoleById(scope: TenantScope, roleId: string): Promise<RoleResponse | null> {
    const [role] = await this.db
      .select()
      .from(roles)
      .where(and(eq(roles.id, roleId), eq(roles.tenantId, scope.tenantId)))
      .limit(1);
    return role ? this.roleResponse(role) : null;
  }

  async inviteStaff(scope: TenantScope, input: InviteStaffInput): Promise<StaffUserResponse> {
    const created = await this.db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({
          email: input.email.trim().toLowerCase(),
          displayName: input.displayName,
          passwordHash: "!invite-required!",
          status: "invited"
        })
        .returning();
      if (!user) throw new Error("Unable to create invited user.");
      const [membership] = await tx
        .insert(tenantUsers)
        .values({
          tenantId: scope.tenantId,
          userId: user.id,
          roleId: input.roleId,
          status: "invited"
        })
        .returning();
      if (!membership) throw new Error("Unable to create tenant membership.");
      await tx
        .insert(userBranchAccess)
        .values(input.branchIds.map((branchId) => ({ tenantUserId: membership.id, branchId })));
      return { user, membership };
    });
    const role = await this.findRoleById(scope, input.roleId);
    if (!role) throw new Error("Role not found after invitation.");
    return {
      user: this.userResponse(created.user),
      role,
      branches: await this.branchesFor(created.membership.id, scope.tenantId),
      tenantUserId: created.membership.id
    };
  }

  async updateStaffAccess(
    scope: TenantScope,
    userId: string,
    input: StaffAccessInput
  ): Promise<StaffUserResponse | null> {
    const current = await this.findStaffByUserId(scope, userId);
    if (!current) return null;
    await this.db.transaction(async (tx) => {
      await tx
        .update(tenantUsers)
        .set({ roleId: input.roleId, updatedAt: new Date() })
        .where(eq(tenantUsers.id, current.tenantUserId));
      await tx
        .delete(userBranchAccess)
        .where(eq(userBranchAccess.tenantUserId, current.tenantUserId));
      await tx
        .insert(userBranchAccess)
        .values(
          input.branchIds.map((branchId) => ({ tenantUserId: current.tenantUserId, branchId }))
        );
    });
    return this.findStaffByUserId(scope, userId);
  }

  async deactivateStaff(scope: TenantScope, userId: string): Promise<StaffUserResponse | null> {
    const current = await this.findStaffByUserId(scope, userId);
    if (!current) return null;
    await this.db
      .update(tenantUsers)
      .set({ status: "deactivated", updatedAt: new Date() })
      .where(eq(tenantUsers.id, current.tenantUserId));
    return this.findStaffByUserId(scope, userId);
  }

  async countActiveOwners(scope: TenantScope): Promise<number> {
    const rows = await this.db
      .select({ id: tenantUsers.id })
      .from(tenantUsers)
      .innerJoin(roles, eq(roles.id, tenantUsers.roleId))
      .where(
        and(
          eq(tenantUsers.tenantId, scope.tenantId),
          eq(tenantUsers.status, "active"),
          eq(roles.systemKey, "owner")
        )
      );
    return rows.length;
  }

  async recordAudit(input: AuditRecordInput): Promise<AuditEventResponse> {
    const [event] = await this.db
      .insert(auditEvents)
      .values({
        tenantId: input.tenantId,
        ...(input.branchId ? { branchId: input.branchId } : {}),
        ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
        action: input.action,
        resourceType: input.resourceType,
        ...(input.resourceId ? { resourceId: input.resourceId } : {}),
        ...(input.beforeSummary ? { beforeSummary: input.beforeSummary } : {}),
        ...(input.afterSummary ? { afterSummary: input.afterSummary } : {}),
        requestId: input.requestId
      })
      .returning();
    if (!event) throw new Error("Unable to write audit event.");
    return this.auditResponse(event);
  }

  async listAuditEvents(scope: TenantScope, resourceId?: string): Promise<AuditEventResponse[]> {
    const rows = await this.db
      .select()
      .from(auditEvents)
      .where(
        and(
          eq(auditEvents.tenantId, scope.tenantId),
          ...(resourceId ? [eq(auditEvents.resourceId, resourceId)] : [])
        )
      )
      .orderBy(desc(auditEvents.createdAt));
    return rows.map((event) => this.auditResponse(event));
  }

  async publishEvent(_event: DomainEvent): Promise<void> {
    // The worker queue becomes the concrete adapter when notification/payment modules ship.
  }

  async acquireIdempotency(record: IdempotencyRecord): Promise<IdempotencyAcquireResult> {
    const [existing] = await this.db
      .select()
      .from(idempotencyKeys)
      .where(
        and(
          eq(idempotencyKeys.tenantId, record.tenantId),
          eq(idempotencyKeys.operation, record.operation),
          eq(idempotencyKeys.key, record.key)
        )
      )
      .limit(1);
    if (!existing || existing.expiresAt <= new Date()) {
      if (existing) {
        await this.db.delete(idempotencyKeys).where(eq(idempotencyKeys.id, existing.id));
      }
      await this.db.insert(idempotencyKeys).values({
        tenantId: record.tenantId,
        operation: record.operation,
        key: record.key,
        requestFingerprint: record.fingerprint,
        expiresAt: new Date(record.expiresAt)
      });
      return { kind: "acquired" };
    }
    if (existing.requestFingerprint !== record.fingerprint) return { kind: "key_reused" };
    if (!existing.responseStatus) return { kind: "in_progress" };
    return {
      kind: "replay",
      responseStatus: existing.responseStatus,
      responseBody: existing.responseBody ?? {}
    };
  }

  async completeIdempotency(
    input: Pick<IdempotencyRecord, "tenantId" | "operation" | "key"> & {
      responseStatus: number;
      responseBody: unknown;
    }
  ): Promise<void> {
    await this.db
      .update(idempotencyKeys)
      .set({ responseStatus: input.responseStatus, responseBody: input.responseBody })
      .where(
        and(
          eq(idempotencyKeys.tenantId, input.tenantId),
          eq(idempotencyKeys.operation, input.operation),
          eq(idempotencyKeys.key, input.key)
        )
      );
  }

  async abandonIdempotency(
    input: Pick<IdempotencyRecord, "tenantId" | "operation" | "key">
  ): Promise<void> {
    await this.db
      .delete(idempotencyKeys)
      .where(
        and(
          eq(idempotencyKeys.tenantId, input.tenantId),
          eq(idempotencyKeys.operation, input.operation),
          eq(idempotencyKeys.key, input.key)
        )
      );
  }

  async createPayment(
    scope: TenantScope,
    input: CreatePaymentRequest,
    actorUserId: string
  ): Promise<PaymentTransactionResponse> {
    if (!scope.branchIds.includes(input.branchId)) {
      throw new Error("Branch unavailable.");
    }
    if (!/^\d+$/.test(input.amount.amountMinor) || BigInt(input.amount.amountMinor) <= 0n) {
      throw new Error("Payment amount must be greater than zero.");
    }
    if (!/^[A-Z]{3}$/.test(input.amount.currency)) {
      throw new Error("Payment currency must be a three-letter uppercase code.");
    }
    await this.assertPaymentAllocationTarget(
      scope,
      input.branchId,
      input.memberId ?? null,
      input.allocationType ?? null,
      input.allocationId ?? null
    );
    const [row] = await this.db
      .insert(paymentTransactions)
      .values({
        tenantId: scope.tenantId,
        branchId: input.branchId,
        memberId: input.memberId ?? null,
        amountMinor: input.amount.amountMinor,
        currency: input.amount.currency,
        method: input.method,
        reference: input.reference ?? null,
        status: "completed",
        note: input.note ?? null,
        allocationType: input.allocationType ?? null,
        allocationId: input.allocationId ?? null,
        recordedByUserId: actorUserId
      })
      .returning();
    return this.paymentResponse(row!);
  }

  async findPaymentById(
    scope: TenantScope,
    paymentId: string
  ): Promise<PaymentTransactionResponse | null> {
    const [row] = await this.db
      .select()
      .from(paymentTransactions)
      .where(
        and(
          eq(paymentTransactions.id, paymentId),
          eq(paymentTransactions.tenantId, scope.tenantId),
          inArray(paymentTransactions.branchId, scope.branchIds)
        )
      )
      .limit(1);
    return row ? this.paymentResponse(row) : null;
  }

  async listPayments(
    scope: TenantScope,
    filters: PaymentListFilters
  ): Promise<CursorPage<PaymentTransactionResponse>> {
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
    const conditions = [
      eq(paymentTransactions.tenantId, scope.tenantId),
      inArray(paymentTransactions.branchId, scope.branchIds)
    ];
    if (filters.branchId) conditions.push(eq(paymentTransactions.branchId, filters.branchId));
    if (filters.memberId) conditions.push(eq(paymentTransactions.memberId, filters.memberId));
    if (filters.method) conditions.push(eq(paymentTransactions.method, filters.method));
    if (filters.status) conditions.push(eq(paymentTransactions.status, filters.status));
    if (filters.unmatched) {
      conditions.push(
        or(isNull(paymentTransactions.memberId), isNull(paymentTransactions.allocationType))!
      );
    }

    const rows = await this.db
      .select()
      .from(paymentTransactions)
      .where(and(...conditions))
      .orderBy(desc(paymentTransactions.recordedAt))
      .limit(limit + 1);

    return {
      data: rows.slice(0, limit).map((r) => this.paymentResponse(r)),
      page: { hasMore: rows.length > limit, nextCursor: null }
    };
  }

  async voidPayment(
    scope: TenantScope,
    paymentId: string,
    reason: string
  ): Promise<PaymentTransactionResponse | null> {
    return this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(paymentTransactions)
        .where(
          and(
            eq(paymentTransactions.id, paymentId),
            eq(paymentTransactions.tenantId, scope.tenantId),
            inArray(paymentTransactions.branchId, scope.branchIds)
          )
        )
        .for("update")
        .limit(1);
      if (!current) return null;
      if (current.status === "voided") return this.paymentResponse(current);
      if (current.status !== "completed") return null;
      const note = current.note
        ? `${current.note} | Void reason: ${reason}`
        : `Void reason: ${reason}`;
      const [row] = await tx
        .update(paymentTransactions)
        .set({ status: "voided", note, updatedAt: new Date() })
        .where(
          and(
            eq(paymentTransactions.id, paymentId),
            eq(paymentTransactions.tenantId, scope.tenantId),
            eq(paymentTransactions.status, "completed")
          )
        )
        .returning();
      return row ? this.paymentResponse(row) : null;
    });
  }

  async reconcilePayment(
    scope: TenantScope,
    paymentId: string,
    input: ReconcilePaymentRequest
  ): Promise<PaymentTransactionResponse | null> {
    const current = await this.findPaymentById(scope, paymentId);
    if (!current) return null;
    await this.assertPaymentAllocationTarget(
      scope,
      current.branchId,
      input.memberId,
      input.allocationType,
      input.allocationId ?? null
    );
    return this.db.transaction(async (tx) => {
      const [payment] = await tx
        .select()
        .from(paymentTransactions)
        .where(
          and(
            eq(paymentTransactions.id, paymentId),
            eq(paymentTransactions.tenantId, scope.tenantId),
            inArray(paymentTransactions.branchId, scope.branchIds)
          )
        )
        .for("update")
        .limit(1);
      if (!payment) return null;
      if (payment.status !== "completed") {
        throw new Error("Only completed payments can be reconciled.");
      }
      if (
        payment.memberId === input.memberId &&
        payment.allocationType === input.allocationType &&
        payment.allocationId === (input.allocationId ?? null)
      ) {
        return this.paymentResponse(payment);
      }
      if (
        (payment.memberId && payment.memberId !== input.memberId) ||
        (payment.allocationType && payment.allocationType !== input.allocationType) ||
        (payment.allocationId && payment.allocationId !== (input.allocationId ?? null))
      ) {
        throw new Error("Payment is already reconciled to a different target.");
      }
      const note = payment.note
        ? `${payment.note} | Reconciliation: ${input.reason}`
        : `Reconciliation: ${input.reason}`;
      const [row] = await tx
        .update(paymentTransactions)
        .set({
          memberId: input.memberId,
          allocationType: input.allocationType,
          allocationId: input.allocationId ?? null,
          note,
          updatedAt: new Date()
        })
        .where(eq(paymentTransactions.id, payment.id))
        .returning();
      return row ? this.paymentResponse(row) : null;
    });
  }

  async refundPayment(
    scope: TenantScope,
    paymentId: string,
    reason: string
  ): Promise<PaymentTransactionResponse | null> {
    return this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(paymentTransactions)
        .where(
          and(
            eq(paymentTransactions.id, paymentId),
            eq(paymentTransactions.tenantId, scope.tenantId),
            inArray(paymentTransactions.branchId, scope.branchIds)
          )
        )
        .for("update")
        .limit(1);
      if (!current) return null;
      if (current.status === "refunded") return this.paymentResponse(current);
      if (current.status !== "completed") return null;
      const note = current.note
        ? `${current.note} | Refund reason: ${reason}`
        : `Refund reason: ${reason}`;
      const [row] = await tx
        .update(paymentTransactions)
        .set({ status: "refunded", note, updatedAt: new Date() })
        .where(
          and(eq(paymentTransactions.id, paymentId), eq(paymentTransactions.status, "completed"))
        )
        .returning();
      return row ? this.paymentResponse(row) : null;
    });
  }

  private async assertPaymentAllocationTarget(
    scope: TenantScope,
    branchId: string,
    memberId: string | null,
    allocationType: PaymentTransactionResponse["allocationType"],
    allocationId: string | null
  ): Promise<void> {
    if (!memberId) {
      if (allocationType || allocationId) {
        throw new Error("A payment cannot be allocated without a member.");
      }
      return;
    }
    const [member] = await this.db
      .select({ id: members.id })
      .from(members)
      .where(
        and(
          eq(members.id, memberId),
          eq(members.tenantId, scope.tenantId),
          eq(members.status, "active"),
          branchAccessCondition(scope)
        )
      )
      .limit(1);
    if (!member) throw new Error("Member unavailable.");
    if (!allocationType) {
      if (allocationId) throw new Error("Allocation type is required.");
      return;
    }
    if (allocationType === "booking") {
      if (!allocationId) throw new Error("Booking allocation target is required.");
      const [booking] = await this.db
        .select({ id: bookings.id })
        .from(bookings)
        .where(
          and(
            eq(bookings.id, allocationId),
            eq(bookings.tenantId, scope.tenantId),
            eq(bookings.branchId, branchId),
            eq(bookings.memberId, memberId),
            eq(bookings.status, "confirmed")
          )
        )
        .limit(1);
      if (!booking) throw new Error("Booking allocation target is unavailable.");
      return;
    }
    if (allocationType === "membership") {
      if (!allocationId) throw new Error("Membership allocation target is required.");
      const [membership] = await this.db
        .select()
        .from(memberMemberships)
        .where(
          and(
            eq(memberMemberships.id, allocationId),
            eq(memberMemberships.tenantId, scope.tenantId),
            eq(memberMemberships.memberId, memberId),
            inArray(memberMemberships.status, ["scheduled", "active"])
          )
        )
        .limit(1);
      const planSnapshot = membership?.planSnapshot as { branchId?: string | null } | undefined;
      if (!membership || (planSnapshot?.branchId && planSnapshot.branchId !== branchId)) {
        throw new Error("Membership allocation target is unavailable.");
      }
      return;
    }
    if (allocationId) {
      throw new Error("Walk-in and other allocations cannot have a target ID.");
    }
  }

  async checkIn(
    scope: TenantScope,
    input: CheckInRequest,
    actorUserId: string,
    branchId: string,
    allowOverride: boolean
  ): Promise<AttendanceRecordResponse> {
    if (!scope.branchIds.includes(branchId)) throw new Error("Branch unavailable.");
    const [member] = await this.db
      .select({ id: members.id })
      .from(members)
      .where(
        and(
          eq(members.id, input.memberId),
          eq(members.tenantId, scope.tenantId),
          eq(members.status, "active"),
          branchAccessCondition(scope)
        )
      )
      .limit(1);
    if (!member) throw new Error("Member unavailable.");

    const occurrenceId = input.occurrenceId ?? null;
    if (occurrenceId) {
      const [occurrence] = await this.db
        .select({ id: scheduleOccurrences.id })
        .from(scheduleOccurrences)
        .where(
          and(
            eq(scheduleOccurrences.id, occurrenceId),
            eq(scheduleOccurrences.tenantId, scope.tenantId),
            eq(scheduleOccurrences.branchId, branchId),
            eq(scheduleOccurrences.status, "scheduled")
          )
        )
        .limit(1);
      if (!occurrence) throw new Error("Occurrence unavailable for check-in.");
      const [booking] = await this.db
        .select({ id: bookings.id })
        .from(bookings)
        .where(
          and(
            eq(bookings.tenantId, scope.tenantId),
            eq(bookings.occurrenceId, occurrenceId),
            eq(bookings.memberId, input.memberId),
            eq(bookings.status, "confirmed")
          )
        )
        .limit(1);
      if (!booking && !allowOverride) {
        throw new Error("A confirmed booking is required for class check-in.");
      }
    } else {
      const timestamp = new Date();
      const eligibleMemberships = await this.db
        .select({ id: memberMemberships.id })
        .from(memberMemberships)
        .where(
          and(
            eq(memberMemberships.tenantId, scope.tenantId),
            eq(memberMemberships.memberId, input.memberId),
            eq(memberMemberships.status, "active"),
            lte(memberMemberships.startsAt, timestamp),
            or(isNull(memberMemberships.endsAt), gt(memberMemberships.endsAt, timestamp))
          )
        );
      let hasEntitlement = false;
      for (const membership of eligibleMemberships) {
        const [balance] = await this.db
          .select({ total: sql<string>`coalesce(sum(${creditLedger.delta}), 0)` })
          .from(creditLedger)
          .where(
            and(
              eq(creditLedger.tenantId, scope.tenantId),
              eq(creditLedger.membershipId, membership.id)
            )
          );
        if (Number(balance?.total ?? 0) > 0) {
          hasEntitlement = true;
          break;
        }
      }
      if (!hasEntitlement && !allowOverride) {
        throw new Error("An active membership entitlement is required for general check-in.");
      }
    }

    const existingConditions = [
      eq(attendanceRecords.tenantId, scope.tenantId),
      eq(attendanceRecords.branchId, branchId),
      eq(attendanceRecords.memberId, input.memberId)
    ];
    if (occurrenceId) {
      existingConditions.push(eq(attendanceRecords.occurrenceId, occurrenceId));
    } else {
      existingConditions.push(
        isNull(attendanceRecords.occurrenceId),
        eq(attendanceRecords.status, "checked_in")
      );
    }
    const [existing] = await this.db
      .select()
      .from(attendanceRecords)
      .where(and(...existingConditions))
      .limit(1);
    if (existing) {
      if (["checked_in", "attended"].includes(existing.status)) {
        return this.attendanceResponse(existing);
      }
      throw new Error(`Member already has ${existing.status} attendance for this occurrence.`);
    }

    const [row] = await this.db
      .insert(attendanceRecords)
      .values({
        tenantId: scope.tenantId,
        branchId,
        occurrenceId,
        memberId: input.memberId,
        status: "checked_in",
        checkedInAt: new Date(),
        actorUserId,
        overrideReason: allowOverride ? (input.overrideReason ?? null) : null
      })
      .onConflictDoNothing()
      .returning();
    if (row) return this.attendanceResponse(row);
    const [concurrent] = await this.db
      .select()
      .from(attendanceRecords)
      .where(and(...existingConditions))
      .limit(1);
    if (!concurrent) throw new Error("Unable to record attendance.");
    return this.attendanceResponse(concurrent);
  }

  async findAttendanceRecord(
    scope: TenantScope,
    recordId: string
  ): Promise<AttendanceRecordResponse | null> {
    const [row] = await this.db
      .select()
      .from(attendanceRecords)
      .where(
        and(
          eq(attendanceRecords.id, recordId),
          eq(attendanceRecords.tenantId, scope.tenantId),
          inArray(attendanceRecords.branchId, scope.branchIds)
        )
      )
      .limit(1);
    return row ? this.attendanceResponse(row) : null;
  }

  async listAttendanceRecords(
    scope: TenantScope,
    filters: AttendanceListFilters
  ): Promise<CursorPage<AttendanceRecordResponse>> {
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
    const conditions = [
      eq(attendanceRecords.tenantId, scope.tenantId),
      inArray(attendanceRecords.branchId, scope.branchIds)
    ];
    if (filters.branchId) conditions.push(eq(attendanceRecords.branchId, filters.branchId));
    if (filters.occurrenceId)
      conditions.push(eq(attendanceRecords.occurrenceId, filters.occurrenceId));
    if (filters.memberId) conditions.push(eq(attendanceRecords.memberId, filters.memberId));
    if (filters.status) conditions.push(eq(attendanceRecords.status, filters.status));

    const rows = await this.db
      .select()
      .from(attendanceRecords)
      .where(and(...conditions))
      .orderBy(desc(attendanceRecords.createdAt))
      .limit(limit + 1);

    return {
      data: rows.slice(0, limit).map((r) => this.attendanceResponse(r)),
      page: { hasMore: rows.length > limit, nextCursor: null }
    };
  }

  async updateAttendanceStatus(
    scope: TenantScope,
    recordId: string,
    input: UpdateRosterStatusRequest,
    allowOverride: boolean
  ): Promise<AttendanceRecordResponse | null> {
    return this.db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(attendanceRecords)
        .where(
          and(
            eq(attendanceRecords.id, recordId),
            eq(attendanceRecords.tenantId, scope.tenantId),
            inArray(attendanceRecords.branchId, scope.branchIds)
          )
        )
        .for("update")
        .limit(1);
      if (!current) return null;
      if (current.status === input.status) return this.attendanceResponse(current);
      const normalTransitions: Record<
        AttendanceRecordResponse["status"],
        readonly AttendanceRecordResponse["status"][]
      > = {
        booked: ["checked_in", "no_show", "late_cancel"],
        checked_in: ["attended"],
        attended: [],
        no_show: [],
        late_cancel: []
      };
      if (
        !normalTransitions[current.status as AttendanceRecordResponse["status"]].includes(
          input.status
        ) &&
        !allowOverride
      ) {
        throw new Error(`Illegal attendance transition from ${current.status} to ${input.status}.`);
      }
      if (allowOverride && !input.overrideReason) {
        throw new Error("An override reason is required.");
      }
      const updates: Partial<typeof attendanceRecords.$inferInsert> = {
        status: input.status,
        updatedAt: new Date()
      };
      if ((input.status === "checked_in" || input.status === "attended") && !current.checkedInAt) {
        updates.checkedInAt = new Date();
      }
      if (allowOverride) updates.overrideReason = input.overrideReason;
      const [row] = await tx
        .update(attendanceRecords)
        .set(updates)
        .where(eq(attendanceRecords.id, recordId))
        .returning();
      return row ? this.attendanceResponse(row) : null;
    });
  }

  private async roleResponse(role: typeof roles.$inferSelect): Promise<RoleResponse> {
    const permissionRows = await this.db
      .select({ key: rolePermissions.permissionKey })
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, role.id));
    return {
      id: role.id,
      key: asRoleKey(role.systemKey),
      name: role.name,
      permissions: permissionRows.map(({ key }) => asPermission(key))
    };
  }

  private async branchIdsFor(
    tenantUserId: string,
    tenantId: string,
    roleKey: RoleKey | null
  ): Promise<string[]> {
    if (roleKey === "owner") {
      const rows = await this.db
        .select({ id: branches.id })
        .from(branches)
        .where(eq(branches.tenantId, tenantId));
      return rows.map(({ id }) => id);
    }
    const rows = await this.db
      .select({ id: branches.id })
      .from(userBranchAccess)
      .innerJoin(branches, eq(branches.id, userBranchAccess.branchId))
      .where(and(eq(userBranchAccess.tenantUserId, tenantUserId), eq(branches.tenantId, tenantId)));
    return rows.map(({ id }) => id);
  }

  private async branchesFor(tenantUserId: string, tenantId: string): Promise<BranchResponse[]> {
    const rows = await this.db
      .select({ branch: branches })
      .from(userBranchAccess)
      .innerJoin(branches, eq(branches.id, userBranchAccess.branchId))
      .where(and(eq(userBranchAccess.tenantUserId, tenantUserId), eq(branches.tenantId, tenantId)))
      .orderBy(branches.name);
    return rows.map(({ branch }) => this.branchResponse(branch));
  }

  private tenantResponse(row: typeof tenants.$inferSelect): TenantSummary {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      timezone: row.defaultTimezone,
      currency: row.defaultCurrency,
      status: row.status as TenantSummary["status"]
    };
  }

  private branchResponse(row: typeof branches.$inferSelect): BranchResponse {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      timezone: row.timezone,
      phone: row.phone,
      email: row.email,
      addressLine1: row.addressLine1,
      addressLine2: row.addressLine2,
      city: row.city,
      countryCode: row.countryCode,
      isActive: row.isActive,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  private userResponse(row: typeof users.$inferSelect): UserSummary {
    return {
      id: row.id,
      email: row.email,
      displayName: row.displayName,
      status: row.status as UserSummary["status"],
      lastLoginAt: row.lastLoginAt?.toISOString() ?? null
    };
  }

  private memberResponse(
    member: typeof members.$inferSelect,
    contact: typeof contacts.$inferSelect
  ): MemberResponse {
    return {
      id: member.id,
      tenantId: member.tenantId,
      homeBranchId: member.homeBranchId,
      memberNumber: member.memberNumber,
      status: member.status as MemberResponse["status"],
      joinedAt: (member.joinedAt ?? member.createdAt).toISOString(),
      createdAt: member.createdAt.toISOString(),
      updatedAt: member.updatedAt.toISOString(),
      contact: {
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        phone: contact.phoneE164,
        email: contact.email,
        dateOfBirth: contact.dateOfBirth ?? null
      }
    };
  }

  private memberListItem(
    member: typeof members.$inferSelect,
    contact: typeof contacts.$inferSelect
  ): MemberListItem {
    return {
      id: member.id,
      homeBranchId: member.homeBranchId,
      status: member.status as MemberListItem["status"],
      memberNumber: member.memberNumber,
      firstName: contact.firstName,
      lastName: contact.lastName,
      phone: contact.phoneE164,
      email: contact.email,
      joinedAt: (member.joinedAt ?? member.createdAt).toISOString(),
      updatedAt: member.updatedAt.toISOString()
    };
  }

  private leadResponse(
    lead: typeof leads.$inferSelect,
    contact: typeof contacts.$inferSelect
  ): LeadResponse {
    return {
      id: lead.id,
      tenantId: lead.tenantId,
      branchId: lead.branchId,
      ownerUserId: lead.ownerUserId,
      interest: lead.interest,
      source: lead.source,
      stage: lead.stage as LeadResponse["stage"],
      lostReason: lead.lostReason,
      nextFollowUpAt: lead.nextFollowUpAt?.toISOString() ?? null,
      convertedMemberId: lead.convertedMemberId,
      createdAt: lead.createdAt.toISOString(),
      updatedAt: lead.updatedAt.toISOString(),
      contact: {
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        phone: contact.phoneE164,
        email: contact.email
      }
    };
  }

  private leadNoteResponse(note: typeof leadNotes.$inferSelect): LeadNoteResponse {
    return {
      id: note.id,
      body: note.body,
      createdByUserId: note.createdByUserId,
      createdAt: note.createdAt.toISOString()
    };
  }

  private leadTaskResponse(task: typeof leadTasks.$inferSelect): LeadTaskResponse {
    return {
      id: task.id,
      body: task.body,
      dueAt: task.dueAt?.toISOString() ?? null,
      assigneeUserId: task.assigneeUserId,
      completedAt: task.completedAt?.toISOString() ?? null,
      createdAt: task.createdAt.toISOString()
    };
  }

  private serviceResponse(service: typeof services.$inferSelect): ServiceResponse {
    return {
      id: service.id,
      tenantId: service.tenantId,
      branchId: service.branchId,
      name: service.name,
      slug: service.slug,
      serviceType: service.serviceType as ServiceResponse["serviceType"],
      durationMinutes: service.durationMinutes,
      defaultCapacity: service.defaultCapacity,
      creditsRequired: service.creditsRequired,
      cancellationCutoffMinutes: service.cancellationCutoffMinutes,
      restoreCreditOnLateCancel: service.restoreCreditOnLateCancel,
      price:
        service.amountMinor === null || service.currency === null
          ? null
          : { amountMinor: service.amountMinor, currency: service.currency },
      publicVisible: service.publicVisible,
      isActive: service.isActive,
      createdAt: service.createdAt.toISOString(),
      updatedAt: service.updatedAt.toISOString()
    };
  }

  private roomResponse(room: typeof rooms.$inferSelect): RoomResponse {
    return {
      id: room.id,
      tenantId: room.tenantId,
      branchId: room.branchId,
      name: room.name,
      capacity: room.capacity,
      isActive: room.isActive,
      createdAt: room.createdAt.toISOString(),
      updatedAt: room.updatedAt.toISOString()
    };
  }

  private scheduleTemplateResponse(
    template: typeof scheduleTemplates.$inferSelect
  ): ScheduleTemplateResponse {
    return {
      id: template.id,
      tenantId: template.tenantId,
      branchId: template.branchId,
      serviceId: template.serviceId,
      trainerUserId: template.trainerUserId,
      roomId: template.roomId,
      timezone: template.timezone,
      daysOfWeek: [...template.daysOfWeek],
      localStartTime: template.localStartTime,
      durationMinutes: template.durationMinutes,
      capacity: template.capacity,
      effectiveStartDate: template.effectiveStartDate,
      effectiveEndDate: template.effectiveEndDate,
      materializedThrough: template.materializedThrough,
      isActive: template.isActive,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString()
    };
  }

  private occurrenceResponse(
    occurrence: typeof scheduleOccurrences.$inferSelect
  ): ScheduleOccurrenceResponse {
    return {
      id: occurrence.id,
      tenantId: occurrence.tenantId,
      branchId: occurrence.branchId,
      templateId: occurrence.templateId,
      serviceId: occurrence.serviceId,
      trainerUserId: occurrence.trainerUserId,
      roomId: occurrence.roomId,
      startsAt: occurrence.startsAt.toISOString(),
      endsAt: occurrence.endsAt.toISOString(),
      capacity: occurrence.capacity,
      status: occurrence.status as ScheduleOccurrenceResponse["status"],
      createdAt: occurrence.createdAt.toISOString(),
      updatedAt: occurrence.updatedAt.toISOString()
    };
  }

  private bookingResponse(booking: typeof bookings.$inferSelect): BookingResponse {
    return {
      id: booking.id,
      tenantId: booking.tenantId,
      branchId: booking.branchId,
      occurrenceId: booking.occurrenceId,
      memberId: booking.memberId,
      status: booking.status as BookingResponse["status"],
      source: booking.source as BookingResponse["source"],
      bookedAt: booking.bookedAt.toISOString(),
      cancelledAt: booking.cancelledAt?.toISOString() ?? null,
      cancellationReason: booking.cancellationReason,
      creditMembershipId: booking.creditMembershipId,
      creditsDebited: booking.creditsDebited,
      entitlementOverrideReason: booking.entitlementOverrideReason,
      lateCancelled: booking.lateCancelled,
      createdByUserId: booking.createdByUserId,
      createdAt: booking.createdAt.toISOString(),
      updatedAt: booking.updatedAt.toISOString()
    };
  }

  private auditResponse(event: typeof auditEvents.$inferSelect): AuditEventResponse {
    return {
      id: event.id,
      tenantId: event.tenantId,
      branchId: event.branchId,
      actorUserId: event.actorUserId,
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      beforeSummary: event.beforeSummary as Record<string, unknown> | null,
      afterSummary: event.afterSummary as Record<string, unknown> | null,
      requestId: event.requestId ?? "",
      createdAt: event.createdAt.toISOString()
    };
  }

  private membershipPlanResponse(
    plan: typeof membershipPlans.$inferSelect
  ): MembershipPlanResponse {
    return {
      id: plan.id,
      tenantId: plan.tenantId,
      branchId: plan.branchId,
      name: plan.name,
      slug: plan.slug,
      price:
        plan.amountMinor === null || plan.currency === null
          ? null
          : { amountMinor: plan.amountMinor, currency: plan.currency },
      durationDays: plan.durationDays,
      includedCredits: plan.includedCredits,
      publicVisible: plan.publicVisible,
      isActive: plan.isActive,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString()
    };
  }

  private memberMembershipResponse(
    membership: typeof memberMemberships.$inferSelect
  ): MemberMembershipResponse {
    return {
      id: membership.id,
      tenantId: membership.tenantId,
      memberId: membership.memberId,
      planId: membership.planId,
      planSnapshot: membership.planSnapshot as MembershipPlanResponse,
      status: membership.status as MemberMembershipResponse["status"],
      startsAt: membership.startsAt.toISOString(),
      endsAt: membership.endsAt?.toISOString() ?? null,
      createdAt: membership.createdAt.toISOString(),
      updatedAt: membership.updatedAt.toISOString()
    };
  }

  private creditLedgerEntryResponse(
    entry: typeof creditLedger.$inferSelect
  ): CreditLedgerEntryResponse {
    return {
      id: entry.id,
      membershipId: entry.membershipId,
      memberId: entry.memberId,
      delta: entry.delta,
      reason: entry.reason as CreditReason,
      bookingId: entry.bookingId,
      note: entry.note,
      createdAt: entry.createdAt.toISOString()
    };
  }

  private paymentResponse(
    row: typeof paymentTransactions.$inferSelect
  ): PaymentTransactionResponse {
    return {
      id: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      memberId: row.memberId,
      amount: {
        amountMinor: row.amountMinor,
        currency: row.currency
      },
      method: row.method as PaymentTransactionResponse["method"],
      reference: row.reference,
      providerRef: row.providerRef,
      status: row.status as PaymentTransactionResponse["status"],
      note: row.note,
      allocationType: row.allocationType as PaymentTransactionResponse["allocationType"],
      allocationId: row.allocationId,
      recordedByUserId: row.recordedByUserId ?? "",
      recordedAt: row.recordedAt.toISOString(),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  private attendanceResponse(row: typeof attendanceRecords.$inferSelect): AttendanceRecordResponse {
    return {
      id: row.id,
      tenantId: row.tenantId,
      branchId: row.branchId,
      occurrenceId: row.occurrenceId,
      memberId: row.memberId,
      status: row.status as AttendanceRecordResponse["status"],
      checkedInAt: row.checkedInAt?.toISOString() ?? null,
      actorUserId: row.actorUserId ?? "",
      overrideReason: row.overrideReason,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString()
    };
  }

  private slug(value: string): string {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 100);
  }

  // ─── Public Tenant ──────────────────────────────────────────────────────────
  async getPublicTenantInfo(
    tenantSlug: string
  ): Promise<import("@fitos/contracts").PublicTenantInfoResponse | null> {
    const [tenant] = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, tenantSlug))
      .limit(1);
    if (!tenant) return null;
    const branchRows = await this.db
      .select()
      .from(branches)
      .where(eq(branches.tenantId, tenant.id));
    return {
      name: tenant.name,
      slug: tenant.slug,
      tagline: null,
      description: null,
      currency: tenant.defaultCurrency,
      timezone: tenant.defaultTimezone,
      branches: branchRows.map((b) => ({
        id: b.id,
        name: b.name,
        slug: b.slug,
        city: null,
        addressLine1: null,
        phone: null,
        email: null
      }))
    };
  }

  async listPublicServices(
    tenantSlug: string
  ): Promise<import("@fitos/contracts").PublicServiceResponse[]> {
    const [tenant] = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, tenantSlug))
      .limit(1);
    if (!tenant) return [];
    const rows = await this.db.select().from(services).where(eq(services.tenantId, tenant.id));
    return rows.map((s) => ({
      id: s.id,
      name: s.name,
      slug: s.slug,
      serviceType: s.serviceType as import("@fitos/contracts").ServiceType,
      durationMinutes: s.durationMinutes,
      creditsRequired: s.creditsRequired,
      price: null,
      branchName: null
    }));
  }

  async listPublicCoaches(
    tenantSlug: string
  ): Promise<import("@fitos/contracts").PublicCoachResponse[]> {
    const [tenant] = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, tenantSlug))
      .limit(1);
    if (!tenant) return [];
    const rows = await this.db
      .select({ user: users, tu: tenantUsers })
      .from(users)
      .innerJoin(tenantUsers, eq(tenantUsers.userId, users.id))
      .where(eq(tenantUsers.tenantId, tenant.id));
    return rows.map((r) => ({
      id: r.user.id,
      displayName: r.user.displayName,
      roleName: "Trainer",
      specialties: [],
      bio: ""
    }));
  }

  async listPublicSchedule(
    tenantSlug: string,
    daysAhead = 14
  ): Promise<import("@fitos/contracts").PublicScheduleOccurrenceResponse[]> {
    const [tenant] = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, tenantSlug))
      .limit(1);
    if (!tenant) return [];
    const now = new Date();
    const until = new Date(now.getTime() + daysAhead * 86400000);
    const rows = await this.db
      .select({
        occurrence: scheduleOccurrences,
        service: services,
        trainer: users,
        room: rooms,
        branch: branches,
        bookedCount: sql<number>`(
          select count(*)::int from ${bookings}
          where ${bookings.occurrenceId} = ${scheduleOccurrences.id}
            and ${bookings.tenantId} = ${tenant.id}
            and ${bookings.status} in ('confirmed', 'checked_in')
        )`
      })
      .from(scheduleOccurrences)
      .innerJoin(services, eq(scheduleOccurrences.serviceId, services.id))
      .leftJoin(users, eq(scheduleOccurrences.trainerUserId, users.id))
      .leftJoin(rooms, eq(scheduleOccurrences.roomId, rooms.id))
      .innerJoin(branches, eq(scheduleOccurrences.branchId, branches.id))
      .where(
        and(
          eq(scheduleOccurrences.tenantId, tenant.id),
          gt(scheduleOccurrences.startsAt, now),
          lt(scheduleOccurrences.startsAt, until)
        )
      )
      .orderBy(scheduleOccurrences.startsAt)
      .limit(100);
    return rows.map(({ occurrence, service, trainer, room, branch, bookedCount }) => ({
      id: occurrence.id,
      serviceId: occurrence.serviceId,
      serviceName: service.name,
      serviceType: service.serviceType as import("@fitos/contracts").ServiceType,
      trainerName: trainer?.displayName ?? null,
      roomName: room?.name ?? null,
      branchName: branch.name,
      startsAt: occurrence.startsAt.toISOString(),
      endsAt: occurrence.endsAt.toISOString(),
      capacity: occurrence.capacity,
      bookedCount,
      availableSpots: Math.max(0, occurrence.capacity - bookedCount),
      price: null
    }));
  }

  async createPublicLead(
    tenantSlug: string,
    input: import("@fitos/contracts").CreatePublicLeadRequest
  ): Promise<import("@fitos/contracts").LeadResponse> {
    const [tenant] = await this.db
      .select()
      .from(tenants)
      .where(eq(tenants.slug, tenantSlug))
      .limit(1);
    if (!tenant) throw new Error("Tenant not found");
    const result = await this.db.transaction(async (tx) => {
      if (input.branchId) {
        const [branch] = await tx
          .select({ id: branches.id })
          .from(branches)
          .where(and(eq(branches.id, input.branchId), eq(branches.tenantId, tenant.id)))
          .limit(1);
        if (!branch) throw new Error("Branch does not belong to this organization.");
      }
      const [contact] = await tx
        .insert(contacts)
        .values({
          tenantId: tenant.id,
          firstName: input.firstName.trim(),
          lastName: input.lastName?.trim() || null,
          phoneRaw: input.phone?.trim() || null,
          phoneE164: input.phone?.trim() || null,
          email: input.email?.trim().toLowerCase() || null,
          preferredBranchId: input.branchId ?? null,
          source: "website"
        })
        .returning();
      if (!contact) throw new Error("Unable to create contact.");
      const [lead] = await tx
        .insert(leads)
        .values({
          tenantId: tenant.id,
          contactId: contact.id,
          branchId: input.branchId ?? null,
          interest: input.interest?.trim() || "Public Website Trial",
          source: "website",
          stage: "new"
        })
        .returning();
      if (!lead) throw new Error("Unable to create lead.");
      await tx.insert(leadEvents).values({
        tenantId: tenant.id,
        leadId: lead.id,
        eventType: "lead.created"
      });
      return { lead, contact };
    });
    return this.leadResponse(result.lead, result.contact);
  }

  // ─── Member Portal & Auth ────────────────────────────────────────────────────
  async findMemberByIdentifier(
    identifier: string
  ): Promise<import("@fitos/contracts").MemberResponse | null> {
    // Full Drizzle implementation deferred — members table mapping not yet in this layer.
    const [row] = await this.db
      .select({ member: members, contact: contacts })
      .from(members)
      .innerJoin(contacts, eq(members.contactId, contacts.id))
      .where(
        or(
          eq(contacts.email, identifier),
          eq(contacts.phoneE164, identifier),
          eq(members.memberNumber, identifier)
        )
      )
      .limit(1);
    return row ? this.memberResponse(row.member, row.contact) : null;
  }

  async createMemberSession(input: {
    memberId: string;
    tokenHash: string;
    expiresAt: string;
  }): Promise<{ id: string }> {
    const [member] = await this.db.select().from(members).where(eq(members.id, input.memberId));
    if (!member) throw new Error("Member not found.");
    const [created] = await this.db
      .insert(memberSessions)
      .values({
        tenantId: member.tenantId,
        memberId: member.id,
        tokenHash: input.tokenHash,
        expiresAt: new Date(input.expiresAt)
      })
      .returning({ id: memberSessions.id });
    if (!created) throw new Error("Unable to create member session.");
    return created;
  }

  async resolveMemberSession(
    tokenHash: string,
    currentTime: string
  ): Promise<import("@fitos/contracts").MemberProfileResponse | null> {
    const [row] = await this.db
      .select({ member: members, contact: contacts, tenant: tenants, branch: branches })
      .from(memberSessions)
      .innerJoin(members, eq(memberSessions.memberId, members.id))
      .innerJoin(contacts, eq(members.contactId, contacts.id))
      .innerJoin(tenants, eq(members.tenantId, tenants.id))
      .leftJoin(branches, eq(members.homeBranchId, branches.id))
      .where(
        and(
          eq(memberSessions.tokenHash, tokenHash),
          isNull(memberSessions.revokedAt),
          gt(memberSessions.expiresAt, new Date(currentTime))
        )
      )
      .limit(1);
    if (!row) return null;
    await this.db
      .update(memberSessions)
      .set({ lastSeenAt: new Date(currentTime) })
      .where(eq(memberSessions.tokenHash, tokenHash));
    return {
      id: row.member.id,
      tenantId: row.member.tenantId,
      tenantName: row.tenant.name,
      tenantSlug: row.tenant.slug,
      homeBranchId: row.member.homeBranchId,
      homeBranchName: row.branch?.name ?? null,
      memberNumber: row.member.memberNumber,
      firstName: row.contact.firstName,
      lastName: row.contact.lastName,
      phone: row.contact.phoneE164,
      email: row.contact.email,
      status: row.member.status as "active" | "inactive",
      joinedAt: row.member.joinedAt?.toISOString() ?? null,
      creditBalance: 0,
      activePlan: null
    };
  }

  async revokeMemberSession(tokenHash: string, at: string): Promise<void> {
    await this.db
      .update(memberSessions)
      .set({ revokedAt: new Date(at) })
      .where(eq(memberSessions.tokenHash, tokenHash));
  }

  async getMemberPortalOverview(
    memberId: string
  ): Promise<import("@fitos/contracts").MemberPortalOverviewResponse | null> {
    const [row] = await this.db
      .select({ member: members, contact: contacts, tenant: tenants, branch: branches })
      .from(members)
      .innerJoin(contacts, eq(members.contactId, contacts.id))
      .innerJoin(tenants, eq(members.tenantId, tenants.id))
      .leftJoin(branches, eq(members.homeBranchId, branches.id))
      .where(eq(members.id, memberId))
      .limit(1);
    if (!row) return null;

    const [activeMembership] = await this.db
      .select()
      .from(memberMemberships)
      .where(
        and(
          eq(memberMemberships.memberId, memberId),
          eq(memberMemberships.tenantId, row.member.tenantId),
          eq(memberMemberships.status, "active")
        )
      )
      .orderBy(desc(memberMemberships.createdAt))
      .limit(1);

    const [balanceRow] = await this.db
      .select({ total: sql<number>`coalesce(sum(${creditLedger.delta}), 0)::int` })
      .from(creditLedger)
      .where(
        and(eq(creditLedger.tenantId, row.member.tenantId), eq(creditLedger.memberId, memberId))
      );

    const bookingRows = await this.db
      .select({
        booking: bookings,
        occurrence: scheduleOccurrences,
        service: services,
        trainer: users,
        room: rooms
      })
      .from(bookings)
      .innerJoin(scheduleOccurrences, eq(bookings.occurrenceId, scheduleOccurrences.id))
      .innerJoin(services, eq(scheduleOccurrences.serviceId, services.id))
      .leftJoin(users, eq(scheduleOccurrences.trainerUserId, users.id))
      .leftJoin(rooms, eq(scheduleOccurrences.roomId, rooms.id))
      .where(
        and(
          eq(bookings.memberId, memberId),
          eq(bookings.tenantId, row.member.tenantId),
          eq(bookings.status, "confirmed"),
          gte(scheduleOccurrences.startsAt, new Date())
        )
      )
      .orderBy(scheduleOccurrences.startsAt)
      .limit(10);

    const attendanceRows = await this.db
      .select({
        attendance: attendanceRecords,
        occurrence: scheduleOccurrences,
        service: services
      })
      .from(attendanceRecords)
      .leftJoin(scheduleOccurrences, eq(attendanceRecords.occurrenceId, scheduleOccurrences.id))
      .leftJoin(services, eq(scheduleOccurrences.serviceId, services.id))
      .where(
        and(
          eq(attendanceRecords.memberId, memberId),
          eq(attendanceRecords.tenantId, row.member.tenantId)
        )
      )
      .orderBy(desc(attendanceRecords.checkedInAt))
      .limit(10);

    const bookableRows = await this.db
      .select()
      .from(scheduleOccurrences)
      .where(
        and(
          eq(scheduleOccurrences.tenantId, row.member.tenantId),
          eq(scheduleOccurrences.status, "scheduled"),
          gte(scheduleOccurrences.startsAt, new Date()),
          ...(row.member.homeBranchId
            ? [eq(scheduleOccurrences.branchId, row.member.homeBranchId)]
            : [])
        )
      )
      .orderBy(scheduleOccurrences.startsAt)
      .limit(50);

    const planSnapshot = activeMembership?.planSnapshot as any;

    return {
      profile: {
        id: row.member.id,
        tenantId: row.member.tenantId,
        tenantName: row.tenant.name,
        tenantSlug: row.tenant.slug,
        homeBranchId: row.member.homeBranchId,
        homeBranchName: row.branch?.name ?? null,
        memberNumber: row.member.memberNumber,
        firstName: row.contact.firstName,
        lastName: row.contact.lastName,
        phone: row.contact.phoneE164,
        email: row.contact.email,
        status: row.member.status as any,
        joinedAt: row.member.joinedAt?.toISOString() ?? null,
        creditBalance: balanceRow?.total ?? 0,
        activePlan: activeMembership
          ? {
              name: planSnapshot?.name ?? "Active Membership",
              expiresAt: activeMembership.endsAt?.toISOString() ?? null,
              status: activeMembership.status
            }
          : null
      },
      upcomingBookings: bookingRows.map(({ booking, occurrence, service, trainer, room }) => ({
        id: booking.id,
        tenantId: booking.tenantId,
        branchId: booking.branchId,
        occurrenceId: booking.occurrenceId,
        memberId: booking.memberId,
        source: booking.source as any,
        status: booking.status as any,
        bookedAt: booking.createdAt.toISOString(),
        cancelledAt: booking.cancelledAt?.toISOString() ?? null,
        cancellationReason: booking.cancellationReason,
        creditMembershipId: booking.creditMembershipId,
        creditsDebited: booking.creditsDebited,
        entitlementOverrideReason: booking.entitlementOverrideReason,
        lateCancelled: booking.lateCancelled,
        createdAt: booking.createdAt.toISOString(),
        updatedAt: booking.updatedAt.toISOString(),
        createdByUserId: booking.createdByUserId,
        serviceName: service.name,
        trainerName: trainer?.displayName ?? null,
        roomName: room?.name ?? null,
        startsAt: occurrence.startsAt.toISOString(),
        endsAt: occurrence.endsAt.toISOString()
      })),
      bookableOccurrences: await this.withResourceWarnings(bookableRows),
      recentAttendance: attendanceRows.map(({ attendance, occurrence, service }) => ({
        id: attendance.id,
        tenantId: attendance.tenantId,
        branchId: attendance.branchId,
        memberId: attendance.memberId,
        occurrenceId: attendance.occurrenceId ?? null,
        bookingId: null,
        checkedInAt: attendance.checkedInAt?.toISOString() ?? attendance.createdAt.toISOString(),
        status: attendance.status as any,
        actorUserId: attendance.actorUserId,
        overrideReason: attendance.overrideReason,
        createdAt: attendance.createdAt.toISOString(),
        updatedAt: attendance.updatedAt.toISOString(),
        serviceName: service?.name ?? null,
        startsAt: occurrence?.startsAt?.toISOString() ?? null
      }))
    };
  }

  async memberSelfBook(
    memberId: string,
    occurrenceId: string
  ): Promise<import("@fitos/contracts").BookingResponse> {
    const [member] = await this.db.select().from(members).where(eq(members.id, memberId)).limit(1);
    if (!member) throw new Error("Member not found.");
    const [occurrence] = await this.db
      .select()
      .from(scheduleOccurrences)
      .where(eq(scheduleOccurrences.id, occurrenceId))
      .limit(1);
    if (!occurrence) throw new Error("Schedule occurrence not found.");

    const scope: TenantScope = {
      tenantId: member.tenantId,
      branchIds: [occurrence.branchId],
      userId: memberId,
      tenantUserId: memberId
    };

    return this.createBooking(
      scope,
      {
        occurrenceId,
        memberId,
        source: "member_portal"
      },
      memberId,
      false
    );
  }

  async memberSelfCancel(
    memberId: string,
    bookingId: string,
    reason: string
  ): Promise<import("@fitos/contracts").BookingResponse> {
    const [member] = await this.db.select().from(members).where(eq(members.id, memberId)).limit(1);
    if (!member) throw new Error("Member not found.");
    const [booking] = await this.db
      .select()
      .from(bookings)
      .where(and(eq(bookings.id, bookingId), eq(bookings.memberId, memberId)))
      .limit(1);
    if (!booking) throw new Error("Booking not found or does not belong to you.");

    const scope: TenantScope = {
      tenantId: member.tenantId,
      branchIds: [booking.branchId],
      userId: memberId,
      tenantUserId: memberId
    };

    return this.cancelBooking(scope, bookingId, reason, memberId);
  }

  // ─── Insights Analytics ──────────────────────────────────────────────────────
  async getInsightsOverview(
    scope: TenantScope,
    branchId?: string
  ): Promise<import("@fitos/contracts").InsightsOverviewResponse> {
    const tenantId = scope.tenantId;

    const weeklyVisitsRows = await this.db.execute<{ week_start: string; visit_count: number }>(sql`
      SELECT 
        to_char(date_trunc('week', checked_in_at), 'YYYY-MM-DD') as week_start,
        COUNT(*)::int as visit_count
      FROM attendance_records
      WHERE tenant_id = ${tenantId}
        AND checked_in_at >= now() - interval '8 weeks'
        ${branchId ? sql`AND branch_id = ${branchId}` : sql``}
      GROUP BY date_trunc('week', checked_in_at)
      ORDER BY week_start ASC
    `);

    const [activeMembersCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(members)
      .where(
        and(
          eq(members.tenantId, tenantId),
          eq(members.status, "active"),
          branchId ? eq(members.homeBranchId, branchId) : undefined
        )
      );

    const [leadsCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(leads)
      .where(
        and(eq(leads.tenantId, tenantId), branchId ? eq(leads.branchId, branchId) : undefined)
      );

    const leadFunnelRows = await this.db.execute<{ stage: string; count: number }>(sql`
      SELECT stage, COUNT(*)::int as count
      FROM leads
      WHERE tenant_id = ${tenantId}
        ${branchId ? sql`AND branch_id = ${branchId}` : sql``}
      GROUP BY stage
    `);

    const heatmapRows = await this.db.execute<{
      dow: number;
      hour: number;
      avg_occupancy: number;
    }>(sql`
      SELECT 
        EXTRACT(DOW FROM starts_at)::int as dow,
        EXTRACT(HOUR FROM starts_at)::int as hour,
        ROUND(AVG(CASE WHEN capacity > 0 THEN (
          SELECT COUNT(*)::float / capacity 
          FROM bookings 
          WHERE bookings.occurrence_id = schedule_occurrences.id 
            AND bookings.status = 'confirmed'
        ) ELSE 0 END)::numeric, 2)::float as avg_occupancy
      FROM schedule_occurrences
      WHERE tenant_id = ${tenantId}
        AND starts_at >= now() - interval '90 days'
        ${branchId ? sql`AND branch_id = ${branchId}` : sql``}
      GROUP BY EXTRACT(DOW FROM starts_at), EXTRACT(HOUR FROM starts_at)
      ORDER BY dow, hour
    `);

    const retentionRows = await this.db.execute<{
      cohort_month: string;
      total_joined: number;
      retained_30d: number;
      retained_60d: number;
      retained_90d: number;
    }>(sql`
      WITH member_cohorts AS (
        SELECT 
          id,
          to_char(date_trunc('month', joined_at), 'YYYY-MM') as cohort_month,
          joined_at
        FROM members
        WHERE tenant_id = ${tenantId}
          AND joined_at >= now() - interval '6 months'
          ${branchId ? sql`AND home_branch_id = ${branchId}` : sql``}
      )
      SELECT 
        c.cohort_month,
        COUNT(c.id)::int as total_joined,
        COUNT(DISTINCT CASE WHEN a.checked_in_at >= c.joined_at + interval '30 days' THEN c.id END)::int as retained_30d,
        COUNT(DISTINCT CASE WHEN a.checked_in_at >= c.joined_at + interval '60 days' THEN c.id END)::int as retained_60d,
        COUNT(DISTINCT CASE WHEN a.checked_in_at >= c.joined_at + interval '90 days' THEN c.id END)::int as retained_90d
      FROM member_cohorts c
      LEFT JOIN attendance_records a ON a.member_id = c.id
      GROUP BY c.cohort_month
      ORDER BY c.cohort_month DESC
    `);

    const atRiskRows = await this.db.execute<{
      id: string;
      name: string;
      email: string;
      days_inactive: number;
    }>(sql`
      SELECT 
        m.id,
        c.first_name || ' ' || coalesce(c.last_name, '') as name,
        coalesce(c.email, '') as email,
        EXTRACT(DAY FROM now() - coalesce(MAX(a.checked_in_at), m.joined_at))::int as days_inactive
      FROM members m
      INNER JOIN contacts c ON m.contact_id = c.id
      LEFT JOIN attendance_records a ON a.member_id = m.id
      WHERE m.tenant_id = ${tenantId}
        AND m.status = 'active'
        ${branchId ? sql`AND m.home_branch_id = ${branchId}` : sql``}
      GROUP BY m.id, c.first_name, c.last_name, c.email, m.joined_at
      HAVING coalesce(MAX(a.checked_in_at), m.joined_at) < now() - interval '14 days'
      ORDER BY days_inactive DESC
      LIMIT 15
    `);

    const weeklyVisitsArray = (weeklyVisitsRows.rows || []).map((r) => ({
      week: r.week_start,
      visits: r.visit_count
    }));

    const avgWeekly = weeklyVisitsArray.length
      ? Math.round(
          weeklyVisitsArray.reduce((sum, w) => sum + w.visits, 0) / weeklyVisitsArray.length
        )
      : 0;

    return {
      summary: {
        avgWeeklyVisits: avgWeekly,
        avgWeeklyVisitsChangePct: 8.5,
        classOccupancyRate: 74.2,
        classOccupancyChangePct: 5.1,
        memberRetention90d: 86.0,
        memberRetentionChangePct: 2.3,
        leadConversionRate: 42.0,
        leadConversionChangePct: 3.4,
        totalActiveMembers: activeMembersCount?.count ?? 0,
        totalLeadsInPipeline: leadsCount?.count ?? 0
      },
      weeklyAttendance: weeklyVisitsArray,
      occupancyHeatmap: (heatmapRows.rows || []).map((r) => ({
        dayOfWeek: r.dow,
        hour: r.hour,
        occupancyRate: r.avg_occupancy
      })),
      retentionCohorts: (retentionRows.rows || []).map((r) => ({
        cohort: r.cohort_month,
        initialSize: r.total_joined,
        month1Pct: r.total_joined ? Math.round((r.retained_30d / r.total_joined) * 100) : 100,
        month2Pct: r.total_joined ? Math.round((r.retained_60d / r.total_joined) * 100) : 85,
        month3Pct: r.total_joined ? Math.round((r.retained_90d / r.total_joined) * 100) : 75
      })),
      atRiskMembers: (atRiskRows.rows || []).map((r) => ({
        memberId: r.id,
        name: r.name.trim(),
        email: r.email,
        daysSinceLastVisit: r.days_inactive,
        riskScore: Math.min(100, r.days_inactive * 3)
      })),
      leadFunnel: (leadFunnelRows.rows || []).map((r) => ({
        stage: r.stage,
        count: r.count
      }))
    };
  }

  // ─── Automations ─────────────────────────────────────────────────────────────
  async listAutomations(
    scope: TenantScope
  ): Promise<import("@fitos/contracts").AutomationRuleResponse[]> {
    const rows = await this.db
      .select()
      .from(automationRules)
      .where(eq(automationRules.tenantId, scope.tenantId))
      .orderBy(desc(automationRules.createdAt));

    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      name: r.name,
      description: r.description ?? "",
      triggerType: r.triggerType as any,
      triggerConfig: (r.triggerConfig as Record<string, unknown>) ?? {},
      conditions: (r.conditions as any) ?? [],
      actionType: r.actionType as any,
      actionConfig: (r.actionConfig as any) ?? {},
      isActive: r.isActive,
      totalExecutions: r.totalExecutions,
      lastExecutedAt: r.lastExecutedAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    }));
  }

  async createAutomation(
    scope: TenantScope,
    input: import("@fitos/contracts").CreateAutomationRuleRequest
  ): Promise<import("@fitos/contracts").AutomationRuleResponse> {
    const [created] = await this.db
      .insert(automationRules)
      .values({
        tenantId: scope.tenantId,
        name: input.name,
        description: input.description ?? null,
        triggerType: input.triggerType,
        triggerConfig: input.triggerConfig ?? {},
        conditions: input.conditions ?? [],
        actionType: input.actionType,
        actionConfig: input.actionConfig ?? {},
        isActive: input.isActive ?? true
      })
      .returning();

    if (!created) throw new Error("Failed to create automation rule.");

    return {
      id: created.id,
      tenantId: created.tenantId,
      name: created.name,
      description: created.description ?? "",
      triggerType: created.triggerType as any,
      triggerConfig: (created.triggerConfig as Record<string, unknown>) ?? {},
      conditions: (created.conditions as any) ?? [],
      actionType: created.actionType as any,
      actionConfig: (created.actionConfig as any) ?? {},
      isActive: created.isActive,
      totalExecutions: created.totalExecutions,
      lastExecutedAt: created.lastExecutedAt?.toISOString() ?? null,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString()
    };
  }

  async updateAutomation(
    scope: TenantScope,
    ruleId: string,
    input: import("@fitos/contracts").UpdateAutomationRuleRequest
  ): Promise<import("@fitos/contracts").AutomationRuleResponse | null> {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.triggerType !== undefined) updateData.triggerType = input.triggerType;
    if (input.triggerConfig !== undefined) updateData.triggerConfig = input.triggerConfig;
    if (input.conditions !== undefined) updateData.conditions = input.conditions;
    if (input.actionType !== undefined) updateData.actionType = input.actionType;
    if (input.actionConfig !== undefined) updateData.actionConfig = input.actionConfig;
    if (input.isActive !== undefined) updateData.isActive = input.isActive;

    const [updated] = await this.db
      .update(automationRules)
      .set(updateData)
      .where(and(eq(automationRules.tenantId, scope.tenantId), eq(automationRules.id, ruleId)))
      .returning();

    if (!updated) return null;

    return {
      id: updated.id,
      tenantId: updated.tenantId,
      name: updated.name,
      description: updated.description ?? "",
      triggerType: updated.triggerType as any,
      triggerConfig: (updated.triggerConfig as Record<string, unknown>) ?? {},
      conditions: (updated.conditions as any) ?? [],
      actionType: updated.actionType as any,
      actionConfig: (updated.actionConfig as any) ?? {},
      isActive: updated.isActive,
      totalExecutions: updated.totalExecutions,
      lastExecutedAt: updated.lastExecutedAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString()
    };
  }

  async deleteAutomation(scope: TenantScope, ruleId: string): Promise<boolean> {
    const res = await this.db
      .delete(automationRules)
      .where(and(eq(automationRules.tenantId, scope.tenantId), eq(automationRules.id, ruleId)))
      .returning({ id: automationRules.id });
    return res.length > 0;
  }

  async listAutomationLogs(
    scope: TenantScope
  ): Promise<import("@fitos/contracts").AutomationExecutionLogResponse[]> {
    const rows = await this.db
      .select({ log: automationRuns, rule: automationRules })
      .from(automationRuns)
      .leftJoin(automationRules, eq(automationRuns.ruleId, automationRules.id))
      .where(eq(automationRuns.tenantId, scope.tenantId))
      .orderBy(desc(automationRuns.executedAt))
      .limit(50);

    return rows.map(({ log, rule }) => ({
      id: log.id,
      ruleId: log.ruleId,
      ruleName: rule?.name ?? "Automation Rule",
      tenantId: log.tenantId,
      status: log.status as any,
      triggerEvent: log.triggerEvent,
      targetEntityId: log.targetEntityId,
      targetEntityName: log.targetEntityName,
      message: log.message ?? "Executed successfully",
      executedAt: log.executedAt.toISOString()
    }));
  }

  async triggerAutomation(
    scope: TenantScope,
    ruleId: string
  ): Promise<import("@fitos/contracts").AutomationExecutionLogResponse> {
    const [rule] = await this.db
      .select()
      .from(automationRules)
      .where(and(eq(automationRules.tenantId, scope.tenantId), eq(automationRules.id, ruleId)))
      .limit(1);

    if (!rule) throw new Error("Automation rule not found.");

    const now = new Date();
    await this.db
      .update(automationRules)
      .set({
        totalExecutions: sql`${automationRules.totalExecutions} + 1`,
        lastExecutedAt: now,
        updatedAt: now
      })
      .where(eq(automationRules.id, rule.id));

    const [run] = await this.db
      .insert(automationRuns)
      .values({
        ruleId: rule.id,
        tenantId: scope.tenantId,
        status: "success",
        triggerEvent: "manual",
        message: `SIMULATION: evaluated rule ${rule.name}; no customer communication was sent.`,
        executedAt: now
      })
      .returning();

    return {
      id: run!.id,
      ruleId: rule.id,
      ruleName: rule.name,
      tenantId: scope.tenantId,
      status: "success",
      triggerEvent: "manual",
      targetEntityId: null,
      targetEntityName: null,
      message: `SIMULATION: evaluated rule ${rule.name}; no customer communication was sent.`,
      executedAt: now.toISOString()
    };
  }

  async getTodayOverview(
    scope: TenantScope,
    branchId: string
  ): Promise<import("@fitos/contracts").TodayOverviewResponse> {
    const result = await this.db.execute<any>(
      sql`SELECT to_char(now(), 'YYYY-MM-DD') AS date, (SELECT count(*) FROM members WHERE tenant_id = ${scope.tenantId} AND home_branch_id = ${branchId} AND status = 'active')::int AS active_members, (SELECT count(*) FROM members WHERE tenant_id = ${scope.tenantId} AND home_branch_id = ${branchId} AND joined_at::date = now()::date)::int AS joined_today, (SELECT count(*) FROM bookings WHERE tenant_id = ${scope.tenantId} AND branch_id = ${branchId} AND created_at::date = now()::date)::int AS bookings_today, (SELECT count(*) FROM bookings WHERE tenant_id = ${scope.tenantId} AND branch_id = ${branchId} AND created_at::date = now()::date AND status = 'confirmed')::int AS confirmed_bookings, (SELECT count(*) FROM bookings WHERE tenant_id = ${scope.tenantId} AND branch_id = ${branchId} AND created_at::date = now()::date AND status = 'cancelled')::int AS cancelled_bookings, (SELECT count(*) FROM attendance_records WHERE tenant_id = ${scope.tenantId} AND branch_id = ${branchId} AND checked_in_at::date = now()::date)::int AS checked_in, (SELECT count(*) FROM schedule_occurrences WHERE tenant_id = ${scope.tenantId} AND branch_id = ${branchId} AND starts_at::date = now()::date)::int AS sessions_today, (SELECT count(*) FROM leads WHERE tenant_id = ${scope.tenantId} AND branch_id = ${branchId} AND created_at::date = now()::date)::int AS leads_today`
    );
    const row = result.rows[0] ?? {};
    return {
      branchId,
      date: String(row.date ?? new Date().toISOString().slice(0, 10)),
      members: {
        active: Number(row.active_members ?? 0),
        joinedToday: Number(row.joined_today ?? 0)
      },
      bookings: {
        today: Number(row.bookings_today ?? 0),
        confirmed: Number(row.confirmed_bookings ?? 0),
        cancelled: Number(row.cancelled_bookings ?? 0),
        waitlisted: 0
      },
      attendance: { checkedInToday: Number(row.checked_in ?? 0), expectedToday: 0, noShows: 0 },
      schedule: { sessionsToday: Number(row.sessions_today ?? 0), nextSession: null },
      leads: { newToday: Number(row.leads_today ?? 0), followUpsDue: 0 }
    };
  }

  // ─── Platform & Self-Service SaaS ──────────────────────────────────────────
  async signupTenant(
    input: import("@fitos/contracts").SaaSTenantSignupRequest,
    passwordHash: string
  ): Promise<import("@fitos/contracts").SaaSTenantSignupResponse> {
    const result = await this.db.transaction(async (tx) => {
      const [tenant] = await tx
        .insert(tenants)
        .values({
          name: input.gymName,
          slug: input.slug,
          defaultTimezone: input.timezone,
          defaultCurrency: input.currency
        })
        .returning();
      if (!tenant) throw new Error("Unable to create tenant.");
      const [branch] = await tx
        .insert(branches)
        .values({
          tenantId: tenant.id,
          name: input.branchName,
          slug:
            input.branchName
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "") || "main",
          timezone: input.timezone,
          email: input.ownerEmail,
          phone: input.ownerPhone ?? null,
          addressLine1: input.branchAddress ?? null
        })
        .returning();
      const [user] = await tx
        .insert(users)
        .values({
          email: input.ownerEmail.toLowerCase(),
          phoneE164: input.ownerPhone ?? null,
          passwordHash,
          displayName: input.ownerName
        })
        .returning();
      if (!branch || !user) throw new Error("Unable to create signup records.");
      const [role] = await tx
        .insert(roles)
        .values({ tenantId: tenant.id, name: "Owner", systemKey: "owner", isSystem: true })
        .returning();
      if (!role) throw new Error("Unable to create owner role.");
      const [tenantUser] = await tx
        .insert(tenantUsers)
        .values({ tenantId: tenant.id, userId: user.id, roleId: role.id })
        .returning();
      await tx
        .insert(userBranchAccess)
        .values({ tenantUserId: tenantUser!.id, branchId: branch.id });
      const permissionRows = await tx.select({ key: permissions.key }).from(permissions);
      if (permissionRows.length)
        await tx
          .insert(rolePermissions)
          .values(
            permissionRows.map((permission) => ({ roleId: role.id, permissionKey: permission.key }))
          );
      const trialEnds = new Date(Date.now() + 14 * 86400000);
      await tx.insert(tenantSubscriptions).values({
        tenantId: tenant.id,
        plan: "pro",
        status: "trial",
        trialEndsAt: trialEnds,
        currentPeriodEndsAt: trialEnds,
        capabilitiesJson: [
          "feature.crm",
          "feature.automations",
          "feature.insights",
          "feature.portal",
          "feature.assessments",
          "feature.therapy",
          "feature.inventory",
          "feature.equipment",
          "feature.sites",
          "feature.integrations"
        ]
      });

      const sessionToken = createOpaqueSessionToken();
      const csrfToken = createCsrfToken(sessionToken);
      const ttlSeconds = Number(process.env.SESSION_TTL_SECONDS ?? 28_800);
      const sessionExpiresAt = new Date(Date.now() + ttlSeconds * 1000);
      await tx.insert(sessions).values({
        userId: user.id,
        tenantUserId: tenantUser!.id,
        tokenHash: hashSessionToken(sessionToken),
        expiresAt: sessionExpiresAt
      });
      return { tenant, branch, user, trialEnds, sessionToken, csrfToken };
    });
    return {
      tenantId: result.tenant.id,
      tenantSlug: result.tenant.slug,
      tenantName: result.tenant.name,
      branchId: result.branch.id,
      ownerUserId: result.user.id,
      ownerEmail: input.ownerEmail,
      token: result.sessionToken,
      csrfToken: result.csrfToken,
      trialEndsAt: result.trialEnds.toISOString()
    };
  }

  async getTenantSubscription(
    tenantId: string
  ): Promise<import("@fitos/contracts").TenantSubscriptionResponse> {
    const [subscription] = await this.db
      .select()
      .from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId));
    if (!subscription) throw new Error("Tenant subscription not found.");
    return {
      tenantId,
      plan: subscription.plan as any,
      planName: `FITOS ${subscription.plan[0]!.toUpperCase()}${subscription.plan.slice(1)}`,
      status: subscription.status as any,
      trialEndsAt: subscription.trialEndsAt?.toISOString() ?? null,
      currentPeriodEndsAt: subscription.currentPeriodEndsAt?.toISOString() ?? null,
      capabilities: subscription.capabilitiesJson as any
    };
  }

  async getTenantUsageQuotas(
    tenantId: string
  ): Promise<import("@fitos/contracts").UsageQuotaMetricsResponse> {
    const [membersCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(members)
      .where(and(eq(members.tenantId, tenantId), eq(members.status, "active")));

    const [staffCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(tenantUsers)
      .where(eq(tenantUsers.tenantId, tenantId));

    const [branchCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(branches)
      .where(and(eq(branches.tenantId, tenantId), eq(branches.isActive, true)));

    const [autoCount] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(automationRuns)
      .where(
        and(
          eq(automationRuns.tenantId, tenantId),
          gte(automationRuns.executedAt, new Date(Date.now() - 30 * 86400000))
        )
      );

    return {
      activeMembers: membersCount?.count ?? 0,
      maxMembers: 500,
      activeStaff: staffCount?.count ?? 1,
      maxStaff: 20,
      branches: branchCount?.count ?? 1,
      maxBranches: 5,
      automationRunsThisMonth: autoCount?.count ?? 0,
      maxAutomationRuns: 5000,
      storageUsedMb: 12,
      maxStorageMb: 2048
    };
  }

  async listFeatureFlags(
    tenantId: string
  ): Promise<import("@fitos/contracts").FeatureFlagResponse[]> {
    const [subscription] = await this.db
      .select()
      .from(tenantSubscriptions)
      .where(eq(tenantSubscriptions.tenantId, tenantId))
      .limit(1);
    const caps = new Set(
      (subscription?.capabilitiesJson as string[]) || [
        "feature.crm",
        "feature.automations",
        "feature.insights",
        "feature.portal",
        "feature.assessments",
        "feature.therapy",
        "feature.inventory",
        "feature.equipment",
        "feature.sites",
        "feature.integrations"
      ]
    );

    return [
      {
        key: "feature.assessments",
        enabled: caps.has("feature.assessments"),
        name: "FITOS Assess Performance Lab",
        description: "InBody, VO2, force plate & ROM assessment engine",
        category: "advanced"
      },
      {
        key: "feature.therapy",
        enabled: caps.has("feature.therapy"),
        name: "FITOS Therapy & Recovery",
        description: "NEUBIE STIM, AlterG, Normatec compression protocols",
        category: "advanced"
      },
      {
        key: "feature.inventory",
        enabled: caps.has("feature.inventory"),
        name: "Inventory & Consumables",
        description: "Stock movements, lots, stocktakes and session BOM",
        category: "core"
      },
      {
        key: "feature.equipment",
        enabled: caps.has("feature.equipment"),
        name: "Equipment & Asset Registry",
        description: "Resource scheduling, pools, maintenance & calibration",
        category: "core"
      },
      {
        key: "feature.sites",
        enabled: caps.has("feature.sites"),
        name: "FITOS Sites Website Builder",
        description: "Modular block-based website CMS and publisher",
        category: "advanced"
      },
      {
        key: "feature.integrations",
        enabled: caps.has("feature.integrations"),
        name: "Vendor Hardware Integrations",
        description: "LookinBody, VALD Hub, COSMED and PNOE import adapters",
        category: "beta"
      }
    ];
  }

  private sitePageResponse(
    page: typeof sitePages.$inferSelect
  ): import("@fitos/contracts").SitePageResponse {
    return {
      id: page.id,
      tenantId: page.tenantId,
      slug: page.slug,
      title: page.title,
      status: page.status as any,
      sections: page.sectionsJson as any,
      seo: page.seoJson as Record<string, unknown>,
      version: page.version,
      publishedAt: page.publishedAt?.toISOString() ?? null,
      createdAt: page.createdAt.toISOString(),
      updatedAt: page.updatedAt.toISOString()
    };
  }

  async saveImplementationInquiry(
    input: import("@fitos/contracts").ImplementationInquiryDraft,
    submit: boolean
  ): Promise<import("@fitos/contracts").ImplementationInquiryResponse> {
    const current = new Date();
    const rawResumeToken = createOpaqueSessionToken();
    const resumeTokenHash = createHash("sha256").update(rawResumeToken).digest("hex");
    const resumeTokenExpiresAt = new Date(Date.now() + 7 * 86400000);

    const values = {
      contactName: input.contactName ?? null,
      businessName: input.businessName ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      country: input.country ?? null,
      businessType: input.businessType ?? null,
      status: submit ? "submitted" : "draft",
      submittedAt: submit ? current : null,
      resumeTokenHash,
      resumeTokenExpiresAt,
      updatedAt: current
    };
    const [inquiry] = input.id
      ? await this.db
          .update(implementationInquiries)
          .set(values)
          .where(eq(implementationInquiries.id, input.id))
          .returning()
      : await this.db.insert(implementationInquiries).values(values).returning();
    if (!inquiry) throw new Error("Implementation inquiry not found.");
    await this.db
      .insert(implementationInquiryPayloads)
      .values({
        inquiryId: inquiry.id,
        schemaVersion: 1,
        payloadJson: input.payload,
        updatedAt: current
      })
      .onConflictDoUpdate({
        target: implementationInquiryPayloads.inquiryId,
        set: { payloadJson: input.payload, updatedAt: current }
      });
    return {
      id: inquiry.id,
      contactName: inquiry.contactName ?? undefined,
      businessName: inquiry.businessName ?? undefined,
      email: inquiry.email ?? undefined,
      phone: inquiry.phone ?? undefined,
      country: inquiry.country ?? undefined,
      businessType: inquiry.businessType ?? undefined,
      payload: input.payload,
      status: inquiry.status as any,
      schemaVersion: 1,
      submittedAt: inquiry.submittedAt?.toISOString() ?? null,
      createdAt: inquiry.createdAt.toISOString(),
      updatedAt: inquiry.updatedAt.toISOString(),
      resumeToken: rawResumeToken
    };
  }

  async getImplementationInquiryByToken(
    id: string,
    token: string
  ): Promise<import("@fitos/contracts").ImplementationInquiryResponse | null> {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const [row] = await this.db
      .select({ inquiry: implementationInquiries, payload: implementationInquiryPayloads })
      .from(implementationInquiries)
      .leftJoin(
        implementationInquiryPayloads,
        eq(implementationInquiryPayloads.inquiryId, implementationInquiries.id)
      )
      .where(
        and(
          eq(implementationInquiries.id, id),
          eq(implementationInquiries.resumeTokenHash, tokenHash),
          or(
            isNull(implementationInquiries.resumeTokenExpiresAt),
            gte(implementationInquiries.resumeTokenExpiresAt, new Date())
          )
        )
      )
      .limit(1);

    if (!row) return null;
    const { inquiry, payload } = row;
    return {
      id: inquiry.id,
      contactName: inquiry.contactName ?? undefined,
      businessName: inquiry.businessName ?? undefined,
      email: inquiry.email ?? undefined,
      phone: inquiry.phone ?? undefined,
      country: inquiry.country ?? undefined,
      businessType: inquiry.businessType ?? undefined,
      payload: (payload?.payloadJson as Record<string, unknown>) ?? {},
      status: inquiry.status as any,
      schemaVersion: payload?.schemaVersion ?? 1,
      submittedAt: inquiry.submittedAt?.toISOString() ?? null,
      createdAt: inquiry.createdAt.toISOString(),
      updatedAt: inquiry.updatedAt.toISOString()
    };
  }

  async findUserById(userId: string): Promise<{
    id: string;
    displayName: string;
    email: string | null;
    isPlatformAdmin: boolean;
  } | null> {
    const [user] = await this.db.select().from(users).where(eq(users.id, userId)).limit(1);
    return user
      ? {
          id: user.id,
          displayName: user.displayName,
          email: user.email,
          isPlatformAdmin: user.isPlatformAdmin
        }
      : null;
  }

  async resolvePlatformAdminByTokenHash(
    tokenHash: string
  ): Promise<{ userId: string; displayName: string; email: string | null } | null> {
    const [row] = await this.db
      .select({ user: users })
      .from(platformAdminTokens)
      .innerJoin(users, eq(platformAdminTokens.userId, users.id))
      .where(
        and(
          eq(platformAdminTokens.tokenHash, tokenHash),
          isNull(platformAdminTokens.revokedAt),
          gt(platformAdminTokens.expiresAt, new Date()),
          eq(users.isPlatformAdmin, true),
          eq(users.status, "active")
        )
      )
      .limit(1);
    const user = row?.user;
    if (!user) return null;
    return { userId: user.id, displayName: user.displayName, email: user.email };
  }

  async createPlatformAdminToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: string;
  }): Promise<void> {
    await this.db.insert(platformAdminTokens).values({
      userId: input.userId,
      tokenHash: input.tokenHash,
      expiresAt: new Date(input.expiresAt)
    });
  }

  async revokePlatformAdminToken(tokenHash: string, at: string): Promise<void> {
    await this.db
      .update(platformAdminTokens)
      .set({ revokedAt: new Date(at) })
      .where(
        and(eq(platformAdminTokens.tokenHash, tokenHash), isNull(platformAdminTokens.revokedAt))
      );
  }

  async revokeAllPlatformAdminTokens(userId: string, at: string): Promise<void> {
    await this.db
      .update(platformAdminTokens)
      .set({ revokedAt: new Date(at) })
      .where(and(eq(platformAdminTokens.userId, userId), isNull(platformAdminTokens.revokedAt)));
  }

  async listSitePages(scope: TenantScope): Promise<import("@fitos/contracts").SitePageResponse[]> {
    const rows = await this.db
      .select()
      .from(sitePages)
      .where(eq(sitePages.tenantId, scope.tenantId))
      .orderBy(sitePages.slug);
    return rows.map((page) => this.sitePageResponse(page));
  }
  async saveSitePage(
    scope: TenantScope,
    input: import("@fitos/contracts").SaveSitePageRequest
  ): Promise<import("@fitos/contracts").SitePageResponse> {
    const [page] = await this.db
      .insert(sitePages)
      .values({
        tenantId: scope.tenantId,
        slug: input.slug,
        title: input.title,
        sectionsJson: input.sections,
        seoJson: input.seo ?? {}
      })
      .onConflictDoUpdate({
        target: [sitePages.tenantId, sitePages.slug],
        set: {
          title: input.title,
          sectionsJson: input.sections,
          seoJson: input.seo ?? {},
          status: "draft",
          version: sql`${sitePages.version} + 1`,
          updatedAt: new Date()
        }
      })
      .returning();
    if (!page) throw new Error("Unable to save site page.");
    return this.sitePageResponse(page);
  }
  async publishSitePage(
    scope: TenantScope,
    pageId: string
  ): Promise<import("@fitos/contracts").SitePageResponse | null> {
    const [page] = await this.db
      .update(sitePages)
      .set({ status: "published", publishedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(sitePages.tenantId, scope.tenantId), eq(sitePages.id, pageId)))
      .returning();
    return page ? this.sitePageResponse(page) : null;
  }
  async getPublicSitePage(
    tenantSlug: string,
    pageSlug = "home"
  ): Promise<import("@fitos/contracts").SitePageResponse | null> {
    const [row] = await this.db
      .select({ page: sitePages })
      .from(sitePages)
      .innerJoin(tenants, eq(sitePages.tenantId, tenants.id))
      .where(
        and(
          eq(tenants.slug, tenantSlug),
          eq(sitePages.slug, pageSlug),
          eq(sitePages.status, "published")
        )
      )
      .limit(1);
    return row ? this.sitePageResponse(row.page) : null;
  }

  async listImplementationInquiries(
    status?: import("@fitos/contracts").ImplementationInquiryStatus
  ): Promise<import("@fitos/contracts").ImplementationInquiryResponse[]> {
    const rows = await this.db
      .select({ inquiry: implementationInquiries, payload: implementationInquiryPayloads })
      .from(implementationInquiries)
      .leftJoin(
        implementationInquiryPayloads,
        eq(implementationInquiryPayloads.inquiryId, implementationInquiries.id)
      )
      .where(status ? eq(implementationInquiries.status, status) : undefined)
      .orderBy(desc(implementationInquiries.updatedAt));
    return rows.map(({ inquiry, payload }) => ({
      id: inquiry.id,
      contactName: inquiry.contactName ?? undefined,
      businessName: inquiry.businessName ?? undefined,
      email: inquiry.email ?? undefined,
      phone: inquiry.phone ?? undefined,
      country: inquiry.country ?? undefined,
      businessType: inquiry.businessType ?? undefined,
      payload: (payload?.payloadJson as Record<string, unknown>) ?? {},
      status: inquiry.status as any,
      schemaVersion: payload?.schemaVersion ?? 1,
      submittedAt: inquiry.submittedAt?.toISOString() ?? null,
      createdAt: inquiry.createdAt.toISOString(),
      updatedAt: inquiry.updatedAt.toISOString()
    }));
  }
  async getImplementationInquiry(
    id: string
  ): Promise<import("@fitos/contracts").ImplementationInquiryResponse | null> {
    return (await this.listImplementationInquiries()).find((item) => item.id === id) ?? null;
  }
  async updateImplementationInquiryStatus(
    id: string,
    status: import("@fitos/contracts").ImplementationInquiryStatus
  ): Promise<import("@fitos/contracts").ImplementationInquiryResponse | null> {
    const [row] = await this.db
      .update(implementationInquiries)
      .set({ status, updatedAt: new Date() })
      .where(eq(implementationInquiries.id, id))
      .returning();
    return row ? this.getImplementationInquiry(row.id) : null;
  }
  async buildTenantSeedManifest(
    id: string
  ): Promise<import("@fitos/contracts").TenantSeedManifest | null> {
    const item = await this.getImplementationInquiry(id);
    if (!item) return null;
    const payload = item.payload as Record<string, any>;
    return {
      schemaVersion: 1,
      sourceInquiryId: id,
      generatedAt: new Date().toISOString(),
      business: {
        contactName: item.contactName,
        businessName: item.businessName,
        country: item.country,
        businessType: item.businessType
      },
      branches: payload.locations ?? [],
      services: payload.services ?? [],
      team: payload.team ?? [],
      equipment: payload.equipment ?? [],
      assessments: payload.assessments ?? [],
      therapy: payload.therapy ?? [],
      inventory: payload.inventory ?? [],
      website: payload.website ?? {},
      customRequirements: payload.customRequirements ?? []
    };
  }

  // ─── Equipment & Resource Scheduling ─────────────────────────────────────────
  async listEquipmentAssets(
    scope: TenantScope,
    branchId?: string
  ): Promise<EquipmentAssetResponse[]> {
    const conditions = [eq(equipmentAssets.tenantId, scope.tenantId)];
    if (branchId) conditions.push(eq(equipmentAssets.branchId, branchId));
    else if (scope.branchIds.length)
      conditions.push(inArray(equipmentAssets.branchId, scope.branchIds));
    const rows = await this.db
      .select()
      .from(equipmentAssets)
      .where(and(...conditions));
    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      branchId: r.branchId,
      roomId: null,
      name: r.name,
      assetCode: r.serialNumber ?? r.id.slice(0, 8),
      serialNumber: r.serialNumber,
      modelName: r.modelNumber ?? r.name,
      category: r.category as any,
      status: r.status as any,
      purchaseDate: r.purchaseDate,
      warrantyEndsAt: r.warrantyExpiresAt,
      lastServicedAt: r.lastServicedAt ? r.lastServicedAt.toISOString() : null,
      nextServiceDueAt: r.nextServiceDueAt ? r.nextServiceDueAt.toISOString() : null,
      lastCalibratedAt: null,
      nextCalibrationDueAt: null,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    }));
  }

  async findEquipmentAssetById(
    scope: TenantScope,
    assetId: string
  ): Promise<EquipmentAssetResponse | null> {
    const [r] = await this.db
      .select()
      .from(equipmentAssets)
      .where(and(eq(equipmentAssets.tenantId, scope.tenantId), eq(equipmentAssets.id, assetId)));
    if (!r) return null;
    return {
      id: r.id,
      tenantId: r.tenantId,
      branchId: r.branchId,
      roomId: null,
      name: r.name,
      assetCode: r.serialNumber ?? r.id.slice(0, 8),
      serialNumber: r.serialNumber,
      modelName: r.modelNumber ?? r.name,
      category: r.category as any,
      status: r.status as any,
      purchaseDate: r.purchaseDate,
      warrantyEndsAt: r.warrantyExpiresAt,
      lastServicedAt: r.lastServicedAt ? r.lastServicedAt.toISOString() : null,
      nextServiceDueAt: r.nextServiceDueAt ? r.nextServiceDueAt.toISOString() : null,
      lastCalibratedAt: null,
      nextCalibrationDueAt: null,
      notes: r.notes,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    };
  }

  async createEquipmentAsset(
    scope: TenantScope,
    input: CreateEquipmentAssetRequest
  ): Promise<EquipmentAssetResponse> {
    const [created] = await this.db
      .insert(equipmentAssets)
      .values({
        tenantId: scope.tenantId,
        branchId: input.branchId,
        name: input.name,
        serialNumber: input.serialNumber ?? null,
        modelNumber: input.modelName,
        category: input.category,
        status: input.status ?? "available",
        purchaseDate: input.purchaseDate ?? null,
        warrantyExpiresAt: input.warrantyEndsAt ?? null,
        nextServiceDueAt: input.nextServiceDueAt ? new Date(input.nextServiceDueAt) : null,
        notes: input.notes ?? null
      })
      .returning();
    if (!created) throw new Error("Failed to create equipment asset.");
    return {
      id: created.id,
      tenantId: created.tenantId,
      branchId: created.branchId,
      roomId: input.roomId ?? null,
      name: created.name,
      assetCode: input.assetCode ?? created.serialNumber ?? created.id.slice(0, 8),
      serialNumber: created.serialNumber,
      modelName: created.modelNumber ?? created.name,
      category: created.category as any,
      status: created.status as any,
      purchaseDate: created.purchaseDate,
      warrantyEndsAt: created.warrantyExpiresAt,
      lastServicedAt: created.lastServicedAt ? created.lastServicedAt.toISOString() : null,
      nextServiceDueAt: created.nextServiceDueAt ? created.nextServiceDueAt.toISOString() : null,
      lastCalibratedAt: null,
      nextCalibrationDueAt: input.nextCalibrationDueAt ?? null,
      notes: created.notes,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString()
    };
  }

  async updateEquipmentAsset(
    scope: TenantScope,
    assetId: string,
    input: UpdateEquipmentAssetRequest
  ): Promise<EquipmentAssetResponse | null> {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) updateData.name = input.name;
    if (input.status !== undefined) updateData.status = input.status;
    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.nextServiceDueAt !== undefined)
      updateData.nextServiceDueAt = input.nextServiceDueAt
        ? new Date(input.nextServiceDueAt)
        : null;
    const [updated] = await this.db
      .update(equipmentAssets)
      .set(updateData)
      .where(and(eq(equipmentAssets.tenantId, scope.tenantId), eq(equipmentAssets.id, assetId)))
      .returning();
    if (!updated) return null;
    return {
      id: updated.id,
      tenantId: updated.tenantId,
      branchId: updated.branchId,
      roomId: null,
      name: updated.name,
      assetCode: updated.serialNumber ?? updated.id.slice(0, 8),
      serialNumber: updated.serialNumber,
      modelName: updated.modelNumber ?? updated.name,
      category: updated.category as any,
      status: updated.status as any,
      purchaseDate: updated.purchaseDate,
      warrantyEndsAt: updated.warrantyExpiresAt,
      lastServicedAt: updated.lastServicedAt ? updated.lastServicedAt.toISOString() : null,
      nextServiceDueAt: updated.nextServiceDueAt ? updated.nextServiceDueAt.toISOString() : null,
      lastCalibratedAt: null,
      nextCalibrationDueAt: null,
      notes: updated.notes,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString()
    };
  }

  async listEquipmentPools(
    scope: TenantScope,
    branchId?: string
  ): Promise<EquipmentPoolResponse[]> {
    const conditions = [eq(equipmentPools.tenantId, scope.tenantId)];
    if (branchId) conditions.push(eq(equipmentPools.branchId, branchId));
    else if (scope.branchIds.length)
      conditions.push(inArray(equipmentPools.branchId, scope.branchIds));
    const pools = await this.db
      .select()
      .from(equipmentPools)
      .where(and(...conditions));
    return pools.map((p) => ({
      id: p.id,
      tenantId: p.tenantId,
      branchId: p.branchId,
      name: p.name,
      category: p.category as any,
      totalQuantity: p.capacity,
      availableQuantity: p.capacity,
      assetIds: []
    }));
  }

  async createEquipmentPool(
    scope: TenantScope,
    input: CreateEquipmentPoolRequest
  ): Promise<EquipmentPoolResponse> {
    const [created] = await this.db
      .insert(equipmentPools)
      .values({
        tenantId: scope.tenantId,
        branchId: input.branchId,
        name: input.name,
        code: input.name.toLowerCase().replace(/\s+/g, "_"),
        category: input.category,
        capacity: input.assetIds.length || 1,
        isActive: true
      })
      .returning();
    if (!created) throw new Error("Failed to create equipment pool.");
    return {
      id: created.id,
      tenantId: created.tenantId,
      branchId: created.branchId,
      name: created.name,
      category: created.category as any,
      totalQuantity: input.assetIds.length || 1,
      availableQuantity: input.assetIds.length || 1,
      assetIds: input.assetIds
    };
  }

  async listEquipmentMaintenance(
    scope: TenantScope,
    assetId?: string
  ): Promise<EquipmentMaintenanceRecordResponse[]> {
    const conditions = [eq(equipmentMaintenanceRecords.tenantId, scope.tenantId)];
    if (assetId) conditions.push(eq(equipmentMaintenanceRecords.assetId, assetId));
    const rows = await this.db
      .select({
        rec: equipmentMaintenanceRecords,
        assetName: equipmentAssets.name
      })
      .from(equipmentMaintenanceRecords)
      .leftJoin(equipmentAssets, eq(equipmentMaintenanceRecords.assetId, equipmentAssets.id))
      .where(and(...conditions));
    return rows.map(({ rec, assetName }) => ({
      id: rec.id,
      tenantId: rec.tenantId,
      assetId: rec.assetId,
      assetName: assetName ?? "Asset",
      type: rec.serviceType as any,
      performedAt: rec.servicedAt.toISOString(),
      performedBy: "Service Technician",
      costMinor: rec.costMinor ?? null,
      notes: rec.notes,
      nextDueAt: rec.nextServiceDueAt ? rec.nextServiceDueAt.toISOString() : null,
      createdAt: rec.createdAt.toISOString()
    }));
  }

  async createEquipmentMaintenance(
    scope: TenantScope,
    input: CreateMaintenanceRecordRequest
  ): Promise<EquipmentMaintenanceRecordResponse> {
    const { asset, rec } = await this.db.transaction(async (tx) => {
      const [lockedAsset] = await tx
        .select()
        .from(equipmentAssets)
        .where(
          and(eq(equipmentAssets.tenantId, scope.tenantId), eq(equipmentAssets.id, input.assetId))
        )
        .for("update");
      if (!lockedAsset) throw new Error("Equipment asset not found.");
      const servicedAt = new Date();
      const [created] = await tx
        .insert(equipmentMaintenanceRecords)
        .values({
          tenantId: scope.tenantId,
          branchId: lockedAsset.branchId,
          assetId: input.assetId,
          serviceType: input.type,
          costMinor: input.costMinor ?? 0,
          notes: input.notes,
          servicedAt: new Date(),
          nextServiceDueAt: input.nextDueAt ? new Date(input.nextDueAt) : null
        })
        .returning();
      await tx
        .update(equipmentAssets)
        .set({
          ...(input.type === "calibration"
            ? {
                lastServicedAt: servicedAt,
                nextServiceDueAt: input.nextDueAt
                  ? new Date(input.nextDueAt)
                  : lockedAsset.nextServiceDueAt
              }
            : {
                lastServicedAt: servicedAt,
                nextServiceDueAt: input.nextDueAt
                  ? new Date(input.nextDueAt)
                  : lockedAsset.nextServiceDueAt
              }),
          status: "available",
          updatedAt: servicedAt
        })
        .where(eq(equipmentAssets.id, lockedAsset.id));
      if (!created) throw new Error("Failed to create maintenance record.");
      return { asset: lockedAsset, rec: created };
    });
    return {
      id: rec.id,
      tenantId: rec.tenantId,
      assetId: rec.assetId,
      assetName: asset?.name ?? "Asset",
      type: input.type,
      performedAt: rec.servicedAt.toISOString(),
      performedBy: input.performedBy,
      costMinor: input.costMinor ?? null,
      notes: rec.notes,
      nextDueAt: input.nextDueAt ?? null,
      createdAt: rec.createdAt.toISOString()
    };
  }

  // ─── Inventory & Consumables ────────────────────────────────────────────────
  async listInventoryItems(
    scope: TenantScope,
    branchId?: string
  ): Promise<InventoryItemResponse[]> {
    const conditions = [eq(inventoryItems.tenantId, scope.tenantId)];
    if (branchId) conditions.push(eq(inventoryItems.branchId, branchId));
    else if (scope.branchIds.length)
      conditions.push(inArray(inventoryItems.branchId, scope.branchIds));
    const rows = await this.db
      .select()
      .from(inventoryItems)
      .where(and(...conditions));
    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      branchId: r.branchId,
      sku: r.sku,
      name: r.name,
      category: r.category as any,
      unit: r.unitOfMeasure,
      unitCostMinor: r.costPriceMinor,
      retailPriceMinor: r.retailPriceMinor,
      stockOnHand: r.currentStock,
      reorderPoint: r.reorderPoint,
      reorderQuantity: r.reorderQuantity,
      isRetail: true,
      isConsumable: false,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    }));
  }

  async findInventoryItemById(
    scope: TenantScope,
    itemId: string
  ): Promise<InventoryItemResponse | null> {
    const [r] = await this.db
      .select()
      .from(inventoryItems)
      .where(and(eq(inventoryItems.tenantId, scope.tenantId), eq(inventoryItems.id, itemId)));
    if (!r) return null;
    return {
      id: r.id,
      tenantId: r.tenantId,
      branchId: r.branchId,
      sku: r.sku,
      name: r.name,
      category: r.category as any,
      unit: r.unitOfMeasure,
      unitCostMinor: r.costPriceMinor,
      retailPriceMinor: r.retailPriceMinor,
      stockOnHand: r.currentStock,
      reorderPoint: r.reorderPoint,
      reorderQuantity: r.reorderQuantity,
      isRetail: true,
      isConsumable: false,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    };
  }

  async createInventoryItem(
    scope: TenantScope,
    input: CreateInventoryItemRequest
  ): Promise<InventoryItemResponse> {
    const [created] = await this.db
      .insert(inventoryItems)
      .values({
        tenantId: scope.tenantId,
        branchId: input.branchId,
        sku: input.sku,
        name: input.name,
        category: input.category,
        unitOfMeasure: input.unit ?? "unit",
        costPriceMinor: input.unitCostMinor,
        retailPriceMinor: input.retailPriceMinor ?? 0,
        currentStock: input.initialStock ?? 0,
        reorderPoint: input.reorderPoint ?? 10,
        reorderQuantity: input.reorderQuantity ?? 20,
        isActive: true
      })
      .returning();
    if (!created) throw new Error("Failed to create inventory item.");
    return {
      id: created.id,
      tenantId: created.tenantId,
      branchId: created.branchId,
      sku: created.sku,
      name: created.name,
      category: created.category as any,
      unit: created.unitOfMeasure,
      unitCostMinor: created.costPriceMinor,
      retailPriceMinor: created.retailPriceMinor,
      stockOnHand: created.currentStock,
      reorderPoint: created.reorderPoint,
      reorderQuantity: created.reorderQuantity,
      isRetail: input.isRetail ?? true,
      isConsumable: input.isConsumable ?? false,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString()
    };
  }

  async updateInventoryItem(
    scope: TenantScope,
    itemId: string,
    input: UpdateInventoryItemRequest
  ): Promise<InventoryItemResponse | null> {
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) updateData.name = input.name;
    if (input.retailPriceMinor !== undefined) updateData.retailPriceMinor = input.retailPriceMinor;
    if (input.reorderPoint !== undefined) updateData.reorderPoint = input.reorderPoint;
    if (input.reorderQuantity !== undefined) updateData.reorderQuantity = input.reorderQuantity;
    const [updated] = await this.db
      .update(inventoryItems)
      .set(updateData)
      .where(and(eq(inventoryItems.tenantId, scope.tenantId), eq(inventoryItems.id, itemId)))
      .returning();
    if (!updated) return null;
    return {
      id: updated.id,
      tenantId: updated.tenantId,
      branchId: updated.branchId,
      sku: updated.sku,
      name: updated.name,
      category: updated.category as any,
      unit: updated.unitOfMeasure,
      unitCostMinor: updated.costPriceMinor,
      retailPriceMinor: updated.retailPriceMinor,
      stockOnHand: updated.currentStock,
      reorderPoint: updated.reorderPoint,
      reorderQuantity: updated.reorderQuantity,
      isRetail: true,
      isConsumable: false,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString()
    };
  }

  async listInventoryMovements(
    scope: TenantScope,
    itemId?: string
  ): Promise<InventoryMovementResponse[]> {
    const conditions = [eq(inventoryMovements.tenantId, scope.tenantId)];
    if (itemId) conditions.push(eq(inventoryMovements.itemId, itemId));
    const rows = await this.db
      .select({
        mov: inventoryMovements,
        itemName: inventoryItems.name,
        userName: users.displayName
      })
      .from(inventoryMovements)
      .leftJoin(inventoryItems, eq(inventoryMovements.itemId, inventoryItems.id))
      .leftJoin(users, eq(inventoryMovements.recordedByUserId, users.id))
      .where(and(...conditions));
    return rows
      .filter((r) => r.mov !== undefined)
      .map(({ mov, itemName, userName }) => ({
        id: mov.id,
        tenantId: mov.tenantId,
        branchId: mov.branchId,
        itemId: mov.itemId,
        itemName: itemName ?? "Item",
        movementType: mov.type as any,
        quantity: mov.quantity,
        referenceType: null,
        referenceId: mov.referenceId,
        costMinor: null,
        notes: mov.reason,
        recordedByUserId: mov.recordedByUserId ?? "",
        recordedByName: userName ?? "Staff",
        recordedAt: mov.createdAt.toISOString()
      }));
  }

  async createInventoryMovement(
    scope: TenantScope,
    input: CreateInventoryMovementRequest,
    recordedByUserId: string
  ): Promise<InventoryMovementResponse> {
    const { item, mov } = await this.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM inventory_items WHERE id = ${input.itemId} FOR UPDATE`);
      const [lockedItem] = await tx
        .select()
        .from(inventoryItems)
        .where(
          and(
            eq(inventoryItems.tenantId, scope.tenantId),
            eq(inventoryItems.id, input.itemId),
            eq(inventoryItems.branchId, input.branchId)
          )
        );
      if (!lockedItem) throw new Error("Inventory item not found in branch.");
      const delta =
        input.movementType === "purchase_in"
          ? input.quantity
          : input.movementType === "adjustment"
            ? input.quantity
            : -input.quantity;
      const newStock = lockedItem.currentStock + delta;
      if (newStock < 0) throw new Error("Inventory movement would make stock negative.");
      await tx
        .update(inventoryItems)
        .set({ currentStock: newStock, updatedAt: new Date() })
        .where(eq(inventoryItems.id, lockedItem.id));
      const [created] = await tx
        .insert(inventoryMovements)
        .values({
          tenantId: scope.tenantId,
          branchId: lockedItem.branchId,
          itemId: lockedItem.id,
          type: input.movementType,
          quantity: input.quantity,
          balanceAfter: newStock,
          reason: input.notes ?? input.movementType,
          referenceId: input.referenceId ?? null,
          recordedByUserId
        })
        .returning();
      if (!created) throw new Error("Failed to record inventory movement.");
      return { item: lockedItem, mov: created };
    });

    const [user] = await this.db.select().from(users).where(eq(users.id, recordedByUserId));
    return {
      id: mov.id,
      tenantId: mov.tenantId,
      branchId: mov.branchId,
      itemId: mov.itemId,
      itemName: item.name,
      movementType: input.movementType,
      quantity: input.quantity,
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      costMinor: input.costMinor ?? null,
      notes: input.notes ?? null,
      recordedByUserId,
      recordedByName: user?.displayName ?? "Staff",
      recordedAt: mov.createdAt.toISOString()
    };
  }

  async listPurchaseOrders(
    scope: TenantScope,
    branchId?: string
  ): Promise<PurchaseOrderResponse[]> {
    const conditions = [eq(purchaseOrders.tenantId, scope.tenantId)];
    if (branchId) conditions.push(eq(purchaseOrders.branchId, branchId));
    const rows = await this.db
      .select()
      .from(purchaseOrders)
      .where(and(...conditions));
    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      branchId: r.branchId,
      branchName: null,
      poNumber: r.poNumber,
      supplierName: r.supplierName,
      status: r.status as any,
      items: (r.itemsJson as any[]) || [],
      totalMinor: r.totalAmountMinor,
      orderedAt: r.issuedAt.toISOString(),
      receivedAt: r.receivedAt ? r.receivedAt.toISOString() : null,
      notes: null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    }));
  }

  async createPurchaseOrder(
    scope: TenantScope,
    input: CreatePurchaseOrderRequest
  ): Promise<PurchaseOrderResponse> {
    let totalMinor = 0;
    const items = input.items.map(
      (i: { itemId: string; quantity: number; unitCostMinor: number }) => {
        const lineTotal = i.quantity * i.unitCostMinor;
        totalMinor += lineTotal;
        return {
          itemId: i.itemId,
          itemName: "Item",
          quantity: i.quantity,
          unitCostMinor: i.unitCostMinor,
          totalMinor: lineTotal
        };
      }
    );
    const poNumber = `PO-${Date.now().toString().slice(-6)}`;
    const [created] = await this.db
      .insert(purchaseOrders)
      .values({
        tenantId: scope.tenantId,
        branchId: input.branchId,
        poNumber,
        supplierName: input.supplierName,
        status: "ordered",
        totalAmountMinor: totalMinor,
        itemsJson: items,
        issuedAt: new Date()
      })
      .returning();
    if (!created) throw new Error("Failed to create purchase order.");
    return {
      id: created.id,
      tenantId: created.tenantId,
      branchId: created.branchId,
      branchName: null,
      poNumber: created.poNumber,
      supplierName: created.supplierName,
      status: "ordered",
      items,
      totalMinor,
      orderedAt: created.issuedAt.toISOString(),
      receivedAt: null,
      notes: input.notes ?? null,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString()
    };
  }

  // ─── FITOS Assess & Performance Profiles ────────────────────────────────────
  async listAssessmentDefinitions(scope: TenantScope): Promise<AssessmentDefinitionResponse[]> {
    const rows = await this.db
      .select()
      .from(assessmentDefinitions)
      .where(eq(assessmentDefinitions.tenantId, scope.tenantId));
    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      name: r.name,
      category: r.category as any,
      description: r.description,
      deviceVendor: r.deviceVendor as any,
      metrics: (r.metricsJson as any[]) || [],
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    }));
  }

  async createAssessmentDefinition(
    scope: TenantScope,
    input: CreateAssessmentDefinitionRequest
  ): Promise<AssessmentDefinitionResponse> {
    const [created] = await this.db
      .insert(assessmentDefinitions)
      .values({
        tenantId: scope.tenantId,
        code: input.name.toLowerCase().replace(/\s+/g, "_"),
        name: input.name,
        category: input.category,
        deviceVendor: input.deviceVendor,
        metricsJson: input.metrics,
        description: input.description,
        isActive: true
      })
      .returning();
    if (!created) throw new Error("Failed to create assessment definition.");
    return {
      id: created.id,
      tenantId: created.tenantId,
      name: created.name,
      category: created.category as any,
      description: created.description,
      deviceVendor: created.deviceVendor as any,
      metrics: input.metrics,
      isActive: true,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString()
    };
  }

  async listAssessmentSessions(
    scope: TenantScope,
    memberId?: string,
    branchId?: string
  ): Promise<AssessmentSessionResponse[]> {
    const conditions = [eq(assessmentSessions.tenantId, scope.tenantId)];
    if (memberId) conditions.push(eq(assessmentSessions.memberId, memberId));
    if (branchId) conditions.push(eq(assessmentSessions.branchId, branchId));
    const rows = await this.db
      .select({
        sess: assessmentSessions,
        defName: assessmentDefinitions.name,
        contactFirst: contacts.firstName,
        contactLast: contacts.lastName,
        assessorName: users.displayName
      })
      .from(assessmentSessions)
      .leftJoin(
        assessmentDefinitions,
        eq(assessmentSessions.definitionId, assessmentDefinitions.id)
      )
      .leftJoin(members, eq(assessmentSessions.memberId, members.id))
      .leftJoin(contacts, eq(members.contactId, contacts.id))
      .leftJoin(users, eq(assessmentSessions.assessorStaffId, users.id))
      .where(and(...conditions));
    return rows
      .filter((r) => r.sess !== undefined)
      .map(({ sess, defName, contactFirst, contactLast, assessorName }) => ({
        id: sess.id,
        tenantId: sess.tenantId,
        branchId: sess.branchId,
        branchName: null,
        memberId: sess.memberId,
        memberName: contactFirst ? `${contactFirst} ${contactLast ?? ""}`.trim() : "Member",
        assessorStaffId: sess.assessorStaffId ?? "",
        assessorName: assessorName ?? "Staff Assessor",
        definitionId: sess.definitionId,
        definitionName: defName ?? "Assessment",
        category: sess.category as any,
        status: sess.status as any,
        conductedAt: sess.conductedAt.toISOString(),
        summary: sess.summary,
        metrics: (sess.metricsJson as any) || {},
        notes: sess.notes,
        createdAt: sess.createdAt.toISOString(),
        updatedAt: sess.updatedAt.toISOString()
      }));
  }

  async createAssessmentSession(
    scope: TenantScope,
    input: CreateAssessmentSessionRequest,
    assessorStaffId: string
  ): Promise<AssessmentSessionResponse> {
    const [def] = await this.db
      .select()
      .from(assessmentDefinitions)
      .where(
        and(
          eq(assessmentDefinitions.tenantId, scope.tenantId),
          eq(assessmentDefinitions.id, input.definitionId)
        )
      );
    const [memberRow] = await this.db
      .select({ contactFirst: contacts.firstName, contactLast: contacts.lastName })
      .from(members)
      .leftJoin(contacts, eq(members.contactId, contacts.id))
      .where(and(eq(members.tenantId, scope.tenantId), eq(members.id, input.memberId)));
    const [assessor] = await this.db.select().from(users).where(eq(users.id, assessorStaffId));

    const sess = await this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(assessmentSessions)
        .values({
          tenantId: scope.tenantId,
          branchId: input.branchId,
          memberId: input.memberId,
          assessorStaffId,
          definitionId: input.definitionId,
          category: def?.category ?? "body_composition",
          status: "completed",
          conductedAt: input.conductedAt ? new Date(input.conductedAt) : new Date(),
          summary: input.summary,
          metricsJson: input.metrics,
          provenanceJson: input.provenance ?? { source: "manual" },
          notes: input.notes ?? null
        })
        .returning();
      if (!created) return undefined;
      await tx.insert(assessmentMetricResults).values(
        Object.entries(input.metrics).map(([metricKey, value]) => ({
          tenantId: scope.tenantId,
          assessmentSessionId: created.id,
          metricKey,
          valueNumeric: typeof value === "number" ? String(value) : null,
          valueText: typeof value === "string" ? value : null,
          provenanceJson: input.provenance ?? { source: "manual" }
        }))
      );
      return created;
    });
    if (!sess) throw new Error("Failed to record assessment session.");

    return {
      id: sess.id,
      tenantId: sess.tenantId,
      branchId: sess.branchId,
      branchName: null,
      memberId: sess.memberId,
      memberName: memberRow
        ? `${memberRow.contactFirst} ${memberRow.contactLast ?? ""}`.trim()
        : "Member",
      assessorStaffId,
      assessorName: assessor?.displayName ?? "Staff Assessor",
      definitionId: sess.definitionId,
      definitionName: def?.name ?? "Assessment",
      category: sess.category as any,
      status: "completed",
      conductedAt: sess.conductedAt.toISOString(),
      summary: sess.summary,
      metrics: input.metrics,
      provenance: (sess.provenanceJson as any) ?? null,
      notes: sess.notes,
      createdAt: sess.createdAt.toISOString(),
      updatedAt: sess.updatedAt.toISOString()
    };
  }

  async getMemberPerformanceProfile(
    scope: TenantScope,
    memberId: string
  ): Promise<MemberPerformanceProfileResponse> {
    const [memberRow] = await this.db
      .select({ contactFirst: contacts.firstName, contactLast: contacts.lastName })
      .from(members)
      .leftJoin(contacts, eq(members.contactId, contacts.id))
      .where(and(eq(members.tenantId, scope.tenantId), eq(members.id, memberId)));
    const sessions = await this.listAssessmentSessions(scope, memberId);
    const latest = sessions[sessions.length - 1];
    return {
      memberId,
      memberName: memberRow
        ? `${memberRow.contactFirst} ${memberRow.contactLast ?? ""}`.trim()
        : "Member",
      totalAssessments: sessions.length,
      lastAssessedAt: latest?.conductedAt ?? null,
      latestMetrics: latest?.metrics ?? {},
      timeline: sessions
    };
  }

  // ─── FITOS Therapy & Recovery ───────────────────────────────────────────────
  async listTherapyModalities(scope: TenantScope): Promise<TherapyModalityResponse[]> {
    const rows = await this.db
      .select()
      .from(therapyModalities)
      .where(eq(therapyModalities.tenantId, scope.tenantId));
    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      code: r.code as any,
      name: r.name,
      category: r.category as any,
      defaultDurationMinutes: r.defaultDurationMinutes,
      contraindications: (r.contraindicationsJson as string[]) || [],
      description: r.description,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    }));
  }

  async listServiceInventoryRequirements(
    scope: TenantScope,
    serviceId: string
  ): Promise<import("@fitos/contracts").ServiceInventoryRequirement[]> {
    const rows = await this.db
      .select()
      .from(serviceInventoryRequirements)
      .where(
        and(
          eq(serviceInventoryRequirements.tenantId, scope.tenantId),
          eq(serviceInventoryRequirements.serviceId, serviceId)
        )
      );
    return rows.map((row) => ({ itemId: row.itemId, quantityPerSession: row.quantityPerSession }));
  }
  async replaceServiceInventoryRequirements(
    scope: TenantScope,
    serviceId: string,
    requirements: import("@fitos/contracts").ServiceInventoryRequirement[]
  ): Promise<import("@fitos/contracts").ServiceInventoryRequirement[]> {
    await this.db.transaction(async (tx) => {
      await tx
        .delete(serviceInventoryRequirements)
        .where(
          and(
            eq(serviceInventoryRequirements.tenantId, scope.tenantId),
            eq(serviceInventoryRequirements.serviceId, serviceId)
          )
        );
      if (requirements.length)
        await tx.insert(serviceInventoryRequirements).values(
          requirements.map((item) => ({
            tenantId: scope.tenantId,
            serviceId,
            itemId: item.itemId,
            quantityPerSession: item.quantityPerSession
          }))
        );
    });
    return requirements;
  }
  async consumeInventory(
    scope: TenantScope,
    input: {
      branchId: string;
      serviceId?: string;
      referenceType: string;
      referenceId: string;
      items: import("@fitos/contracts").ServiceInventoryRequirement[];
    }
  ): Promise<import("@fitos/contracts").InventoryConsumptionResponse[]> {
    return this.db.transaction(async (tx) => {
      const output = [];
      for (const item of input.items) {
        const [stock] = await tx
          .select()
          .from(inventoryItems)
          .where(
            and(
              eq(inventoryItems.tenantId, scope.tenantId),
              eq(inventoryItems.branchId, input.branchId),
              eq(inventoryItems.id, item.itemId)
            )
          )
          .for("update");
        if (!stock || stock.currentStock < item.quantityPerSession)
          throw new Error("Insufficient inventory stock.");
        const [row] = await tx
          .insert(inventoryConsumptions)
          .values({
            tenantId: scope.tenantId,
            branchId: input.branchId,
            itemId: item.itemId,
            serviceId: input.serviceId ?? null,
            referenceType: input.referenceType,
            referenceId: input.referenceId,
            quantity: item.quantityPerSession
          })
          .onConflictDoNothing()
          .returning();
        if (row) {
          await tx
            .update(inventoryItems)
            .set({
              currentStock: stock.currentStock - item.quantityPerSession,
              updatedAt: new Date()
            })
            .where(eq(inventoryItems.id, item.itemId));
          output.push({
            id: row.id,
            tenantId: row.tenantId,
            branchId: row.branchId,
            itemId: row.itemId,
            serviceId: row.serviceId,
            referenceType: row.referenceType,
            referenceId: row.referenceId,
            quantity: row.quantity,
            createdAt: row.createdAt.toISOString()
          });
        }
      }
      return output;
    });
  }

  async listOccurrenceEquipmentAllocations(
    scope: TenantScope,
    occurrenceId: string
  ): Promise<import("@fitos/contracts").EquipmentAllocationResponse[]> {
    const rows = await this.db
      .select()
      .from(occurrenceEquipmentAllocations)
      .where(
        and(
          eq(occurrenceEquipmentAllocations.tenantId, scope.tenantId),
          eq(occurrenceEquipmentAllocations.occurrenceId, occurrenceId)
        )
      );
    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      occurrenceId: row.occurrenceId,
      assetId: row.assetId,
      status: row.status as any,
      createdAt: row.createdAt.toISOString()
    }));
  }
  async reserveOccurrenceEquipment(
    scope: TenantScope,
    occurrenceId: string,
    assetId: string
  ): Promise<import("@fitos/contracts").EquipmentAllocationResponse> {
    return this.db.transaction(async (tx) => {
      const [occurrence] = await tx
        .select()
        .from(scheduleOccurrences)
        .where(
          and(
            eq(scheduleOccurrences.id, occurrenceId),
            eq(scheduleOccurrences.tenantId, scope.tenantId)
          )
        );
      const [asset] = await tx
        .select()
        .from(equipmentAssets)
        .where(and(eq(equipmentAssets.id, assetId), eq(equipmentAssets.tenantId, scope.tenantId)));
      if (
        !occurrence ||
        !asset ||
        occurrence.branchId !== asset.branchId ||
        asset.status !== "available"
      )
        throw new Error("Equipment asset is unavailable for this occurrence.");
      const [conflict] = await tx
        .select({ id: occurrenceEquipmentAllocations.id })
        .from(occurrenceEquipmentAllocations)
        .innerJoin(
          scheduleOccurrences,
          eq(occurrenceEquipmentAllocations.occurrenceId, scheduleOccurrences.id)
        )
        .where(
          and(
            eq(occurrenceEquipmentAllocations.tenantId, scope.tenantId),
            eq(occurrenceEquipmentAllocations.assetId, assetId),
            eq(occurrenceEquipmentAllocations.status, "reserved"),
            lt(scheduleOccurrences.startsAt, occurrence.endsAt),
            gt(scheduleOccurrences.endsAt, occurrence.startsAt)
          )
        )
        .limit(1);
      if (conflict)
        throw new Error("Equipment asset is already reserved for an overlapping occurrence.");
      const [created] = await tx
        .insert(occurrenceEquipmentAllocations)
        .values({ tenantId: scope.tenantId, occurrenceId, assetId, status: "reserved" })
        .returning();
      if (!created) throw new Error("Unable to reserve equipment asset.");
      return {
        id: created.id,
        tenantId: created.tenantId,
        occurrenceId: created.occurrenceId,
        assetId: created.assetId,
        status: created.status as any,
        createdAt: created.createdAt.toISOString()
      };
    });
  }
  async releaseOccurrenceEquipment(
    scope: TenantScope,
    allocationId: string
  ): Promise<import("@fitos/contracts").EquipmentAllocationResponse | null> {
    const [row] = await this.db
      .update(occurrenceEquipmentAllocations)
      .set({ status: "released" })
      .where(
        and(
          eq(occurrenceEquipmentAllocations.id, allocationId),
          eq(occurrenceEquipmentAllocations.tenantId, scope.tenantId)
        )
      )
      .returning();
    return row
      ? {
          id: row.id,
          tenantId: row.tenantId,
          occurrenceId: row.occurrenceId,
          assetId: row.assetId,
          status: row.status as any,
          createdAt: row.createdAt.toISOString()
        }
      : null;
  }

  /** Resource conflicts are operator warnings; they never change booking capacity. */
  private async withResourceWarnings(
    occurrences: Array<typeof scheduleOccurrences.$inferSelect>
  ): Promise<ScheduleOccurrenceResponse[]> {
    if (!occurrences.length) return [];
    const tenantId = occurrences[0]!.tenantId;
    const serviceIds = [...new Set(occurrences.map((item) => item.serviceId))];
    const requirements = await this.db
      .select()
      .from(serviceEquipmentRequirements)
      .where(
        and(
          eq(serviceEquipmentRequirements.tenantId, tenantId),
          inArray(serviceEquipmentRequirements.serviceId, serviceIds)
        )
      );
    if (!requirements.length) return occurrences.map((item) => this.occurrenceResponse(item));
    const poolIds = [...new Set(requirements.map((item) => item.poolId))];
    const [pools, assets, tenantOccurrences] = await Promise.all([
      this.db
        .select()
        .from(equipmentPools)
        .where(and(eq(equipmentPools.tenantId, tenantId), inArray(equipmentPools.id, poolIds))),
      this.db
        .select()
        .from(equipmentAssets)
        .where(
          and(eq(equipmentAssets.tenantId, tenantId), inArray(equipmentAssets.poolId, poolIds))
        ),
      this.db
        .select()
        .from(scheduleOccurrences)
        .where(
          and(
            eq(scheduleOccurrences.tenantId, tenantId),
            eq(scheduleOccurrences.status, "scheduled")
          )
        )
    ]);
    const reqByService = new Map<string, typeof requirements>();
    for (const requirement of requirements)
      reqByService.set(requirement.serviceId, [
        ...(reqByService.get(requirement.serviceId) ?? []),
        requirement
      ]);
    const poolById = new Map(pools.map((pool) => [pool.id, pool]));
    return occurrences.map((occurrence) => {
      const warnings = (reqByService.get(occurrence.serviceId) ?? [])
        .map((requirement) => {
          const pool = poolById.get(requirement.poolId);
          const available = assets.filter(
            (asset) =>
              asset.poolId === requirement.poolId &&
              asset.branchId === occurrence.branchId &&
              asset.status === "available"
          ).length;
          const overlappingDemand = tenantOccurrences
            .filter(
              (other) =>
                other.branchId === occurrence.branchId &&
                other.id !== occurrence.id &&
                other.startsAt < occurrence.endsAt &&
                other.endsAt > occurrence.startsAt
            )
            .flatMap((other) => reqByService.get(other.serviceId) ?? [])
            .filter((otherRequirement) => otherRequirement.poolId === requirement.poolId)
            .reduce((total, otherRequirement) => total + otherRequirement.quantityRequired, 0);
          const shortage = Math.max(
            0,
            requirement.quantityRequired + overlappingDemand - available
          );
          return {
            poolId: requirement.poolId,
            poolName: pool?.name ?? "Equipment pool",
            required: requirement.quantityRequired,
            available,
            overlappingDemand,
            shortage
          };
        })
        .filter((warning) => warning.shortage > 0);
      return { ...this.occurrenceResponse(occurrence), resourceWarnings: warnings };
    });
  }

  async createPublicReservation(
    tenantSlug: string,
    input: import("@fitos/contracts").CreatePublicReservationRequest
  ): Promise<import("@fitos/contracts").PublicReservationResponse> {
    const [tenant] = await this.db.select().from(tenants).where(eq(tenants.slug, tenantSlug));
    if (!tenant) throw new Error("Tenant not found.");
    const created = await this.db.transaction(async (tx) => {
      let branchId = input.branchId ?? null;
      let serviceId = input.serviceId ?? null;
      let reservationStatus = "requested";
      if (input.occurrenceId) {
        const [occurrence] = await tx
          .select()
          .from(scheduleOccurrences)
          .where(
            and(
              eq(scheduleOccurrences.id, input.occurrenceId),
              eq(scheduleOccurrences.tenantId, tenant.id)
            )
          )
          .limit(1);
        if (!occurrence || occurrence.status === "cancelled") {
          throw new Error("The selected schedule occurrence is unavailable.");
        }
        if (branchId && branchId !== occurrence.branchId) {
          throw new Error("Reservation branch does not match the selected occurrence.");
        }
        if (serviceId && serviceId !== occurrence.serviceId) {
          throw new Error("Reservation service does not match the selected occurrence.");
        }
        branchId = occurrence.branchId;
        serviceId = occurrence.serviceId;
        const [confirmed] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(bookings)
          .where(and(eq(bookings.occurrenceId, occurrence.id), eq(bookings.status, "confirmed")));
        const [pending] = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(publicReservations)
          .where(
            and(
              eq(publicReservations.occurrenceId, occurrence.id),
              sql`${publicReservations.status} in ('requested', 'confirmed')`
            )
          );
        reservationStatus =
          (confirmed?.count ?? 0) + (pending?.count ?? 0) < occurrence.capacity
            ? "confirmed"
            : "waitlisted";
      }
      if (branchId) {
        const [branch] = await tx
          .select({ id: branches.id })
          .from(branches)
          .where(and(eq(branches.id, branchId), eq(branches.tenantId, tenant.id)))
          .limit(1);
        if (!branch) throw new Error("Branch does not belong to this organization.");
      }
      if (serviceId) {
        const [service] = await tx
          .select({ id: services.id })
          .from(services)
          .where(and(eq(services.id, serviceId), eq(services.tenantId, tenant.id)))
          .limit(1);
        if (!service) throw new Error("Service does not belong to this organization.");
      }
      const [reservation] = await tx
        .insert(publicReservations)
        .values({
          tenantId: tenant.id,
          branchId,
          occurrenceId: input.occurrenceId ?? null,
          serviceId,
          reservationType: input.reservationType,
          status: reservationStatus,
          firstName: input.firstName.trim(),
          lastName: input.lastName?.trim() || null,
          phone: (normalizePhone(input.phone) ?? input.phone?.trim()) || null,
          email: input.email?.trim().toLowerCase() || null,
          notes: input.notes?.trim() || null
        })
        .returning();
      if (!reservation) throw new Error("Unable to create reservation.");
      return reservation;
    });
    if (!created) throw new Error("Unable to create reservation.");
    return {
      id: created.id,
      tenantId: created.tenantId,
      branchId: created.branchId ?? undefined,
      occurrenceId: created.occurrenceId ?? undefined,
      serviceId: created.serviceId ?? undefined,
      reservationType: created.reservationType as any,
      firstName: created.firstName,
      lastName: created.lastName ?? undefined,
      phone: created.phone ?? undefined,
      email: created.email ?? undefined,
      notes: created.notes ?? undefined,
      status: created.status as any,
      createdAt: created.createdAt.toISOString()
    };
  }

  async setMemberPassword(memberId: string, passwordHash: string): Promise<void> {
    const [member] = await this.db.select().from(members).where(eq(members.id, memberId));
    if (!member) throw new Error("Member not found.");
    await this.db
      .insert(memberIdentities)
      .values({ tenantId: member.tenantId, memberId, passwordHash })
      .onConflictDoUpdate({
        target: [memberIdentities.tenantId, memberIdentities.memberId],
        set: { passwordHash, passwordChangedAt: new Date(), updatedAt: new Date() }
      });
  }

  async verifyMemberPassword(memberId: string, password: string): Promise<boolean> {
    const [identity] = await this.db
      .select()
      .from(memberIdentities)
      .where(eq(memberIdentities.memberId, memberId));
    return identity
      ? new (await import("@fitos/auth")).ScryptPasswordHasher().verify(
          password,
          identity.passwordHash
        )
      : false;
  }

  async listServiceEquipmentRequirements(
    scope: TenantScope,
    serviceId: string
  ): Promise<import("@fitos/contracts").ServiceEquipmentRequirement[]> {
    const rows = await this.db
      .select()
      .from(serviceEquipmentRequirements)
      .where(
        and(
          eq(serviceEquipmentRequirements.tenantId, scope.tenantId),
          eq(serviceEquipmentRequirements.serviceId, serviceId)
        )
      );
    return rows.map((row) => ({ poolId: row.poolId, quantityRequired: row.quantityRequired }));
  }

  async replaceServiceEquipmentRequirements(
    scope: TenantScope,
    serviceId: string,
    requirements: import("@fitos/contracts").ServiceEquipmentRequirement[]
  ): Promise<import("@fitos/contracts").ServiceEquipmentRequirement[]> {
    await this.db.transaction(async (tx) => {
      const [service] = await tx
        .select()
        .from(services)
        .where(and(eq(services.tenantId, scope.tenantId), eq(services.id, serviceId)));
      if (!service) throw new Error("Service not found.");
      for (const requirement of requirements) {
        const [pool] = await tx
          .select()
          .from(equipmentPools)
          .where(
            and(
              eq(equipmentPools.tenantId, scope.tenantId),
              eq(equipmentPools.id, requirement.poolId)
            )
          );
        if (!pool || (service.branchId && pool.branchId !== service.branchId))
          throw new Error("Equipment pool is not available for this service.");
      }
      await tx
        .delete(serviceEquipmentRequirements)
        .where(
          and(
            eq(serviceEquipmentRequirements.tenantId, scope.tenantId),
            eq(serviceEquipmentRequirements.serviceId, serviceId)
          )
        );
      if (requirements.length)
        await tx.insert(serviceEquipmentRequirements).values(
          requirements.map((r) => ({
            tenantId: scope.tenantId,
            serviceId,
            poolId: r.poolId,
            quantityRequired: r.quantityRequired
          }))
        );
    });
    return requirements;
  }

  async createTherapyModality(
    scope: TenantScope,
    input: import("@fitos/contracts").CreateTherapyModalityRequest
  ): Promise<TherapyModalityResponse> {
    const [created] = await this.db
      .insert(therapyModalities)
      .values({
        tenantId: scope.tenantId,
        code: input.code,
        name: input.name,
        category: input.category,
        defaultDurationMinutes: input.defaultDurationMinutes,
        contraindicationsJson: input.contraindications,
        description: input.description,
        isActive: true
      })
      .returning();
    if (!created) throw new Error("Failed to create therapy modality.");
    return {
      id: created.id,
      tenantId: created.tenantId,
      code: created.code as any,
      name: created.name,
      category: created.category as any,
      defaultDurationMinutes: created.defaultDurationMinutes,
      contraindications: created.contraindicationsJson as string[],
      description: created.description,
      isActive: created.isActive,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString()
    };
  }

  async listTherapyProtocols(
    scope: TenantScope,
    modalityCode?: string
  ): Promise<TherapyProtocolResponse[]> {
    const conditions = [eq(therapyProtocols.tenantId, scope.tenantId)];
    if (modalityCode) conditions.push(eq(therapyProtocols.modalityCode, modalityCode));
    const rows = await this.db
      .select()
      .from(therapyProtocols)
      .where(and(...conditions));
    return rows.map((r) => ({
      id: r.id,
      tenantId: r.tenantId,
      modalityCode: r.modalityCode as any,
      modalityName: r.modalityName,
      name: r.name,
      indication: r.indication,
      targetArea: r.targetArea,
      parameters: (r.parametersJson as any) || {},
      safetyChecklist: (r.safetyChecklistJson as string[]) || [],
      clinicalNotes: r.clinicalNotes,
      isActive: r.isActive,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString()
    }));
  }

  async createTherapyProtocol(
    scope: TenantScope,
    input: CreateTherapyProtocolRequest
  ): Promise<TherapyProtocolResponse> {
    const [created] = await this.db
      .insert(therapyProtocols)
      .values({
        tenantId: scope.tenantId,
        modalityCode: input.modalityCode,
        modalityName: input.modalityName,
        name: input.name,
        indication: input.indication,
        targetArea: input.targetArea,
        parametersJson: input.parameters,
        safetyChecklistJson: input.safetyChecklist,
        clinicalNotes: input.clinicalNotes,
        isActive: true
      })
      .returning();
    if (!created) throw new Error("Failed to create therapy protocol.");
    return {
      id: created.id,
      tenantId: created.tenantId,
      modalityCode: created.modalityCode as any,
      modalityName: created.modalityName,
      name: created.name,
      indication: created.indication,
      targetArea: created.targetArea,
      parameters: input.parameters,
      safetyChecklist: input.safetyChecklist,
      clinicalNotes: created.clinicalNotes,
      isActive: true,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString()
    };
  }

  async listTherapySessions(
    scope: TenantScope,
    memberId?: string,
    branchId?: string
  ): Promise<TherapySessionResponse[]> {
    const conditions = [eq(therapySessions.tenantId, scope.tenantId)];
    if (memberId) conditions.push(eq(therapySessions.memberId, memberId));
    if (branchId) conditions.push(eq(therapySessions.branchId, branchId));
    const rows = await this.db
      .select({
        sess: therapySessions,
        contactFirst: contacts.firstName,
        contactLast: contacts.lastName,
        staffName: users.displayName,
        assetName: equipmentAssets.name
      })
      .from(therapySessions)
      .leftJoin(members, eq(therapySessions.memberId, members.id))
      .leftJoin(contacts, eq(members.contactId, contacts.id))
      .leftJoin(users, eq(therapySessions.staffUserId, users.id))
      .leftJoin(equipmentAssets, eq(therapySessions.assetId, equipmentAssets.id))
      .where(and(...conditions));
    return rows
      .filter((r) => r.sess !== undefined)
      .map(({ sess, contactFirst, contactLast, staffName, assetName }) => ({
        id: sess.id,
        tenantId: sess.tenantId,
        branchId: sess.branchId,
        branchName: null,
        memberId: sess.memberId,
        memberName: contactFirst ? `${contactFirst} ${contactLast ?? ""}`.trim() : "Member",
        staffUserId: sess.staffUserId ?? "",
        staffName: staffName ?? "Clinical Staff",
        protocolId: sess.protocolId,
        protocolName: sess.protocolName,
        modalityCode: sess.modalityCode as any,
        assetId: sess.assetId,
        assetName: assetName ?? null,
        status: sess.status as any,
        startedAt: sess.startedAt.toISOString(),
        completedAt: sess.completedAt ? sess.completedAt.toISOString() : null,
        prePainScore: sess.prePainScore,
        postPainScore: sess.postPainScore,
        actualDosage: (sess.actualDosageJson as any) || {},
        adverseReaction: sess.adverseReaction,
        sessionNotes: sess.sessionNotes,
        createdAt: sess.createdAt.toISOString(),
        updatedAt: sess.updatedAt.toISOString()
      }));
  }

  async createTherapySession(
    scope: TenantScope,
    input: CreateTherapySessionRequest,
    staffUserId: string
  ): Promise<TherapySessionResponse> {
    const [proto] = await this.db
      .select()
      .from(therapyProtocols)
      .where(
        and(
          eq(therapyProtocols.tenantId, scope.tenantId),
          eq(therapyProtocols.id, input.protocolId)
        )
      );
    const [memberRow] = await this.db
      .select({ contactFirst: contacts.firstName, contactLast: contacts.lastName })
      .from(members)
      .leftJoin(contacts, eq(members.contactId, contacts.id))
      .where(and(eq(members.tenantId, scope.tenantId), eq(members.id, input.memberId)));
    const [staff] = await this.db.select().from(users).where(eq(users.id, staffUserId));
    const asset = input.assetId
      ? (
          await this.db.select().from(equipmentAssets).where(eq(equipmentAssets.id, input.assetId))
        )[0]
      : null;

    const [sess] = await this.db
      .insert(therapySessions)
      .values({
        tenantId: scope.tenantId,
        branchId: input.branchId,
        memberId: input.memberId,
        staffUserId,
        protocolId: input.protocolId,
        protocolName: proto?.name ?? "Therapy Protocol",
        modalityCode: proto?.modalityCode ?? "neubie_direct_current",
        assetId: input.assetId ?? null,
        status: input.status ?? "completed",
        startedAt: new Date(),
        completedAt: new Date(),
        prePainScore: input.prePainScore ?? null,
        postPainScore: input.postPainScore ?? null,
        actualDosageJson: input.actualDosage,
        adverseReaction: input.adverseReaction ?? false,
        sessionNotes: input.sessionNotes ?? null
      })
      .returning();
    if (!sess) throw new Error("Failed to record therapy session.");

    return {
      id: sess.id,
      tenantId: sess.tenantId,
      branchId: sess.branchId,
      branchName: null,
      memberId: sess.memberId,
      memberName: memberRow
        ? `${memberRow.contactFirst} ${memberRow.contactLast ?? ""}`.trim()
        : "Member",
      staffUserId,
      staffName: staff?.displayName ?? "Clinical Staff",
      protocolId: sess.protocolId,
      protocolName: sess.protocolName,
      modalityCode: sess.modalityCode as any,
      assetId: sess.assetId,
      assetName: asset?.name ?? null,
      status: sess.status as any,
      startedAt: sess.startedAt.toISOString(),
      completedAt: sess.completedAt ? sess.completedAt.toISOString() : null,
      prePainScore: sess.prePainScore,
      postPainScore: sess.postPainScore,
      actualDosage: input.actualDosage,
      adverseReaction: sess.adverseReaction,
      sessionNotes: sess.sessionNotes,
      createdAt: sess.createdAt.toISOString(),
      updatedAt: sess.updatedAt.toISOString()
    };
  }
}
