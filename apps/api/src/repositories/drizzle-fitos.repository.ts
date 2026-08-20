import { and, desc, eq, gt, ilike, inArray, isNull, lt, lte, or, sql } from "drizzle-orm";
import {
  auditEvents,
  bookings,
  branches,
  contacts,
  createDatabase,
  creditLedger,
  idempotencyKeys,
  leadEvents,
  leadNotes,
  leadTasks,
  leads,
  memberMemberships,
  members,
  membershipPlans,
  paymentTransactions,
  attendanceRecords,
  rolePermissions,
  roles,
  rooms,
  scheduleExceptions,
  scheduleOccurrences,
  scheduleTemplates,
  sessions,
  services,
  tenantUsers,
  tenants,
  userBranchAccess,
  users,
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
  AttendanceListFilters
} from "@fitos/contracts";
import { decodeCursor, encodeCursor } from "@fitos/shared";
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
    return this.occurrenceResponse(occurrence);
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
      data: rows.slice(0, limit).map((occurrence) => this.occurrenceResponse(occurrence)),
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
      if ((capacity?.count ?? 0) >= occurrence.capacity) throw new Error("Occurrence is full.");

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
}
