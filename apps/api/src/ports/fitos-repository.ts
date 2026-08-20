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
  RoleResponse,
  StaffUserResponse,
  TenantSummary,
  UpdateBranchRequest,
  UpdateMemberRequest,
  UpdateOrganizationRequest,
  UserSummary
} from "@fitos/contracts";

export interface TenantScope {
  tenantId: string;
  tenantUserId: string;
  userId: string;
  branchIds: readonly string[];
}

export interface LoginIdentity {
  user: UserSummary;
  passwordHash: string;
  tenantUserId: string;
  tenant: TenantSummary;
  role: RoleResponse;
  branchIds: string[];
}

export interface ResolvedSession {
  sessionId: string;
  user: UserSummary;
  tenantUserId: string;
  tenant: TenantSummary;
  role: RoleResponse;
  branchIds: string[];
  permissions: PermissionKey[];
}

export interface CreateSessionInput {
  userId: string;
  tenantUserId: string;
  tokenHash: string;
  expiresAt: string;
  ipHash?: string | null;
  userAgentSummary?: string | null;
}

export interface StaffAccessInput {
  roleId: string;
  branchIds: string[];
}

export interface InviteStaffInput extends StaffAccessInput {
  email: string;
  displayName: string;
}

export interface IdempotencyRecord {
  tenantId: string;
  operation: string;
  key: string;
  fingerprint: string;
  status: "in_progress" | "completed";
  responseStatus?: number;
  responseBody?: unknown;
  expiresAt: string;
}

export type IdempotencyAcquireResult =
  | { kind: "acquired" }
  | { kind: "replay"; responseStatus: number; responseBody: unknown }
  | { kind: "in_progress" }
  | { kind: "key_reused" };

/**
 * The API only depends on this tenant-scoped port. The initial in-memory
 * adapter keeps local development runnable; the Drizzle adapter can replace
 * the provider without changing controllers or services.
 */
export interface FitosRepository {
  ping(): Promise<boolean>;

  findLoginIdentity(email: string): Promise<LoginIdentity | null>;
  createSession(input: CreateSessionInput): Promise<{ id: string }>;
  resolveSession(tokenHash: string, now: string): Promise<ResolvedSession | null>;
  revokeSession(tokenHash: string, now: string): Promise<void>;
  markUserLoggedIn(userId: string, at: string): Promise<void>;

  findTenant(scope: TenantScope): Promise<TenantSummary | null>;
  updateTenant(scope: TenantScope, input: UpdateOrganizationRequest): Promise<TenantSummary>;

  listBranches(scope: TenantScope): Promise<BranchResponse[]>;
  findBranchById(scope: TenantScope, branchId: string): Promise<BranchResponse | null>;
  createBranch(scope: TenantScope, input: CreateBranchRequest): Promise<BranchResponse>;
  updateBranch(
    scope: TenantScope,
    branchId: string,
    input: UpdateBranchRequest
  ): Promise<BranchResponse | null>;

  createMember(
    scope: TenantScope,
    input: CreateMemberRequest,
    normalizedPhone: string | null
  ): Promise<MemberResponse>;
  findMemberById(scope: TenantScope, memberId: string): Promise<MemberResponse | null>;
  searchMembers(
    scope: TenantScope,
    filters: MemberListFilters
  ): Promise<CursorPage<MemberListItem>>;
  updateMember(
    scope: TenantScope,
    memberId: string,
    input: UpdateMemberRequest,
    normalizedPhone?: string | null
  ): Promise<MemberResponse | null>;

  createLead(
    scope: TenantScope,
    input: CreateLeadRequest,
    normalizedPhone: string | null
  ): Promise<LeadResponse>;
  findLeadById(scope: TenantScope, leadId: string): Promise<LeadResponse | null>;
  searchLeads(scope: TenantScope, filters: LeadListFilters): Promise<CursorPage<LeadResponse>>;
  updateLeadStage(
    scope: TenantScope,
    leadId: string,
    input: UpdateLeadStageRequest,
    actorUserId: string
  ): Promise<LeadResponse | null>;
  convertLead(
    scope: TenantScope,
    leadId: string,
    actorUserId: string
  ): Promise<LeadConversionResponse | null>;
  addLeadNote(
    scope: TenantScope,
    leadId: string,
    body: string,
    actorUserId: string
  ): Promise<LeadNoteResponse | null>;
  listLeadNotes(scope: TenantScope, leadId: string): Promise<LeadNoteResponse[]>;
  createLeadTask(
    scope: TenantScope,
    leadId: string,
    input: CreateLeadTaskRequest
  ): Promise<LeadTaskResponse | null>;
  listLeadTasks(scope: TenantScope, leadId: string): Promise<LeadTaskResponse[]>;

  listStaff(scope: TenantScope): Promise<StaffUserResponse[]>;
  findStaffByUserId(scope: TenantScope, userId: string): Promise<StaffUserResponse | null>;
  findStaffByEmail(scope: TenantScope, email: string): Promise<StaffUserResponse | null>;
  findRoleById(scope: TenantScope, roleId: string): Promise<RoleResponse | null>;
  inviteStaff(scope: TenantScope, input: InviteStaffInput): Promise<StaffUserResponse>;
  updateStaffAccess(
    scope: TenantScope,
    userId: string,
    input: StaffAccessInput
  ): Promise<StaffUserResponse | null>;
  deactivateStaff(scope: TenantScope, userId: string): Promise<StaffUserResponse | null>;
  countActiveOwners(scope: TenantScope): Promise<number>;

  recordAudit(input: AuditRecordInput): Promise<AuditEventResponse>;
  listAuditEvents(scope: TenantScope, resourceId?: string): Promise<AuditEventResponse[]>;
  publishEvent(event: DomainEvent): Promise<void>;

  acquireIdempotency(record: IdempotencyRecord): Promise<IdempotencyAcquireResult>;
  completeIdempotency(
    input: Pick<IdempotencyRecord, "tenantId" | "operation" | "key"> & {
      responseStatus: number;
      responseBody: unknown;
    }
  ): Promise<void>;
  abandonIdempotency(
    input: Pick<IdempotencyRecord, "tenantId" | "operation" | "key">
  ): Promise<void>;

  seedDevelopmentData?(passwordHash: string): Promise<void>;
}
