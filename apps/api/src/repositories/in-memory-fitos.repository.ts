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
  LeadResponse,
  UpdateLeadStageRequest,
  PermissionKey,
  RoleKey,
  RoleResponse,
  StaffUserResponse,
  TenantSummary,
  UpdateBranchRequest,
  UpdateMemberRequest,
  UpdateOrganizationRequest,
  UserSummary
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

  async createLead(scope: TenantScope, input: CreateLeadRequest, normalizedPhone: string | null): Promise<LeadResponse> {
    if (input.branchId && !scope.branchIds.includes(input.branchId)) throw new Error("Branch unavailable.");
    const timestamp = now();
    const contact: StoredContact = {
      id: randomUUID(), tenantId: scope.tenantId, firstName: input.contact.firstName,
      lastName: input.contact.lastName ?? null, phone: normalizedPhone,
      email: input.contact.email?.trim().toLowerCase() || null, dateOfBirth: input.contact.dateOfBirth ?? null
    };
    const lead: StoredLead = {
      id: randomUUID(), tenantId: scope.tenantId, contactId: contact.id, branchId: input.branchId ?? null,
      ownerUserId: input.ownerUserId ?? null, interest: input.interest ?? null, source: input.source ?? null,
      stage: "new", lostReason: null, nextFollowUpAt: input.nextFollowUpAt ?? null, convertedMemberId: null,
      createdAt: timestamp, updatedAt: timestamp
    };
    this.contacts.set(contact.id, contact);
    this.leads.set(lead.id, lead);
    return this.toLeadResponse(lead, contact);
  }

  async findLeadById(scope: TenantScope, leadId: string): Promise<LeadResponse | null> {
    const lead = this.leads.get(leadId);
    if (!lead || lead.tenantId !== scope.tenantId || (lead.branchId && !scope.branchIds.includes(lead.branchId))) return null;
    const contact = this.contacts.get(lead.contactId);
    return contact ? this.toLeadResponse(lead, contact) : null;
  }

  async searchLeads(scope: TenantScope, filters: LeadListFilters): Promise<CursorPage<LeadResponse>> {
    if (filters.branchId && !scope.branchIds.includes(filters.branchId)) return { data: [], page: { nextCursor: null, hasMore: false } };
    const query = filters.query?.trim().toLowerCase();
    const rows = [...this.leads.values()]
      .filter((lead) => lead.tenantId === scope.tenantId && (!lead.branchId || scope.branchIds.includes(lead.branchId)))
      .filter((lead) => !filters.branchId || lead.branchId === filters.branchId)
      .filter((lead) => !filters.stage || lead.stage === filters.stage)
      .map((lead) => ({ lead, contact: this.contacts.get(lead.contactId) }))
      .filter((row): row is { lead: StoredLead; contact: StoredContact } => Boolean(row.contact))
      .filter(({ lead, contact }) => !query || [contact.firstName, contact.lastName, contact.phone, contact.email, lead.interest].filter(Boolean).some((value) => value?.toLowerCase().includes(query)))
      .sort((a, b) => b.lead.createdAt.localeCompare(a.lead.createdAt) || b.lead.id.localeCompare(a.lead.id));
    const limit = Math.min(Math.max(filters.limit ?? 25, 1), 100);
    const selected = rows.slice(0, limit + 1);
    const data = selected.slice(0, limit).map(({ lead, contact }) => this.toLeadResponse(lead, contact));
    const last = data.at(-1);
    return { data, page: { hasMore: selected.length > limit, nextCursor: selected.length > limit && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null } };
  }

  async updateLeadStage(scope: TenantScope, leadId: string, input: UpdateLeadStageRequest, _actorUserId: string): Promise<LeadResponse | null> {
    const lead = this.leads.get(leadId);
    if (!lead || lead.tenantId !== scope.tenantId || (lead.branchId && !scope.branchIds.includes(lead.branchId))) return null;
    lead.stage = input.stage;
    lead.lostReason = input.stage === "lost" ? input.lostReason ?? null : null;
    lead.updatedAt = now();
    const contact = this.contacts.get(lead.contactId);
    return contact ? this.toLeadResponse(lead, contact) : null;
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
