import {
  and,
  desc,
  eq,
  gt,
  ilike,
  inArray,
  isNull,
  lt,
  or,
  sql
} from "drizzle-orm";
import {
  auditEvents,
  branches,
  contacts,
  createDatabase,
  idempotencyKeys,
  members,
  rolePermissions,
  roles,
  sessions,
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
  CursorPage,
  DomainEvent,
  MemberListFilters,
  MemberListItem,
  MemberResponse,
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

const asRoleKey = (value: string | null): RoleKey | null =>
  value === "owner" || value === "manager" || value === "reception" || value === "trainer" || value === "finance"
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
    const [record] = await this.db.insert(sessions).values({
      userId: input.userId,
      tenantUserId: input.tenantUserId,
      sessionTokenHash: input.tokenHash,
      expiresAt: new Date(input.expiresAt),
      ...(input.ipHash ? { ipHash: input.ipHash } : {}),
      ...(input.userAgentSummary ? { userAgentSummary: input.userAgentSummary } : {})
    }).returning({ id: sessions.id });
    if (!record) throw new Error("Unable to create session.");
    return record;
  }

  async resolveSession(tokenHash: string, currentTime: string): Promise<ResolvedSession | null> {
    const [row] = await this.db
      .select({ session: sessions, user: users, tenantUser: tenantUsers, tenant: tenants, role: roles })
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
    await this.db.update(sessions).set({ lastSeenAt: new Date(currentTime) }).where(eq(sessions.id, row.session.id));
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
    await this.db.update(sessions).set({ revokedAt: new Date(at) }).where(eq(sessions.sessionTokenHash, tokenHash));
  }

  async markUserLoggedIn(userId: string, at: string): Promise<void> {
    await this.db.update(users).set({ lastLoginAt: new Date(at), updatedAt: new Date(at) }).where(eq(users.id, userId));
  }

  async findTenant(scope: TenantScope): Promise<TenantSummary | null> {
    const [tenant] = await this.db.select().from(tenants).where(eq(tenants.id, scope.tenantId)).limit(1);
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
      await tx.insert(userBranchAccess).values({ tenantUserId: scope.tenantUserId, branchId: created.id }).onConflictDoNothing();
      return created;
    });
    return this.branchResponse(branch);
  }

  async updateBranch(scope: TenantScope, branchId: string, input: UpdateBranchRequest): Promise<BranchResponse | null> {
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

  async createMember(scope: TenantScope, input: CreateMemberRequest, normalizedPhone: string | null): Promise<MemberResponse> {
    const timestamp = new Date();
    const result = await this.db.transaction(async (tx) => {
      const [contact] = await tx
        .insert(contacts)
        .values({
          tenantId: scope.tenantId,
          firstName: input.contact.firstName,
          ...(input.contact.lastName !== undefined ? { lastName: input.contact.lastName } : {}),
          ...(input.contact.phone !== undefined ? { phoneRaw: input.contact.phone, phoneE164: normalizedPhone } : {}),
          ...(input.contact.email !== undefined ? { email: input.contact.email?.trim().toLowerCase() || null } : {}),
          ...(input.contact.dateOfBirth !== undefined ? { dateOfBirth: input.contact.dateOfBirth } : {}),
          preferredBranchId: input.homeBranchId,
          createdAt: timestamp,
          updatedAt: timestamp
        })
        .returning();
      if (!contact) throw new Error("Unable to create contact.");
      const [member] = await tx
        .insert(members)
        .values({ tenantId: scope.tenantId, contactId: contact.id, homeBranchId: input.homeBranchId, status: "active", joinedAt: timestamp, createdAt: timestamp, updatedAt: timestamp })
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
      .where(and(eq(members.id, memberId), eq(members.tenantId, scope.tenantId), branchAccessCondition(scope)))
      .limit(1);
    return row ? this.memberResponse(row.member, row.contact) : null;
  }

  async searchMembers(scope: TenantScope, filters: MemberListFilters): Promise<CursorPage<MemberListItem>> {
    if (filters.branchId && !scope.branchIds.includes(filters.branchId)) return { data: [], page: { nextCursor: null, hasMore: false } };
    const cursor = decodeCursor(filters.cursor);
    const conditions = [eq(members.tenantId, scope.tenantId), branchAccessCondition(scope)];
    if (filters.branchId) conditions.push(eq(members.homeBranchId, filters.branchId));
    if (filters.status) conditions.push(eq(members.status, filters.status));
    if (filters.query) {
      const term = `%${filters.query.trim().replace(/[\\%_]/g, "\\$&")}%`;
      conditions.push(or(ilike(contacts.firstName, term), ilike(contacts.lastName, term), ilike(contacts.phoneE164, term), ilike(contacts.email, term))!);
    }
    if (cursor) {
      conditions.push(or(lt(members.createdAt, new Date(cursor.createdAt)), and(eq(members.createdAt, new Date(cursor.createdAt)), lt(members.id, cursor.id)))!);
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
      page: { nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: last.id }) : null, hasMore }
    };
  }

  async updateMember(scope: TenantScope, memberId: string, input: UpdateMemberRequest, normalizedPhone?: string | null): Promise<MemberResponse | null> {
    const current = await this.findMemberById(scope, memberId);
    if (!current) return null;
    const result = await this.db.transaction(async (tx) => {
      if (input.contact) {
        await tx
          .update(contacts)
          .set({
            ...(input.contact.firstName !== undefined ? { firstName: input.contact.firstName } : {}),
            ...(input.contact.lastName !== undefined ? { lastName: input.contact.lastName } : {}),
            ...(input.contact.email !== undefined ? { email: input.contact.email?.trim().toLowerCase() || null } : {}),
            ...(input.contact.dateOfBirth !== undefined ? { dateOfBirth: input.contact.dateOfBirth } : {}),
            ...(normalizedPhone !== undefined ? { phoneRaw: input.contact.phone ?? null, phoneE164: normalizedPhone } : {}),
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
      const [contact] = await tx.select().from(contacts).where(eq(contacts.id, member.contactId)).limit(1);
      return contact ? { member, contact } : null;
    });
    return result ? this.memberResponse(result.member, result.contact) : null;
  }

  async listStaff(scope: TenantScope): Promise<StaffUserResponse[]> {
    const rows = await this.db
      .select({ membership: tenantUsers, user: users, role: roles })
      .from(tenantUsers)
      .innerJoin(users, eq(users.id, tenantUsers.userId))
      .innerJoin(roles, eq(roles.id, tenantUsers.roleId))
      .where(eq(tenantUsers.tenantId, scope.tenantId));
    return Promise.all(rows.map(async (row) => ({
      user: this.userResponse(row.user),
      role: await this.roleResponse(row.role),
      branches: await this.branchesFor(row.membership.id, scope.tenantId),
      tenantUserId: row.membership.id
    })));
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
    return { user: this.userResponse(row.user), role: await this.roleResponse(row.role), branches: await this.branchesFor(row.membership.id, scope.tenantId), tenantUserId: row.membership.id };
  }

  async findStaffByEmail(scope: TenantScope, email: string): Promise<StaffUserResponse | null> {
    const [row] = await this.db
      .select({ userId: users.id })
      .from(users)
      .innerJoin(tenantUsers, eq(tenantUsers.userId, users.id))
      .where(and(eq(tenantUsers.tenantId, scope.tenantId), eq(users.email, email.trim().toLowerCase())))
      .limit(1);
    return row ? this.findStaffByUserId(scope, row.userId) : null;
  }

  async findRoleById(scope: TenantScope, roleId: string): Promise<RoleResponse | null> {
    const [role] = await this.db.select().from(roles).where(and(eq(roles.id, roleId), eq(roles.tenantId, scope.tenantId))).limit(1);
    return role ? this.roleResponse(role) : null;
  }

  async inviteStaff(scope: TenantScope, input: InviteStaffInput): Promise<StaffUserResponse> {
    const created = await this.db.transaction(async (tx) => {
      const [user] = await tx.insert(users).values({ email: input.email.trim().toLowerCase(), displayName: input.displayName, passwordHash: "!invite-required!", status: "invited" }).returning();
      if (!user) throw new Error("Unable to create invited user.");
      const [membership] = await tx.insert(tenantUsers).values({ tenantId: scope.tenantId, userId: user.id, roleId: input.roleId, status: "invited" }).returning();
      if (!membership) throw new Error("Unable to create tenant membership.");
      await tx.insert(userBranchAccess).values(input.branchIds.map((branchId) => ({ tenantUserId: membership.id, branchId })));
      return { user, membership };
    });
    const role = await this.findRoleById(scope, input.roleId);
    if (!role) throw new Error("Role not found after invitation.");
    return { user: this.userResponse(created.user), role, branches: await this.branchesFor(created.membership.id, scope.tenantId), tenantUserId: created.membership.id };
  }

  async updateStaffAccess(scope: TenantScope, userId: string, input: StaffAccessInput): Promise<StaffUserResponse | null> {
    const current = await this.findStaffByUserId(scope, userId);
    if (!current) return null;
    await this.db.transaction(async (tx) => {
      await tx.update(tenantUsers).set({ roleId: input.roleId, updatedAt: new Date() }).where(eq(tenantUsers.id, current.tenantUserId));
      await tx.delete(userBranchAccess).where(eq(userBranchAccess.tenantUserId, current.tenantUserId));
      await tx.insert(userBranchAccess).values(input.branchIds.map((branchId) => ({ tenantUserId: current.tenantUserId, branchId })));
    });
    return this.findStaffByUserId(scope, userId);
  }

  async deactivateStaff(scope: TenantScope, userId: string): Promise<StaffUserResponse | null> {
    const current = await this.findStaffByUserId(scope, userId);
    if (!current) return null;
    await this.db.update(tenantUsers).set({ status: "deactivated", updatedAt: new Date() }).where(eq(tenantUsers.id, current.tenantUserId));
    return this.findStaffByUserId(scope, userId);
  }

  async countActiveOwners(scope: TenantScope): Promise<number> {
    const rows = await this.db
      .select({ id: tenantUsers.id })
      .from(tenantUsers)
      .innerJoin(roles, eq(roles.id, tenantUsers.roleId))
      .where(and(eq(tenantUsers.tenantId, scope.tenantId), eq(tenantUsers.status, "active"), eq(roles.systemKey, "owner")));
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
      .where(and(eq(auditEvents.tenantId, scope.tenantId), ...(resourceId ? [eq(auditEvents.resourceId, resourceId)] : [])))
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
      .where(and(eq(idempotencyKeys.tenantId, record.tenantId), eq(idempotencyKeys.operation, record.operation), eq(idempotencyKeys.key, record.key)))
      .limit(1);
    if (!existing || existing.expiresAt <= new Date()) {
      if (existing) {
        await this.db.delete(idempotencyKeys).where(eq(idempotencyKeys.id, existing.id));
      }
      await this.db.insert(idempotencyKeys).values({ tenantId: record.tenantId, operation: record.operation, key: record.key, requestFingerprint: record.fingerprint, expiresAt: new Date(record.expiresAt) });
      return { kind: "acquired" };
    }
    if (existing.requestFingerprint !== record.fingerprint) return { kind: "key_reused" };
    if (!existing.responseStatus) return { kind: "in_progress" };
    return { kind: "replay", responseStatus: existing.responseStatus, responseBody: existing.responseBody ?? {} };
  }

  async completeIdempotency(input: Pick<IdempotencyRecord, "tenantId" | "operation" | "key"> & { responseStatus: number; responseBody: unknown }): Promise<void> {
    await this.db
      .update(idempotencyKeys)
      .set({ responseStatus: input.responseStatus, responseBody: input.responseBody })
      .where(and(eq(idempotencyKeys.tenantId, input.tenantId), eq(idempotencyKeys.operation, input.operation), eq(idempotencyKeys.key, input.key)));
  }

  async abandonIdempotency(input: Pick<IdempotencyRecord, "tenantId" | "operation" | "key">): Promise<void> {
    await this.db.delete(idempotencyKeys).where(and(eq(idempotencyKeys.tenantId, input.tenantId), eq(idempotencyKeys.operation, input.operation), eq(idempotencyKeys.key, input.key)));
  }

  private async roleResponse(role: typeof roles.$inferSelect): Promise<RoleResponse> {
    const permissionRows = await this.db.select({ key: rolePermissions.permissionKey }).from(rolePermissions).where(eq(rolePermissions.roleId, role.id));
    return { id: role.id, key: asRoleKey(role.systemKey), name: role.name, permissions: permissionRows.map(({ key }) => asPermission(key)) };
  }

  private async branchIdsFor(tenantUserId: string, tenantId: string, roleKey: RoleKey | null): Promise<string[]> {
    if (roleKey === "owner") {
      const rows = await this.db.select({ id: branches.id }).from(branches).where(eq(branches.tenantId, tenantId));
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
    return { id: row.id, name: row.name, slug: row.slug, timezone: row.defaultTimezone, currency: row.defaultCurrency, status: row.status as TenantSummary["status"] };
  }

  private branchResponse(row: typeof branches.$inferSelect): BranchResponse {
    return {
      id: row.id, name: row.name, slug: row.slug, timezone: row.timezone, phone: row.phone, email: row.email,
      addressLine1: row.addressLine1, addressLine2: row.addressLine2, city: row.city, countryCode: row.countryCode,
      isActive: row.isActive, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString()
    };
  }

  private userResponse(row: typeof users.$inferSelect): UserSummary {
    return { id: row.id, email: row.email, displayName: row.displayName, status: row.status as UserSummary["status"], lastLoginAt: row.lastLoginAt?.toISOString() ?? null };
  }

  private memberResponse(member: typeof members.$inferSelect, contact: typeof contacts.$inferSelect): MemberResponse {
    return {
      id: member.id, tenantId: member.tenantId, homeBranchId: member.homeBranchId, memberNumber: member.memberNumber,
      status: member.status as MemberResponse["status"], joinedAt: (member.joinedAt ?? member.createdAt).toISOString(), createdAt: member.createdAt.toISOString(), updatedAt: member.updatedAt.toISOString(),
      contact: { id: contact.id, firstName: contact.firstName, lastName: contact.lastName, phone: contact.phoneE164, email: contact.email, dateOfBirth: contact.dateOfBirth ?? null }
    };
  }

  private memberListItem(member: typeof members.$inferSelect, contact: typeof contacts.$inferSelect): MemberListItem {
    return { id: member.id, homeBranchId: member.homeBranchId, status: member.status as MemberListItem["status"], memberNumber: member.memberNumber, firstName: contact.firstName, lastName: contact.lastName, phone: contact.phoneE164, email: contact.email, joinedAt: (member.joinedAt ?? member.createdAt).toISOString(), updatedAt: member.updatedAt.toISOString() };
  }

  private auditResponse(event: typeof auditEvents.$inferSelect): AuditEventResponse {
    return { id: event.id, tenantId: event.tenantId, branchId: event.branchId, actorUserId: event.actorUserId, action: event.action, resourceType: event.resourceType, resourceId: event.resourceId, beforeSummary: event.beforeSummary as Record<string, unknown> | null, afterSummary: event.afterSummary as Record<string, unknown> | null, requestId: event.requestId ?? "", createdAt: event.createdAt.toISOString() };
  }

  private slug(value: string): string {
    return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 100);
  }
}
