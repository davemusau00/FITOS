import { randomUUID } from "node:crypto";
import type {
  AuditEventResponse,
  AuditRecordInput,
  BranchResponse,
  CreateBranchRequest,
  CreateMemberRequest,
  CursorPage,
  DomainEvent,
  MemberListFilters,
  MemberListItem,
  MemberResponse,
  CreateLeadRequest,
  LeadListFilters,
  LeadConversionResponse,
  LeadNoteResponse,
  LeadResponse,
  LeadTaskResponse,
  CreateLeadTaskRequest,
  UpdateLeadStageRequest,
  PermissionKey,
  RoleKey,
  RoleResponse,
  StaffUserResponse,
  TenantSummary,
  UpdateBranchRequest,
  UpdateMemberRequest,
  UpdateOrganizationRequest,
  UserSummary,
  CreateRoomRequest,
  CreateScheduleOccurrenceRequest,
  CreateServiceRequest,
  RoomResponse,
  ScheduleOccurrenceFilters,
  ScheduleOccurrenceResponse,
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
  CreditReason,
  PaymentTransactionResponse,
  CreatePaymentRequest,
  PaymentListFilters,
  AttendanceRecordResponse,
  CheckInRequest,
  UpdateRosterStatusRequest,
  AttendanceListFilters
} from "@fitos/contracts";
import { DEFAULT_ROLE_PERMISSIONS } from "@fitos/contracts";
import { decodeCursor, encodeCursor } from "@fitos/shared";
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

type StoredTenant = TenantSummary;
type StoredBranch = BranchResponse & { tenantId: string };
type StoredUser = UserSummary & { passwordHash: string };
type StoredRole = RoleResponse & { tenantId: string };
type StoredTenantUser = {
  id: string;
  tenantId: string;
  userId: string;
  roleId: string;
  status: "active" | "invited" | "deactivated";
};
type StoredSession = CreateSessionInput & { id: string; revokedAt: string | null };
type StoredContact = MemberResponse["contact"] & { tenantId: string };
type StoredMember = Omit<MemberResponse, "contact"> & { contactId: string };
type StoredLead = Omit<LeadResponse, "contact"> & { contactId: string };
type StoredLeadNote = LeadNoteResponse & { tenantId: string; leadId: string };
type StoredLeadTask = LeadTaskResponse & { tenantId: string; leadId: string };
type StoredService = ServiceResponse;
type StoredRoom = RoomResponse;
type StoredOccurrence = ScheduleOccurrenceResponse & { cancellationReason: string | null };
type StoredBooking = BookingResponse;
type StoredMembershipPlan = MembershipPlanResponse;
type StoredMemberMembership = MemberMembershipResponse;
type StoredCreditLedgerEntry = CreditLedgerEntryResponse & { tenantId: string };
type StoredPaymentTransaction = PaymentTransactionResponse;
type StoredAttendanceRecord = AttendanceRecordResponse;
type StoredIdempotency = IdempotencyRecord;

const now = () => new Date().toISOString();
const normalizeEmail = (email: string) => email.trim().toLowerCase();
const toSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 100);

export class InMemoryFitosRepository implements FitosRepository {
  private readonly tenants = new Map<string, StoredTenant>();
  private readonly branches = new Map<string, StoredBranch>();
  private readonly users = new Map<string, StoredUser>();
  private readonly roles = new Map<string, StoredRole>();
  private readonly tenantUsers = new Map<string, StoredTenantUser>();
  private readonly branchAccess = new Map<string, Set<string>>();
  private readonly sessions = new Map<string, StoredSession>();
  private readonly contacts = new Map<string, StoredContact>();
  private readonly members = new Map<string, StoredMember>();
  private readonly leads = new Map<string, StoredLead>();
  private readonly leadNotes = new Map<string, StoredLeadNote>();
  private readonly leadTasks = new Map<string, StoredLeadTask>();
  private readonly services = new Map<string, StoredService>();
  private readonly rooms = new Map<string, StoredRoom>();
  private readonly occurrences = new Map<string, StoredOccurrence>();
  private readonly bookings = new Map<string, StoredBooking>();
  private readonly membershipPlans = new Map<string, StoredMembershipPlan>();
  private readonly memberMemberships = new Map<string, StoredMemberMembership>();
  private readonly creditLedger = new Map<string, StoredCreditLedgerEntry>();
  private readonly payments = new Map<string, StoredPaymentTransaction>();
  private readonly attendance = new Map<string, StoredAttendanceRecord>();
  private readonly auditEvents: AuditEventResponse[] = [];
  private readonly idempotency = new Map<string, StoredIdempotency>();
  private readonly domainEvents: DomainEvent[] = [];

  async ping(): Promise<boolean> {
    return true;
  }

  async seedDevelopmentData(passwordHash: string): Promise<void> {
    if (this.tenants.size) return;
    await this.createDemoTenant({
      tenant: { name: "FITOS Demo Gym", slug: "fitos-demo-gym" },
      branch: { name: "Kilimani", slug: "kilimani" },
      owner: { email: "owner@gym.fitos.test", displayName: "Gym Owner", passwordHash }
    });
    await this.createDemoTenant({
      tenant: { name: "FITOS Demo Pilates", slug: "fitos-demo-pilates" },
      branch: { name: "Westlands", slug: "westlands" },
      owner: { email: "owner@pilates.fitos.test", displayName: "Pilates Owner", passwordHash }
    });
  }

  private async createDemoTenant(input: {
    tenant: Pick<TenantSummary, "name" | "slug">;
    branch: Pick<BranchResponse, "name" | "slug">;
    owner: { email: string; displayName: string; passwordHash: string };
  }): Promise<void> {
    const tenantId = randomUUID();
    const tenant: StoredTenant = {
      id: tenantId,
      name: input.tenant.name,
      slug: input.tenant.slug,
      timezone: "Africa/Nairobi",
      currency: "KES",
      status: "active"
    };
    this.tenants.set(tenantId, tenant);
    const timestamp = now();
    const branch: StoredBranch = {
      id: randomUUID(),
      tenantId,
      name: input.branch.name,
      slug: input.branch.slug,
      timezone: null,
      phone: null,
      email: null,
      addressLine1: null,
      addressLine2: null,
      city: "Nairobi",
      countryCode: "KE",
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.branches.set(branch.id, branch);
    const roleByKey = new Map<RoleKey, StoredRole>();
    for (const [key, permissions] of Object.entries(DEFAULT_ROLE_PERMISSIONS) as Array<
      [RoleKey, readonly PermissionKey[]]
    >) {
      const role: StoredRole = {
        id: randomUUID(),
        tenantId,
        key,
        name: key.charAt(0).toUpperCase() + key.slice(1),
        permissions: [...permissions]
      };
      this.roles.set(role.id, role);
      roleByKey.set(key, role);
    }
    const user: StoredUser = {
      id: randomUUID(),
      email: normalizeEmail(input.owner.email),
      displayName: input.owner.displayName,
      status: "active",
      lastLoginAt: null,
      passwordHash: input.owner.passwordHash
    };
    this.users.set(user.id, user);
    const ownerRole = roleByKey.get("owner");
    if (!ownerRole) throw new Error("Owner role unavailable.");
    const tenantUser: StoredTenantUser = {
      id: randomUUID(),
      tenantId,
      userId: user.id,
      roleId: ownerRole.id,
      status: "active"
    };
    this.tenantUsers.set(tenantUser.id, tenantUser);
    this.branchAccess.set(tenantUser.id, new Set([branch.id]));
  }

  async findLoginIdentity(email: string): Promise<LoginIdentity | null> {
    const normalized = normalizeEmail(email);
    const user = [...this.users.values()].find(
      (candidate) => candidate.email === normalized && candidate.status === "active"
    );
    if (!user) return null;
    const tenantUser = [...this.tenantUsers.values()].find(
      (candidate) => candidate.userId === user.id && candidate.status === "active"
    );
    if (!tenantUser) return null;
    const tenant = this.tenants.get(tenantUser.tenantId);
    const role = this.roles.get(tenantUser.roleId);
    if (!tenant || !role) return null;
    return {
      user: this.toUserSummary(user),
      passwordHash: user.passwordHash,
      tenantUserId: tenantUser.id,
      tenant,
      role: this.toRoleResponse(role),
      branchIds: this.resolveBranchIds(tenantUser, role)
    };
  }

  async createSession(input: CreateSessionInput): Promise<{ id: string }> {
    const id = randomUUID();
    this.sessions.set(input.tokenHash, { ...input, id, revokedAt: null });
    return { id };
  }

  async resolveSession(tokenHash: string, currentTime: string): Promise<ResolvedSession | null> {
    const session = this.sessions.get(tokenHash);
    if (!session || session.revokedAt || session.expiresAt <= currentTime) return null;
    const tenantUser = this.tenantUsers.get(session.tenantUserId);
    const user = this.users.get(session.userId);
    if (!tenantUser || !user || tenantUser.status !== "active" || user.status !== "active")
      return null;
    const tenant = this.tenants.get(tenantUser.tenantId);
    const role = this.roles.get(tenantUser.roleId);
    if (!tenant || !role || tenant.status !== "active") return null;
    return {
      sessionId: session.id,
      user: this.toUserSummary(user),
      tenantUserId: tenantUser.id,
      tenant,
      role: this.toRoleResponse(role),
      branchIds: this.resolveBranchIds(tenantUser, role),
      permissions: [...role.permissions]
    };
  }

  async revokeSession(tokenHash: string, at: string): Promise<void> {
    const session = this.sessions.get(tokenHash);
    if (session) session.revokedAt = at;
  }

  async markUserLoggedIn(userId: string, at: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) user.lastLoginAt = at;
  }

  async findTenant(scope: TenantScope): Promise<TenantSummary | null> {
    return this.tenants.get(scope.tenantId) ?? null;
  }

  async updateTenant(scope: TenantScope, input: UpdateOrganizationRequest): Promise<TenantSummary> {
    const tenant = this.requireTenant(scope.tenantId);
    if (input.name !== undefined) tenant.name = input.name;
    if (input.timezone !== undefined) tenant.timezone = input.timezone;
    if (input.currency !== undefined) tenant.currency = input.currency;
    return { ...tenant };
  }

  async listBranches(scope: TenantScope): Promise<BranchResponse[]> {
    return [...this.branches.values()]
      .filter((branch) => branch.tenantId === scope.tenantId && scope.branchIds.includes(branch.id))
      .map((branch) => this.toBranchResponse(branch));
  }

  async findBranchById(scope: TenantScope, branchId: string): Promise<BranchResponse | null> {
    const branch = this.branches.get(branchId);
    if (!branch || branch.tenantId !== scope.tenantId || !scope.branchIds.includes(branchId))
      return null;
    return this.toBranchResponse(branch);
  }

  async createBranch(scope: TenantScope, input: CreateBranchRequest): Promise<BranchResponse> {
    const slug = input.slug ? toSlug(input.slug) : toSlug(input.name);
    if (
      [...this.branches.values()].some(
        (branch) => branch.tenantId === scope.tenantId && branch.slug === slug
      )
    ) {
      throw new Error("Branch slug already exists.");
    }
    const timestamp = now();
    const branch: StoredBranch = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      name: input.name,
      slug,
      timezone: input.timezone ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      addressLine1: input.addressLine1 ?? null,
      addressLine2: input.addressLine2 ?? null,
      city: input.city ?? null,
      countryCode: input.countryCode ?? "KE",
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.branches.set(branch.id, branch);
    this.branchAccess.get(scope.tenantUserId)?.add(branch.id);
    return this.toBranchResponse(branch);
  }

  async updateBranch(
    scope: TenantScope,
    branchId: string,
    input: UpdateBranchRequest
  ): Promise<BranchResponse | null> {
    const branch = this.branches.get(branchId);
    if (!branch || branch.tenantId !== scope.tenantId || !scope.branchIds.includes(branchId))
      return null;
    const slug = input.slug ? toSlug(input.slug) : undefined;
    if (
      slug &&
      [...this.branches.values()].some(
        (candidate) =>
          candidate.id !== branchId &&
          candidate.tenantId === scope.tenantId &&
          candidate.slug === slug
      )
    ) {
      throw new Error("Branch slug already exists.");
    }
    Object.assign(branch, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(slug ? { slug } : {}),
      ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
      ...(input.phone !== undefined ? { phone: input.phone } : {}),
      ...(input.email !== undefined ? { email: input.email } : {}),
      ...(input.addressLine1 !== undefined ? { addressLine1: input.addressLine1 } : {}),
      ...(input.addressLine2 !== undefined ? { addressLine2: input.addressLine2 } : {}),
      ...(input.city !== undefined ? { city: input.city } : {}),
      ...(input.countryCode !== undefined ? { countryCode: input.countryCode ?? "KE" } : {}),
      ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      updatedAt: now()
    });
    return this.toBranchResponse(branch);
  }

  async createMember(
    scope: TenantScope,
    input: CreateMemberRequest,
    normalizedPhone: string | null
  ): Promise<MemberResponse> {
    if (!scope.branchIds.includes(input.homeBranchId)) throw new Error("Branch unavailable.");
    const timestamp = now();
    const contact: StoredContact = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      firstName: input.contact.firstName,
      lastName: input.contact.lastName ?? null,
      phone: normalizedPhone,
      email: input.contact.email?.trim().toLowerCase() || null,
      dateOfBirth: input.contact.dateOfBirth ?? null
    };
    this.contacts.set(contact.id, contact);
    const member: StoredMember = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      contactId: contact.id,
      homeBranchId: input.homeBranchId,
      memberNumber: null,
      status: "active",
      joinedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.members.set(member.id, member);
    return this.toMemberResponse(member, contact);
  }

  async findMemberById(scope: TenantScope, memberId: string): Promise<MemberResponse | null> {
    const member = this.members.get(memberId);
    if (
      !member ||
      member.tenantId !== scope.tenantId ||
      (member.homeBranchId && !scope.branchIds.includes(member.homeBranchId))
    )
      return null;
    const contact = this.contacts.get(member.contactId);
    return contact ? this.toMemberResponse(member, contact) : null;
  }

  async searchMembers(
    scope: TenantScope,
    filters: MemberListFilters
  ): Promise<CursorPage<MemberListItem>> {
    if (filters.branchId && !scope.branchIds.includes(filters.branchId))
      return { data: [], page: { nextCursor: null, hasMore: false } };
    const query = filters.query?.trim().toLowerCase();
    const all = [...this.members.values()]
      .filter((member) => member.tenantId === scope.tenantId)
      .filter((member) => !member.homeBranchId || scope.branchIds.includes(member.homeBranchId))
      .filter((member) => !filters.branchId || member.homeBranchId === filters.branchId)
      .filter((member) => !filters.status || member.status === filters.status)
      .map((member) => ({ member, contact: this.contacts.get(member.contactId) }))
      .filter((record): record is { member: StoredMember; contact: StoredContact } =>
        Boolean(record.contact)
      )
      .filter(({ member, contact }) => {
        if (!query) return true;
        return [
          contact.firstName,
          contact.lastName,
          contact.phone,
          contact.email,
          member.memberNumber
        ]
          .filter(Boolean)
          .some((value) => value?.toLowerCase().includes(query));
      })
      .sort(
        (a, b) =>
          b.member.createdAt.localeCompare(a.member.createdAt) ||
          b.member.id.localeCompare(a.member.id)
      );
    const cursor = decodeCursor(filters.cursor);
    const afterCursor = cursor
      ? all.filter(
          ({ member }) =>
            member.createdAt < cursor.createdAt ||
            (member.createdAt === cursor.createdAt && member.id < cursor.id)
        )
      : all;
    const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);
    const selected = afterCursor.slice(0, limit + 1);
    const hasMore = selected.length > limit;
    const data = selected
      .slice(0, limit)
      .map(({ member, contact }) => this.toMemberListItem(member, contact));
    const last = data.at(-1);
    return {
      data,
      page: {
        nextCursor:
          hasMore && last ? encodeCursor({ createdAt: last.updatedAt, id: last.id }) : null,
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
    const member = this.members.get(memberId);
    if (
      !member ||
      member.tenantId !== scope.tenantId ||
      (member.homeBranchId && !scope.branchIds.includes(member.homeBranchId))
    )
      return null;
    if (
      input.homeBranchId !== undefined &&
      input.homeBranchId !== null &&
      !scope.branchIds.includes(input.homeBranchId)
    )
      return null;
    const contact = this.contacts.get(member.contactId);
    if (!contact) return null;
    if (input.contact) {
      if (input.contact.firstName !== undefined) contact.firstName = input.contact.firstName;
      if (input.contact.lastName !== undefined) contact.lastName = input.contact.lastName ?? null;
      if (input.contact.email !== undefined)
        contact.email = input.contact.email?.trim().toLowerCase() || null;
      if (input.contact.dateOfBirth !== undefined)
        contact.dateOfBirth = input.contact.dateOfBirth ?? null;
      if (normalizedPhone !== undefined) contact.phone = normalizedPhone;
    }
    if (input.homeBranchId !== undefined) member.homeBranchId = input.homeBranchId;
    if (input.status !== undefined) member.status = input.status;
    member.updatedAt = now();
    return this.toMemberResponse(member, contact);
  }

  async createLead(
    scope: TenantScope,
    input: CreateLeadRequest,
    normalizedPhone: string | null
  ): Promise<LeadResponse> {
    if (input.branchId && !scope.branchIds.includes(input.branchId))
      throw new Error("Branch unavailable.");
    const timestamp = now();
    const contact: StoredContact = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      firstName: input.contact.firstName,
      lastName: input.contact.lastName ?? null,
      phone: normalizedPhone,
      email: input.contact.email?.trim().toLowerCase() || null,
      dateOfBirth: input.contact.dateOfBirth ?? null
    };
    const lead: StoredLead = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      contactId: contact.id,
      branchId: input.branchId ?? null,
      ownerUserId: input.ownerUserId ?? null,
      interest: input.interest ?? null,
      source: input.source ?? null,
      stage: "new",
      lostReason: null,
      nextFollowUpAt: input.nextFollowUpAt ?? null,
      convertedMemberId: null,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.contacts.set(contact.id, contact);
    this.leads.set(lead.id, lead);
    return this.toLeadResponse(lead, contact);
  }

  async findLeadById(scope: TenantScope, leadId: string): Promise<LeadResponse | null> {
    const lead = this.leads.get(leadId);
    if (
      !lead ||
      lead.tenantId !== scope.tenantId ||
      (lead.branchId && !scope.branchIds.includes(lead.branchId))
    )
      return null;
    const contact = this.contacts.get(lead.contactId);
    return contact ? this.toLeadResponse(lead, contact) : null;
  }

  async searchLeads(
    scope: TenantScope,
    filters: LeadListFilters
  ): Promise<CursorPage<LeadResponse>> {
    if (filters.branchId && !scope.branchIds.includes(filters.branchId))
      return { data: [], page: { nextCursor: null, hasMore: false } };
    const query = filters.query?.trim().toLowerCase();
    const rows = [...this.leads.values()]
      .filter(
        (lead) =>
          lead.tenantId === scope.tenantId &&
          (!lead.branchId || scope.branchIds.includes(lead.branchId))
      )
      .filter((lead) => !filters.branchId || lead.branchId === filters.branchId)
      .filter((lead) => !filters.stage || lead.stage === filters.stage)
      .map((lead) => ({ lead, contact: this.contacts.get(lead.contactId) }))
      .filter((row): row is { lead: StoredLead; contact: StoredContact } => Boolean(row.contact))
      .filter(
        ({ lead, contact }) =>
          !query ||
          [contact.firstName, contact.lastName, contact.phone, contact.email, lead.interest]
            .filter(Boolean)
            .some((value) => value?.toLowerCase().includes(query))
      )
      .sort(
        (a, b) =>
          b.lead.createdAt.localeCompare(a.lead.createdAt) || b.lead.id.localeCompare(a.lead.id)
      );
    const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);
    const selected = rows.slice(0, limit + 1);
    const data = selected
      .slice(0, limit)
      .map(({ lead, contact }) => this.toLeadResponse(lead, contact));
    const last = data.at(-1);
    return {
      data,
      page: {
        hasMore: selected.length > limit,
        nextCursor:
          selected.length > limit && last
            ? encodeCursor({ createdAt: last.createdAt, id: last.id })
            : null
      }
    };
  }

  async updateLeadStage(
    scope: TenantScope,
    leadId: string,
    input: UpdateLeadStageRequest,
    _actorUserId: string
  ): Promise<LeadResponse | null> {
    const lead = this.leads.get(leadId);
    if (
      !lead ||
      lead.tenantId !== scope.tenantId ||
      (lead.branchId && !scope.branchIds.includes(lead.branchId))
    )
      return null;
    lead.stage = input.stage;
    lead.lostReason = input.stage === "lost" ? (input.lostReason ?? null) : null;
    lead.updatedAt = now();
    const contact = this.contacts.get(lead.contactId);
    return contact ? this.toLeadResponse(lead, contact) : null;
  }

  async convertLead(
    scope: TenantScope,
    leadId: string,
    _actorUserId: string
  ): Promise<LeadConversionResponse | null> {
    const lead = this.leads.get(leadId);
    if (
      !lead ||
      lead.tenantId !== scope.tenantId ||
      (lead.branchId && !scope.branchIds.includes(lead.branchId))
    )
      return null;
    const contact = this.contacts.get(lead.contactId);
    if (!contact) return null;
    const existing = [...this.members.values()].find(
      (member) => member.tenantId === scope.tenantId && member.contactId === contact.id
    );
    const timestamp = now();
    const member = existing ?? {
      id: randomUUID(),
      tenantId: scope.tenantId,
      contactId: contact.id,
      homeBranchId: lead.branchId,
      memberNumber: null,
      status: "active" as const,
      joinedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    if (!existing) this.members.set(member.id, member);
    lead.convertedMemberId = member.id;
    lead.stage = "joined";
    lead.lostReason = null;
    lead.updatedAt = timestamp;
    return {
      lead: this.toLeadResponse(lead, contact),
      member: this.toMemberResponse(member, contact),
      alreadyConverted: Boolean(existing)
    };
  }

  async addLeadNote(
    scope: TenantScope,
    leadId: string,
    body: string,
    actorUserId: string
  ): Promise<LeadNoteResponse | null> {
    if (!(await this.findLeadById(scope, leadId))) return null;
    const note: StoredLeadNote = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      leadId,
      body,
      createdByUserId: actorUserId,
      createdAt: now()
    };
    this.leadNotes.set(note.id, note);
    return this.noteResponse(note);
  }

  async listLeadNotes(scope: TenantScope, leadId: string): Promise<LeadNoteResponse[]> {
    if (!(await this.findLeadById(scope, leadId))) return [];
    return [...this.leadNotes.values()]
      .filter((note) => note.tenantId === scope.tenantId && note.leadId === leadId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((note) => this.noteResponse(note));
  }

  async createLeadTask(
    scope: TenantScope,
    leadId: string,
    input: CreateLeadTaskRequest
  ): Promise<LeadTaskResponse | null> {
    if (!(await this.findLeadById(scope, leadId))) return null;
    const task: StoredLeadTask = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      leadId,
      body: input.body,
      dueAt: input.dueAt ?? null,
      assigneeUserId: input.assigneeUserId ?? null,
      completedAt: null,
      createdAt: now()
    };
    this.leadTasks.set(task.id, task);
    return this.taskResponse(task);
  }

  async listLeadTasks(scope: TenantScope, leadId: string): Promise<LeadTaskResponse[]> {
    if (!(await this.findLeadById(scope, leadId))) return [];
    return [...this.leadTasks.values()]
      .filter((task) => task.tenantId === scope.tenantId && task.leadId === leadId)
      .sort((a, b) => (a.dueAt ?? a.createdAt).localeCompare(b.dueAt ?? b.createdAt))
      .map((task) => this.taskResponse(task));
  }

  async listServices(scope: TenantScope): Promise<ServiceResponse[]> {
    return [...this.services.values()]
      .filter(
        (service) =>
          service.tenantId === scope.tenantId &&
          (!service.branchId || scope.branchIds.includes(service.branchId))
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async findServiceById(scope: TenantScope, serviceId: string): Promise<ServiceResponse | null> {
    const service = this.services.get(serviceId);
    return service &&
      service.tenantId === scope.tenantId &&
      (!service.branchId || scope.branchIds.includes(service.branchId))
      ? { ...service, price: service.price ? { ...service.price } : null }
      : null;
  }

  async createService(scope: TenantScope, input: CreateServiceRequest): Promise<ServiceResponse> {
    if (input.branchId && !scope.branchIds.includes(input.branchId))
      throw new Error("Branch unavailable.");
    const timestamp = now();
    const service: StoredService = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      branchId: input.branchId ?? null,
      name: input.name,
      slug: input.slug || toSlug(input.name),
      serviceType: input.serviceType,
      durationMinutes: input.durationMinutes,
      defaultCapacity: input.defaultCapacity ?? null,
      price: input.price ?? null,
      publicVisible: input.publicVisible ?? false,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    if (
      [...this.services.values()].some(
        (item) =>
          item.tenantId === service.tenantId &&
          item.branchId === service.branchId &&
          item.slug === service.slug
      )
    )
      throw new Error("service slug already exists");
    this.services.set(service.id, service);
    return { ...service, price: service.price ? { ...service.price } : null };
  }

  async updateService(
    scope: TenantScope,
    serviceId: string,
    input: UpdateServiceRequest
  ): Promise<ServiceResponse | null> {
    const service = this.services.get(serviceId);
    if (
      !service ||
      service.tenantId !== scope.tenantId ||
      (service.branchId && !scope.branchIds.includes(service.branchId))
    )
      return null;
    const slug = input.slug ?? service.slug;
    if (
      [...this.services.values()].some(
        (item) =>
          item.id !== service.id &&
          item.tenantId === service.tenantId &&
          item.branchId === service.branchId &&
          item.slug === slug
      )
    )
      throw new Error("service slug already exists");
    Object.assign(service, input, { slug, updatedAt: now() });
    return { ...service, price: service.price ? { ...service.price } : null };
  }

  async listRooms(scope: TenantScope, branchId?: string): Promise<RoomResponse[]> {
    if (branchId && !scope.branchIds.includes(branchId)) return [];
    return [...this.rooms.values()]
      .filter(
        (room) =>
          room.tenantId === scope.tenantId &&
          scope.branchIds.includes(room.branchId) &&
          (!branchId || room.branchId === branchId)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async findRoomById(scope: TenantScope, roomId: string): Promise<RoomResponse | null> {
    const room = this.rooms.get(roomId);
    return room && room.tenantId === scope.tenantId && scope.branchIds.includes(room.branchId)
      ? { ...room }
      : null;
  }

  async createRoom(scope: TenantScope, input: CreateRoomRequest): Promise<RoomResponse> {
    if (!scope.branchIds.includes(input.branchId)) throw new Error("Branch unavailable.");
    if (
      [...this.rooms.values()].some(
        (room) =>
          room.tenantId === scope.tenantId &&
          room.branchId === input.branchId &&
          room.name.toLowerCase() === input.name.toLowerCase()
      )
    )
      throw new Error("room name already exists");
    const timestamp = now();
    const room: StoredRoom = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      branchId: input.branchId,
      name: input.name,
      capacity: input.capacity ?? null,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.rooms.set(room.id, room);
    return { ...room };
  }

  async createScheduleOccurrence(
    scope: TenantScope,
    input: CreateScheduleOccurrenceRequest
  ): Promise<ScheduleOccurrenceResponse> {
    if (!scope.branchIds.includes(input.branchId)) throw new Error("Branch unavailable.");
    const service = await this.findServiceById(scope, input.serviceId);
    if (!service || (service.branchId && service.branchId !== input.branchId))
      throw new Error("Service unavailable.");
    if (input.roomId) {
      const room = await this.findRoomById(scope, input.roomId);
      if (!room || room.branchId !== input.branchId || !room.isActive)
        throw new Error("Room unavailable.");
    }
    if (input.trainerUserId && !(await this.findStaffByUserId(scope, input.trainerUserId)))
      throw new Error("Trainer unavailable.");
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (endsAt <= startsAt) throw new Error("Occurrence end must be after start.");
    const clashes = [...this.occurrences.values()].some(
      (occurrence) =>
        occurrence.tenantId === scope.tenantId &&
        occurrence.status === "scheduled" &&
        new Date(occurrence.startsAt) < endsAt &&
        startsAt < new Date(occurrence.endsAt) &&
        ((input.roomId && occurrence.roomId === input.roomId) ||
          (input.trainerUserId && occurrence.trainerUserId === input.trainerUserId))
    );
    if (clashes) throw new Error("Schedule conflict.");
    const timestamp = now();
    const occurrence: StoredOccurrence = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      branchId: input.branchId,
      serviceId: input.serviceId,
      trainerUserId: input.trainerUserId ?? null,
      roomId: input.roomId ?? null,
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      capacity: input.capacity,
      status: "scheduled",
      cancellationReason: null,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.occurrences.set(occurrence.id, occurrence);
    return this.occurrenceResponse(occurrence);
  }

  async findScheduleOccurrenceById(
    scope: TenantScope,
    occurrenceId: string
  ): Promise<ScheduleOccurrenceResponse | null> {
    const occurrence = this.occurrences.get(occurrenceId);
    return occurrence &&
      occurrence.tenantId === scope.tenantId &&
      scope.branchIds.includes(occurrence.branchId)
      ? this.occurrenceResponse(occurrence)
      : null;
  }

  async listScheduleOccurrences(
    scope: TenantScope,
    filters: ScheduleOccurrenceFilters
  ): Promise<CursorPage<ScheduleOccurrenceResponse>> {
    if (filters.branchId && !scope.branchIds.includes(filters.branchId))
      return { data: [], page: { hasMore: false, nextCursor: null } };
    const rows = [...this.occurrences.values()]
      .filter((item) => item.tenantId === scope.tenantId && scope.branchIds.includes(item.branchId))
      .filter((item) => !filters.branchId || item.branchId === filters.branchId)
      .filter((item) => !filters.serviceId || item.serviceId === filters.serviceId)
      .filter((item) => !filters.trainerUserId || item.trainerUserId === filters.trainerUserId)
      .filter((item) => !filters.roomId || item.roomId === filters.roomId)
      .filter((item) => !filters.status || item.status === filters.status)
      .filter((item) => !filters.startsAfter || item.startsAt >= filters.startsAfter)
      .filter((item) => !filters.endsBefore || item.endsAt <= filters.endsBefore)
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
    const selected = rows.slice(0, limit + 1);
    return {
      data: selected.slice(0, limit).map((item) => this.occurrenceResponse(item)),
      page: { hasMore: selected.length > limit, nextCursor: null }
    };
  }

  async cancelScheduleOccurrence(
    scope: TenantScope,
    occurrenceId: string,
    reason: string
  ): Promise<ScheduleOccurrenceResponse | null> {
    const occurrence = this.occurrences.get(occurrenceId);
    if (
      !occurrence ||
      occurrence.tenantId !== scope.tenantId ||
      !scope.branchIds.includes(occurrence.branchId)
    )
      return null;
    occurrence.status = "cancelled";
    occurrence.cancellationReason = reason;
    occurrence.updatedAt = now();
    return this.occurrenceResponse(occurrence);
  }

  async createBooking(
    scope: TenantScope,
    input: CreateBookingRequest,
    actorUserId: string
  ): Promise<BookingResponse> {
    const occurrence = this.occurrences.get(input.occurrenceId);
    if (
      !occurrence ||
      occurrence.tenantId !== scope.tenantId ||
      !scope.branchIds.includes(occurrence.branchId) ||
      occurrence.status !== "scheduled"
    )
      throw new Error("Occurrence unavailable.");
    const member = this.members.get(input.memberId);
    if (!member || member.tenantId !== scope.tenantId || member.status !== "active")
      throw new Error("Member unavailable.");
    const activeBookings = [...this.bookings.values()].filter(
      (booking) =>
        booking.tenantId === scope.tenantId &&
        booking.occurrenceId === occurrence.id &&
        booking.status === "confirmed"
    );
    if (activeBookings.some((booking) => booking.memberId === input.memberId)) {
      throw new Error("Member already has a booking for this occurrence.");
    }
    if (activeBookings.length >= occurrence.capacity) throw new Error("Occurrence is full.");
    const timestamp = now();
    const booking: StoredBooking = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      branchId: occurrence.branchId,
      occurrenceId: occurrence.id,
      memberId: input.memberId,
      status: "confirmed",
      source: input.source ?? "staff",
      bookedAt: timestamp,
      cancelledAt: null,
      cancellationReason: null,
      createdByUserId: actorUserId,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.bookings.set(booking.id, booking);
    return { ...booking };
  }

  async findBookingById(scope: TenantScope, bookingId: string): Promise<BookingResponse | null> {
    const booking = this.bookings.get(bookingId);
    return booking &&
      booking.tenantId === scope.tenantId &&
      scope.branchIds.includes(booking.branchId)
      ? { ...booking }
      : null;
  }

  async listBookings(
    scope: TenantScope,
    filters: BookingListFilters
  ): Promise<CursorPage<BookingResponse>> {
    const rows = [...this.bookings.values()]
      .filter(
        (booking) =>
          booking.tenantId === scope.tenantId && scope.branchIds.includes(booking.branchId)
      )
      .filter((booking) => !filters.occurrenceId || booking.occurrenceId === filters.occurrenceId)
      .filter((booking) => !filters.memberId || booking.memberId === filters.memberId)
      .filter((booking) => !filters.status || booking.status === filters.status)
      .sort((a, b) => b.bookedAt.localeCompare(a.bookedAt) || b.id.localeCompare(a.id));
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
    const selected = rows.slice(0, limit + 1);
    return {
      data: selected.slice(0, limit).map((booking) => ({ ...booking })),
      page: { hasMore: selected.length > limit, nextCursor: null }
    };
  }

  async cancelBooking(
    scope: TenantScope,
    bookingId: string,
    reason: string
  ): Promise<BookingResponse | null> {
    const booking = this.bookings.get(bookingId);
    if (
      !booking ||
      booking.tenantId !== scope.tenantId ||
      !scope.branchIds.includes(booking.branchId)
    )
      return null;
    if (booking.status === "cancelled") return { ...booking };
    booking.status = "cancelled";
    booking.cancelledAt = now();
    booking.cancellationReason = reason;
    booking.updatedAt = booking.cancelledAt;
    return { ...booking };
  }

  async listMembershipPlans(
    scope: TenantScope,
    branchId?: string
  ): Promise<MembershipPlanResponse[]> {
    return [...this.membershipPlans.values()]
      .filter((p) => p.tenantId === scope.tenantId)
      .filter((p) => !branchId || !p.branchId || p.branchId === branchId)
      .map((p) => ({ ...p }));
  }

  async findMembershipPlanById(
    scope: TenantScope,
    planId: string
  ): Promise<MembershipPlanResponse | null> {
    const plan = this.membershipPlans.get(planId);
    return plan && plan.tenantId === scope.tenantId ? { ...plan } : null;
  }

  async createMembershipPlan(
    scope: TenantScope,
    input: CreateMembershipPlanRequest
  ): Promise<MembershipPlanResponse> {
    const timestamp = now();
    const plan: StoredMembershipPlan = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      branchId: input.branchId ?? null,
      name: input.name,
      slug: input.slug ?? input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      price: input.price ?? null,
      durationDays: input.durationDays ?? null,
      includedCredits: input.includedCredits,
      publicVisible: input.publicVisible ?? false,
      isActive: true,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.membershipPlans.set(plan.id, plan);
    return { ...plan };
  }

  async updateMembershipPlan(
    scope: TenantScope,
    planId: string,
    input: Partial<CreateMembershipPlanRequest> & { isActive?: boolean }
  ): Promise<MembershipPlanResponse | null> {
    const plan = this.membershipPlans.get(planId);
    if (!plan || plan.tenantId !== scope.tenantId) return null;
    if (input.name !== undefined) plan.name = input.name;
    if (input.slug !== undefined) plan.slug = input.slug;
    if (input.price !== undefined) plan.price = input.price;
    if (input.durationDays !== undefined) plan.durationDays = input.durationDays;
    if (input.includedCredits !== undefined) plan.includedCredits = input.includedCredits;
    if (input.publicVisible !== undefined) plan.publicVisible = input.publicVisible;
    if (input.isActive !== undefined) plan.isActive = input.isActive;
    plan.updatedAt = now();
    return { ...plan };
  }

  async listMemberMemberships(
    scope: TenantScope,
    memberId: string
  ): Promise<MemberMembershipResponse[]> {
    return [...this.memberMemberships.values()]
      .filter((m) => m.tenantId === scope.tenantId && m.memberId === memberId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((m) => ({ ...m }));
  }

  async findMemberMembershipById(
    scope: TenantScope,
    membershipId: string
  ): Promise<MemberMembershipResponse | null> {
    const membership = this.memberMemberships.get(membershipId);
    return membership && membership.tenantId === scope.tenantId ? { ...membership } : null;
  }

  async activateMembership(
    scope: TenantScope,
    input: ActivateMembershipRequest,
    _actorUserId?: string
  ): Promise<{ membership: MemberMembershipResponse; ledgerEntry: CreditLedgerEntryResponse }> {
    const plan = this.membershipPlans.get(input.planId);
    if (!plan || plan.tenantId !== scope.tenantId) {
      throw new Error("Membership plan not found.");
    }
    const member = this.members.get(input.memberId);
    if (!member || member.tenantId !== scope.tenantId) {
      throw new Error("Member not found.");
    }
    const timestamp = now();
    const startsAt = input.startsAt ?? timestamp;
    let endsAt: string | null = null;
    if (plan.durationDays) {
      const startMs = new Date(startsAt).getTime();
      endsAt = new Date(startMs + plan.durationDays * 24 * 60 * 60 * 1000).toISOString();
    }

    const membership: StoredMemberMembership = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      memberId: input.memberId,
      planId: plan.id,
      planSnapshot: { ...plan },
      status: "active",
      startsAt,
      endsAt,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.memberMemberships.set(membership.id, membership);

    const ledgerEntry: StoredCreditLedgerEntry = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      membershipId: membership.id,
      memberId: input.memberId,
      delta: plan.includedCredits,
      reason: "purchase",
      bookingId: null,
      note: `Membership activated: ${plan.name}`,
      createdAt: timestamp
    };
    this.creditLedger.set(ledgerEntry.id, ledgerEntry);

    return { membership: { ...membership }, ledgerEntry: { ...ledgerEntry } };
  }

  async cancelMembership(
    scope: TenantScope,
    membershipId: string,
    _reason?: string
  ): Promise<MemberMembershipResponse | null> {
    const membership = this.memberMemberships.get(membershipId);
    if (!membership || membership.tenantId !== scope.tenantId) return null;
    membership.status = "cancelled";
    membership.updatedAt = now();
    return { ...membership };
  }

  async listCreditLedger(
    scope: TenantScope,
    memberId: string
  ): Promise<CreditLedgerEntryResponse[]> {
    return [...this.creditLedger.values()]
      .filter((e) => e.tenantId === scope.tenantId && e.memberId === memberId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(({ tenantId: _, ...entry }) => entry);
  }

  async getCreditBalance(scope: TenantScope, memberId: string): Promise<number> {
    const entries = [...this.creditLedger.values()].filter(
      (e) => e.tenantId === scope.tenantId && e.memberId === memberId
    );
    return entries.reduce((sum, e) => sum + e.delta, 0);
  }

  async applyBookingCredit(
    scope: TenantScope,
    bookingId: string,
    memberId: string,
    delta: number,
    reason: CreditReason,
    note?: string
  ): Promise<CreditLedgerEntryResponse | null> {
    const activeMemberships = [...this.memberMemberships.values()].filter(
      (m) => m.tenantId === scope.tenantId && m.memberId === memberId && m.status === "active"
    );
    const membership = activeMemberships[0];
    if (!membership) return null;

    const timestamp = now();
    const ledgerEntry: StoredCreditLedgerEntry = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      membershipId: membership.id,
      memberId,
      delta,
      reason,
      bookingId,
      note: note ?? null,
      createdAt: timestamp
    };
    this.creditLedger.set(ledgerEntry.id, ledgerEntry);
    const { tenantId: _, ...response } = ledgerEntry;
    return response;
  }

  async listStaff(scope: TenantScope): Promise<StaffUserResponse[]> {
    return [...this.tenantUsers.values()]
      .filter((membership) => membership.tenantId === scope.tenantId)
      .map((membership) => this.toStaff(membership))
      .filter((staff): staff is StaffUserResponse => Boolean(staff));
  }

  async findStaffByUserId(scope: TenantScope, userId: string): Promise<StaffUserResponse | null> {
    const membership = [...this.tenantUsers.values()].find(
      (candidate) => candidate.tenantId === scope.tenantId && candidate.userId === userId
    );
    return membership ? this.toStaff(membership) : null;
  }

  async findStaffByEmail(scope: TenantScope, email: string): Promise<StaffUserResponse | null> {
    const user = [...this.users.values()].find(
      (candidate) => candidate.email === normalizeEmail(email)
    );
    return user ? this.findStaffByUserId(scope, user.id) : null;
  }

  async findRoleById(scope: TenantScope, roleId: string): Promise<RoleResponse | null> {
    const role = this.roles.get(roleId);
    return role && role.tenantId === scope.tenantId ? this.toRoleResponse(role) : null;
  }

  async inviteStaff(scope: TenantScope, input: InviteStaffInput): Promise<StaffUserResponse> {
    if (await this.findStaffByEmail(scope, input.email))
      throw new Error("Staff member already exists.");
    const role = await this.findRoleById(scope, input.roleId);
    if (!role || input.branchIds.some((branchId) => !scope.branchIds.includes(branchId)))
      throw new Error("Invalid staff access.");
    const user: StoredUser = {
      id: randomUUID(),
      email: normalizeEmail(input.email),
      displayName: input.displayName,
      status: "invited",
      lastLoginAt: null,
      passwordHash: "!invite-required!"
    };
    this.users.set(user.id, user);
    const membership: StoredTenantUser = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      userId: user.id,
      roleId: role.id,
      status: "invited"
    };
    this.tenantUsers.set(membership.id, membership);
    this.branchAccess.set(membership.id, new Set(input.branchIds));
    const staff = this.toStaff(membership);
    if (!staff) throw new Error("Unable to create invited staff member.");
    return staff;
  }

  async updateStaffAccess(
    scope: TenantScope,
    userId: string,
    input: StaffAccessInput
  ): Promise<StaffUserResponse | null> {
    const membership = [...this.tenantUsers.values()].find(
      (candidate) => candidate.tenantId === scope.tenantId && candidate.userId === userId
    );
    const role = await this.findRoleById(scope, input.roleId);
    if (
      !membership ||
      !role ||
      input.branchIds.some((branchId) => !scope.branchIds.includes(branchId))
    )
      return null;
    membership.roleId = role.id;
    this.branchAccess.set(membership.id, new Set(input.branchIds));
    return this.toStaff(membership);
  }

  async deactivateStaff(scope: TenantScope, userId: string): Promise<StaffUserResponse | null> {
    const membership = [...this.tenantUsers.values()].find(
      (candidate) => candidate.tenantId === scope.tenantId && candidate.userId === userId
    );
    if (!membership) return null;
    membership.status = "deactivated";
    return this.toStaff(membership);
  }

  async countActiveOwners(scope: TenantScope): Promise<number> {
    return [...this.tenantUsers.values()].filter((membership) => {
      const role = this.roles.get(membership.roleId);
      return (
        membership.tenantId === scope.tenantId &&
        membership.status === "active" &&
        role?.key === "owner"
      );
    }).length;
  }

  async recordAudit(input: AuditRecordInput): Promise<AuditEventResponse> {
    const event: AuditEventResponse = {
      id: randomUUID(),
      tenantId: input.tenantId,
      branchId: input.branchId ?? null,
      actorUserId: input.actorUserId ?? null,
      action: input.action,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      beforeSummary: input.beforeSummary ?? null,
      afterSummary: input.afterSummary ?? null,
      requestId: input.requestId,
      createdAt: now()
    };
    this.auditEvents.unshift(event);
    return event;
  }

  async listAuditEvents(scope: TenantScope, resourceId?: string): Promise<AuditEventResponse[]> {
    return this.auditEvents.filter(
      (event) =>
        event.tenantId === scope.tenantId && (!resourceId || event.resourceId === resourceId)
    );
  }

  async publishEvent(event: DomainEvent): Promise<void> {
    this.domainEvents.push(event);
  }

  async createPayment(
    scope: TenantScope,
    input: CreatePaymentRequest,
    actorUserId: string
  ): Promise<PaymentTransactionResponse> {
    if (!scope.branchIds.includes(input.branchId)) {
      throw new Error("Branch unavailable.");
    }
    if (input.memberId) {
      const member = this.members.get(input.memberId);
      if (!member || member.tenantId !== scope.tenantId) {
        throw new Error("Member unavailable.");
      }
    }
    const timestamp = now();
    const payment: StoredPaymentTransaction = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      branchId: input.branchId,
      memberId: input.memberId ?? null,
      amount: input.amount,
      method: input.method,
      reference: input.reference ?? null,
      providerRef: null,
      status: "completed",
      note: input.note ?? null,
      allocationType: input.allocationType ?? null,
      allocationId: input.allocationId ?? null,
      recordedByUserId: actorUserId,
      recordedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.payments.set(payment.id, payment);
    return { ...payment };
  }

  async findPaymentById(
    scope: TenantScope,
    paymentId: string
  ): Promise<PaymentTransactionResponse | null> {
    const payment = this.payments.get(paymentId);
    return payment &&
      payment.tenantId === scope.tenantId &&
      scope.branchIds.includes(payment.branchId)
      ? { ...payment }
      : null;
  }

  async listPayments(
    scope: TenantScope,
    filters: PaymentListFilters
  ): Promise<CursorPage<PaymentTransactionResponse>> {
    const rows = [...this.payments.values()]
      .filter(
        (p) => p.tenantId === scope.tenantId && scope.branchIds.includes(p.branchId)
      )
      .filter((p) => !filters.branchId || p.branchId === filters.branchId)
      .filter((p) => !filters.memberId || p.memberId === filters.memberId)
      .filter((p) => !filters.method || p.method === filters.method)
      .filter((p) => !filters.status || p.status === filters.status)
      .filter((p) => !filters.unmatched || !p.memberId || !p.allocationType)
      .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt) || b.id.localeCompare(a.id));
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
    const selected = rows.slice(0, limit + 1);
    return {
      data: selected.slice(0, limit).map((p) => ({ ...p })),
      page: { hasMore: selected.length > limit, nextCursor: null }
    };
  }

  async voidPayment(
    scope: TenantScope,
    paymentId: string,
    reason?: string
  ): Promise<PaymentTransactionResponse | null> {
    const payment = this.payments.get(paymentId);
    if (
      !payment ||
      payment.tenantId !== scope.tenantId ||
      !scope.branchIds.includes(payment.branchId)
    ) {
      return null;
    }
    payment.status = "voided";
    if (reason) payment.note = payment.note ? `${payment.note} | Void reason: ${reason}` : `Void reason: ${reason}`;
    payment.updatedAt = now();
    return { ...payment };
  }

  async checkIn(
    scope: TenantScope,
    input: CheckInRequest,
    actorUserId: string,
    branchId: string
  ): Promise<AttendanceRecordResponse> {
    const member = this.members.get(input.memberId);
    if (!member || member.tenantId !== scope.tenantId) {
      throw new Error("Member unavailable.");
    }
    let occurrenceId = input.occurrenceId;
    if (!occurrenceId) {
      const todayOccurrences = [...this.occurrences.values()].filter(
        (o) =>
          o.tenantId === scope.tenantId &&
          o.branchId === branchId &&
          o.status === "scheduled"
      );
      occurrenceId = todayOccurrences[0]?.id;
      if (!occurrenceId) {
        throw new Error("No active occurrence found for check-in.");
      }
    }
    const timestamp = now();
    const record: StoredAttendanceRecord = {
      id: randomUUID(),
      tenantId: scope.tenantId,
      branchId,
      occurrenceId,
      memberId: input.memberId,
      status: "checked_in",
      checkedInAt: timestamp,
      actorUserId,
      overrideReason: input.overrideReason ?? null,
      createdAt: timestamp,
      updatedAt: timestamp
    };
    this.attendance.set(record.id, record);
    return { ...record };
  }

  async findAttendanceRecord(
    scope: TenantScope,
    recordId: string
  ): Promise<AttendanceRecordResponse | null> {
    const record = this.attendance.get(recordId);
    return record &&
      record.tenantId === scope.tenantId &&
      scope.branchIds.includes(record.branchId)
      ? { ...record }
      : null;
  }

  async listAttendanceRecords(
    scope: TenantScope,
    filters: AttendanceListFilters
  ): Promise<CursorPage<AttendanceRecordResponse>> {
    const rows = [...this.attendance.values()]
      .filter(
        (r) => r.tenantId === scope.tenantId && scope.branchIds.includes(r.branchId)
      )
      .filter((r) => !filters.branchId || r.branchId === filters.branchId)
      .filter((r) => !filters.occurrenceId || r.occurrenceId === filters.occurrenceId)
      .filter((r) => !filters.memberId || r.memberId === filters.memberId)
      .filter((r) => !filters.status || r.status === filters.status)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 100);
    const selected = rows.slice(0, limit + 1);
    return {
      data: selected.slice(0, limit).map((r) => ({ ...r })),
      page: { hasMore: selected.length > limit, nextCursor: null }
    };
  }

  async updateAttendanceStatus(
    scope: TenantScope,
    recordId: string,
    input: UpdateRosterStatusRequest
  ): Promise<AttendanceRecordResponse | null> {
    const record = this.attendance.get(recordId);
    if (
      !record ||
      record.tenantId !== scope.tenantId ||
      !scope.branchIds.includes(record.branchId)
    ) {
      return null;
    }
    record.status = input.status;
    if (input.status === "checked_in" || input.status === "attended") {
      if (!record.checkedInAt) record.checkedInAt = now();
    }
    if (input.overrideReason) record.overrideReason = input.overrideReason;
    record.updatedAt = now();
    return { ...record };
  }

  async acquireIdempotency(record: IdempotencyRecord): Promise<IdempotencyAcquireResult> {
    const mapKey = `${record.tenantId}:${record.operation}:${record.key}`;
    const existing = this.idempotency.get(mapKey);
    if (!existing || existing.expiresAt <= now()) {
      this.idempotency.set(mapKey, { ...record });
      return { kind: "acquired" };
    }
    if (existing.fingerprint !== record.fingerprint) return { kind: "key_reused" };
    if (existing.status === "in_progress") return { kind: "in_progress" };
    return {
      kind: "replay",
      responseStatus: existing.responseStatus ?? 200,
      responseBody: existing.responseBody ?? {}
    };
  }

  async completeIdempotency(
    input: Pick<IdempotencyRecord, "tenantId" | "operation" | "key"> & {
      responseStatus: number;
      responseBody: unknown;
    }
  ): Promise<void> {
    const mapKey = `${input.tenantId}:${input.operation}:${input.key}`;
    const existing = this.idempotency.get(mapKey);
    if (existing) {
      existing.status = "completed";
      existing.responseStatus = input.responseStatus;
      existing.responseBody = input.responseBody;
    }
  }

  async abandonIdempotency(
    input: Pick<IdempotencyRecord, "tenantId" | "operation" | "key">
  ): Promise<void> {
    this.idempotency.delete(`${input.tenantId}:${input.operation}:${input.key}`);
  }

  private requireTenant(tenantId: string): StoredTenant {
    const tenant = this.tenants.get(tenantId);
    if (!tenant) throw new Error("Tenant is unavailable.");
    return tenant;
  }

  private resolveBranchIds(membership: StoredTenantUser, role: StoredRole): string[] {
    if (role.key === "owner") {
      return [...this.branches.values()]
        .filter((branch) => branch.tenantId === membership.tenantId)
        .map((branch) => branch.id);
    }
    return [...(this.branchAccess.get(membership.id) ?? new Set())];
  }

  private toUserSummary(user: StoredUser): UserSummary {
    const { passwordHash: _passwordHash, ...summary } = user;
    return { ...summary };
  }

  private toRoleResponse(role: StoredRole): RoleResponse {
    const { tenantId: _tenantId, ...response } = role;
    return { ...response, permissions: [...response.permissions] };
  }

  private toBranchResponse(branch: StoredBranch): BranchResponse {
    const { tenantId: _tenantId, ...response } = branch;
    return { ...response };
  }

  private toMemberResponse(member: StoredMember, contact: StoredContact): MemberResponse {
    const { contactId: _contactId, ...response } = member;
    const { tenantId: _tenantId, ...contactResponse } = contact;
    return { ...response, contact: { ...contactResponse } };
  }

  private toMemberListItem(member: StoredMember, contact: StoredContact): MemberListItem {
    return {
      id: member.id,
      homeBranchId: member.homeBranchId,
      status: member.status,
      memberNumber: member.memberNumber,
      firstName: contact.firstName,
      lastName: contact.lastName,
      phone: contact.phone,
      email: contact.email,
      joinedAt: member.joinedAt,
      updatedAt: member.updatedAt
    };
  }

  private toLeadResponse(lead: StoredLead, contact: StoredContact): LeadResponse {
    const { contactId: _contactId, ...response } = lead;
    return {
      ...response,
      contact: {
        id: contact.id,
        firstName: contact.firstName,
        lastName: contact.lastName,
        phone: contact.phone,
        email: contact.email
      }
    };
  }

  private noteResponse(note: StoredLeadNote): LeadNoteResponse {
    const { tenantId: _tenantId, leadId: _leadId, ...response } = note;
    return response;
  }

  private taskResponse(task: StoredLeadTask): LeadTaskResponse {
    const { tenantId: _tenantId, leadId: _leadId, ...response } = task;
    return response;
  }

  private occurrenceResponse(occurrence: StoredOccurrence): ScheduleOccurrenceResponse {
    const { cancellationReason: _cancellationReason, ...response } = occurrence;
    return { ...response };
  }

  private toStaff(membership: StoredTenantUser): StaffUserResponse | null {
    const user = this.users.get(membership.userId);
    const role = this.roles.get(membership.roleId);
    if (!user || !role) return null;
    const branches = [...(this.branchAccess.get(membership.id) ?? new Set())]
      .map((branchId) => this.branches.get(branchId))
      .filter((branch): branch is StoredBranch => Boolean(branch))
      .map((branch) => this.toBranchResponse(branch));
    return {
      user: this.toUserSummary(user),
      role: this.toRoleResponse(role),
      branches,
      tenantUserId: membership.id
    };
  }
}
