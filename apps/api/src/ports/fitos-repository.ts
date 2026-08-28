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
  PaymentTransactionResponse,
  CreatePaymentRequest,
  ReconcilePaymentRequest,
  PaymentListFilters,
  AttendanceRecordResponse,
  CheckInRequest,
  UpdateRosterStatusRequest,
  AttendanceListFilters,
  PublicTenantInfoResponse,
  PublicServiceResponse,
  PublicCoachResponse,
  PublicScheduleOccurrenceResponse,
  CreatePublicLeadRequest,
  MemberProfileResponse,
  MemberPortalOverviewResponse,
  InsightsOverviewResponse,
  AutomationRuleResponse,
  CreateAutomationRuleRequest,
  UpdateAutomationRuleRequest,
  AutomationExecutionLogResponse,
  SaaSTenantSignupRequest,
  SaaSTenantSignupResponse,
  TenantSubscriptionResponse,
  UsageQuotaMetricsResponse,
  FeatureFlagResponse,
  PlatformTenantControlRecord,
  EquipmentAssetResponse,
  CreateEquipmentAssetRequest,
  UpdateEquipmentAssetRequest,
  EquipmentPoolResponse,
  CreateEquipmentPoolRequest,
  EquipmentMaintenanceRecordResponse,
  CreateMaintenanceRecordRequest,
  InventoryItemResponse,
  CreateInventoryItemRequest,
  UpdateInventoryItemRequest,
  InventoryMovementResponse,
  CreateInventoryMovementRequest,
  PurchaseOrderResponse,
  CreatePurchaseOrderRequest,
  AssessmentDefinitionResponse,
  CreateAssessmentDefinitionRequest,
  AssessmentSessionResponse,
  CreateAssessmentSessionRequest,
  MemberPerformanceProfileResponse,
  TherapyModalityResponse,
  CreateTherapyModalityRequest,
  TherapyProtocolResponse,
  CreateTherapyProtocolRequest,
  TherapySessionResponse,
  CreateTherapySessionRequest,
  ServiceEquipmentRequirement
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
  roles?: RoleResponse[];
  preferredWorkspace?: import("@fitos/contracts").WorkspaceKey | null;
  branchIds: string[];
}

export interface ResolvedSession {
  sessionId: string;
  user: UserSummary;
  tenantUserId: string;
  tenant: TenantSummary;
  role: RoleResponse;
  roles?: RoleResponse[];
  preferredWorkspace?: import("@fitos/contracts").WorkspaceKey | null;
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
  roleIds?: string[];
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
  findUserById(userId: string): Promise<{
    id: string;
    displayName: string;
    email: string | null;
    isPlatformAdmin: boolean;
  } | null>;
  createSession(input: CreateSessionInput): Promise<{ id: string }>;
  resolveSession(tokenHash: string, now: string): Promise<ResolvedSession | null>;
  revokeSession(tokenHash: string, now: string): Promise<void>;
  markUserLoggedIn(userId: string, at: string): Promise<void>;
  setUserPassword(userId: string, passwordHash: string): Promise<void>;
  revokeOtherUserSessions(userId: string, currentSessionId: string, at: string): Promise<void>;
  listUserSessions(
    userId: string,
    now: string
  ): Promise<import("@fitos/contracts").SessionSummary[]>;
  revokeUserSession(userId: string, sessionId: string, at: string): Promise<boolean>;
  updateUserProfile(
    userId: string,
    input: import("@fitos/contracts").UpdateUserProfileRequest
  ): Promise<UserSummary | null>;

  findTenant(scope: TenantScope): Promise<TenantSummary | null>;
  updateTenant(scope: TenantScope, input: UpdateOrganizationRequest): Promise<TenantSummary>;

  listBranches(scope: TenantScope): Promise<BranchResponse[]>;
  listTenantBranches(tenantId: string): Promise<BranchResponse[]>;
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
  completeLeadTask(
    scope: TenantScope,
    leadId: string,
    taskId: string
  ): Promise<LeadTaskResponse | null>;

  listServices(scope: TenantScope): Promise<ServiceResponse[]>;
  findServiceById(scope: TenantScope, serviceId: string): Promise<ServiceResponse | null>;
  createService(scope: TenantScope, input: CreateServiceRequest): Promise<ServiceResponse>;
  updateService(
    scope: TenantScope,
    serviceId: string,
    input: UpdateServiceRequest
  ): Promise<ServiceResponse | null>;
  listRooms(scope: TenantScope, branchId?: string): Promise<RoomResponse[]>;
  findRoomById(scope: TenantScope, roomId: string): Promise<RoomResponse | null>;
  createRoom(scope: TenantScope, input: CreateRoomRequest): Promise<RoomResponse>;
  updateRoom(
    scope: TenantScope,
    roomId: string,
    input: UpdateRoomRequest
  ): Promise<RoomResponse | null>;
  createScheduleTemplate(
    scope: TenantScope,
    input: CreateScheduleTemplateRequest,
    occurrences: CreateScheduleOccurrenceRequest[],
    materializedThrough: string
  ): Promise<ScheduleTemplateMutationResponse>;
  findScheduleTemplateById(
    scope: TenantScope,
    templateId: string
  ): Promise<ScheduleTemplateResponse | null>;
  listScheduleTemplates(scope: TenantScope, branchId?: string): Promise<ScheduleTemplateResponse[]>;
  materializeScheduleTemplate(
    scope: TenantScope,
    templateId: string,
    occurrences: CreateScheduleOccurrenceRequest[],
    materializedThrough: string
  ): Promise<ScheduleTemplateMutationResponse | null>;
  createScheduleOccurrence(
    scope: TenantScope,
    input: CreateScheduleOccurrenceRequest
  ): Promise<ScheduleOccurrenceResponse>;
  findScheduleOccurrenceById(
    scope: TenantScope,
    occurrenceId: string
  ): Promise<ScheduleOccurrenceResponse | null>;
  listScheduleOccurrences(
    scope: TenantScope,
    filters: ScheduleOccurrenceFilters
  ): Promise<CursorPage<ScheduleOccurrenceResponse>>;
  cancelScheduleOccurrence(
    scope: TenantScope,
    occurrenceId: string,
    reason: string,
    actorUserId?: string
  ): Promise<ScheduleOccurrenceResponse | null>;
  overrideScheduleOccurrence(
    scope: TenantScope,
    occurrenceId: string,
    input: OverrideScheduleOccurrenceRequest,
    actorUserId: string
  ): Promise<ScheduleOccurrenceResponse | null>;

  createBooking(
    scope: TenantScope,
    input: CreateBookingRequest,
    actorUserId: string,
    allowEntitlementOverride: boolean
  ): Promise<BookingResponse>;
  findBookingById(scope: TenantScope, bookingId: string): Promise<BookingResponse | null>;
  listBookings(
    scope: TenantScope,
    filters: BookingListFilters
  ): Promise<CursorPage<BookingResponse>>;
  cancelBooking(
    scope: TenantScope,
    bookingId: string,
    reason: string
  ): Promise<BookingResponse | null>;

  // Memberships & Credits
  listMembershipPlans(scope: TenantScope, branchId?: string): Promise<MembershipPlanResponse[]>;
  findMembershipPlanById(
    scope: TenantScope,
    planId: string
  ): Promise<MembershipPlanResponse | null>;
  createMembershipPlan(
    scope: TenantScope,
    input: CreateMembershipPlanRequest
  ): Promise<MembershipPlanResponse>;
  updateMembershipPlan(
    scope: TenantScope,
    planId: string,
    input: Partial<CreateMembershipPlanRequest> & { isActive?: boolean }
  ): Promise<MembershipPlanResponse | null>;
  listMemberMemberships(scope: TenantScope, memberId: string): Promise<MemberMembershipResponse[]>;
  findMemberMembershipById(
    scope: TenantScope,
    membershipId: string
  ): Promise<MemberMembershipResponse | null>;
  activateMembership(
    scope: TenantScope,
    input: ActivateMembershipRequest,
    actorUserId?: string
  ): Promise<{ membership: MemberMembershipResponse; ledgerEntry: CreditLedgerEntryResponse }>;
  cancelMembership(
    scope: TenantScope,
    membershipId: string,
    reason?: string
  ): Promise<MemberMembershipResponse | null>;
  holdMembership(
    scope: TenantScope,
    membershipId: string
  ): Promise<MemberMembershipResponse | null>;
  resumeMembership(
    scope: TenantScope,
    membershipId: string
  ): Promise<MemberMembershipResponse | null>;
  renewMembership(
    scope: TenantScope,
    membershipId: string,
    actorUserId?: string
  ): Promise<{
    membership: MemberMembershipResponse;
    ledgerEntry: CreditLedgerEntryResponse;
  } | null>;
  listCreditLedger(scope: TenantScope, memberId: string): Promise<CreditLedgerEntryResponse[]>;
  getCreditBalance(scope: TenantScope, memberId: string): Promise<number>;
  adjustCredit(
    scope: TenantScope,
    memberId: string,
    input: ManualCreditAdjustmentRequest,
    actorUserId: string
  ): Promise<CreditLedgerEntryResponse>;

  listStaff(scope: TenantScope): Promise<StaffUserResponse[]>;
  findStaffByUserId(scope: TenantScope, userId: string): Promise<StaffUserResponse | null>;
  findStaffByEmail(scope: TenantScope, email: string): Promise<StaffUserResponse | null>;
  findRoleById(scope: TenantScope, roleId: string): Promise<RoleResponse | null>;
  listRoles(scope: TenantScope): Promise<RoleResponse[]>;
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
  listPlatformAuditEvents(): Promise<AuditEventResponse[]>;
  getNotificationPreferences(
    userId: string
  ): Promise<import("@fitos/contracts").NotificationPreferences>;
  updateNotificationPreferences(
    userId: string,
    input: import("@fitos/contracts").UpdateNotificationPreferencesRequest
  ): Promise<import("@fitos/contracts").NotificationPreferences | null>;
  createAccountExportRequest(
    scope: TenantScope,
    requestedByUserId: string
  ): Promise<import("@fitos/contracts").AccountExportRequestResponse>;
  listAccountExportRequests(
    scope: TenantScope
  ): Promise<import("@fitos/contracts").AccountExportRequestResponse[]>;
  publishEvent(event: DomainEvent): Promise<void>;

  // Payments
  createPayment(
    scope: TenantScope,
    input: CreatePaymentRequest,
    actorUserId: string
  ): Promise<PaymentTransactionResponse>;
  findPaymentById(
    scope: TenantScope,
    paymentId: string
  ): Promise<PaymentTransactionResponse | null>;
  listPayments(
    scope: TenantScope,
    filters: PaymentListFilters
  ): Promise<CursorPage<PaymentTransactionResponse>>;
  voidPayment(
    scope: TenantScope,
    paymentId: string,
    reason: string
  ): Promise<PaymentTransactionResponse | null>;
  reconcilePayment(
    scope: TenantScope,
    paymentId: string,
    input: ReconcilePaymentRequest
  ): Promise<PaymentTransactionResponse | null>;
  refundPayment(
    scope: TenantScope,
    paymentId: string,
    reason: string
  ): Promise<PaymentTransactionResponse | null>;

  // Attendance
  checkIn(
    scope: TenantScope,
    input: CheckInRequest,
    actorUserId: string,
    branchId: string,
    allowOverride: boolean
  ): Promise<AttendanceRecordResponse>;
  findAttendanceRecord(
    scope: TenantScope,
    recordId: string
  ): Promise<AttendanceRecordResponse | null>;
  listAttendanceRecords(
    scope: TenantScope,
    filters: AttendanceListFilters
  ): Promise<CursorPage<AttendanceRecordResponse>>;
  updateAttendanceStatus(
    scope: TenantScope,
    recordId: string,
    input: UpdateRosterStatusRequest,
    allowOverride: boolean
  ): Promise<AttendanceRecordResponse | null>;

  // Public Tenant
  getPublicTenantInfo(tenantSlug: string): Promise<PublicTenantInfoResponse | null>;
  listPublicServices(tenantSlug: string): Promise<PublicServiceResponse[]>;
  listPublicCoaches(tenantSlug: string): Promise<PublicCoachResponse[]>;
  listPublicSchedule(
    tenantSlug: string,
    daysAhead?: number
  ): Promise<PublicScheduleOccurrenceResponse[]>;
  createPublicLead(tenantSlug: string, input: CreatePublicLeadRequest): Promise<LeadResponse>;
  createPublicReservation(
    tenantSlug: string,
    input: import("@fitos/contracts").CreatePublicReservationRequest
  ): Promise<import("@fitos/contracts").PublicReservationResponse>;

  // Member Portal & Auth
  findMemberByIdentifier(identifier: string): Promise<MemberResponse | null>;
  setMemberPassword(memberId: string, passwordHash: string): Promise<void>;
  verifyMemberPassword(memberId: string, password: string): Promise<boolean>;
  createMemberSession(input: {
    memberId: string;
    tokenHash: string;
    expiresAt: string;
  }): Promise<{ id: string }>;
  resolveMemberSession(
    tokenHash: string,
    currentTime: string
  ): Promise<MemberProfileResponse | null>;
  revokeMemberSession(tokenHash: string, at: string): Promise<void>;
  getMemberPortalOverview(memberId: string): Promise<MemberPortalOverviewResponse | null>;
  memberSelfBook(memberId: string, occurrenceId: string): Promise<BookingResponse>;
  memberSelfCancel(memberId: string, bookingId: string, reason: string): Promise<BookingResponse>;

  // Insights Analytics
  getInsightsOverview(scope: TenantScope, branchId?: string): Promise<InsightsOverviewResponse>;
  getTodayOverview(
    scope: TenantScope,
    branchId: string
  ): Promise<import("@fitos/contracts").TodayOverviewResponse>;

  // Automations
  listAutomations(scope: TenantScope): Promise<AutomationRuleResponse[]>;
  createAutomation(
    scope: TenantScope,
    input: CreateAutomationRuleRequest
  ): Promise<AutomationRuleResponse>;
  updateAutomation(
    scope: TenantScope,
    ruleId: string,
    input: UpdateAutomationRuleRequest
  ): Promise<AutomationRuleResponse | null>;
  deleteAutomation(scope: TenantScope, ruleId: string): Promise<boolean>;
  listAutomationLogs(scope: TenantScope): Promise<AutomationExecutionLogResponse[]>;
  triggerAutomation(scope: TenantScope, ruleId: string): Promise<AutomationExecutionLogResponse>;
  recordAutomationActionResult(
    actionId: string,
    result: import("@fitos/contracts").AutomationActionResult
  ): Promise<boolean>;

  // Platform & Self-Service SaaS
  signupTenant(
    input: SaaSTenantSignupRequest,
    passwordHash: string
  ): Promise<SaaSTenantSignupResponse>;
  getTenantSubscription(tenantId: string): Promise<TenantSubscriptionResponse>;
  getWorkspacePreference(
    userId: string,
    tenantId: string
  ): Promise<import("@fitos/contracts").WorkspaceKey | null>;
  setWorkspacePreference(
    userId: string,
    tenantId: string,
    workspace: import("@fitos/contracts").WorkspaceKey
  ): Promise<void>;
  listPlatformTenantControls(): Promise<PlatformTenantControlRecord[]>;
  getTenantUsageQuotas(tenantId: string): Promise<UsageQuotaMetricsResponse>;
  transitionTenantSubscriptionStatus(
    tenantId: string,
    status: import("@fitos/contracts").TenantAccountStatus
  ): Promise<TenantSubscriptionResponse | null>;
  updateTenantCapabilities(
    tenantId: string,
    capabilities: import("@fitos/contracts").SaaSCapabilityKey[]
  ): Promise<TenantSubscriptionResponse | null>;
  listFeatureFlags(tenantId: string): Promise<FeatureFlagResponse[]>;
  saveImplementationInquiry(
    input: import("@fitos/contracts").ImplementationInquiryDraft,
    submit: boolean
  ): Promise<import("@fitos/contracts").ImplementationInquiryResponse>;
  listImplementationInquiries(
    status?: import("@fitos/contracts").ImplementationInquiryStatus
  ): Promise<import("@fitos/contracts").ImplementationInquiryResponse[]>;
  getImplementationInquiry(
    id: string
  ): Promise<import("@fitos/contracts").ImplementationInquiryResponse | null>;
  getImplementationInquiryByToken(
    id: string,
    token: string
  ): Promise<import("@fitos/contracts").ImplementationInquiryResponse | null>;
  updateImplementationInquiryStatus(
    id: string,
    status: import("@fitos/contracts").ImplementationInquiryStatus
  ): Promise<import("@fitos/contracts").ImplementationInquiryResponse | null>;
  buildTenantSeedManifest(
    id: string
  ): Promise<import("@fitos/contracts").TenantSeedManifest | null>;
  resolvePlatformAdminByTokenHash(
    tokenHash: string
  ): Promise<{ userId: string; displayName: string; email: string | null } | null>;
  createPlatformAdminToken(input: {
    userId: string;
    tokenHash: string;
    expiresAt: string;
  }): Promise<void>;
  revokePlatformAdminToken(tokenHash: string, at: string): Promise<void>;
  revokeAllPlatformAdminTokens(userId: string, at: string): Promise<void>;
  listSitePages(scope: TenantScope): Promise<import("@fitos/contracts").SitePageResponse[]>;
  saveSitePage(
    scope: TenantScope,
    input: import("@fitos/contracts").SaveSitePageRequest
  ): Promise<import("@fitos/contracts").SitePageResponse>;
  publishSitePage(
    scope: TenantScope,
    pageId: string
  ): Promise<import("@fitos/contracts").SitePageResponse | null>;
  getPublicSitePage(
    tenantSlug: string,
    pageSlug?: string
  ): Promise<import("@fitos/contracts").SitePageResponse | null>;

  // Equipment & Resource Scheduling
  listEquipmentAssets(scope: TenantScope, branchId?: string): Promise<EquipmentAssetResponse[]>;
  findEquipmentAssetById(
    scope: TenantScope,
    assetId: string
  ): Promise<EquipmentAssetResponse | null>;
  createEquipmentAsset(
    scope: TenantScope,
    input: CreateEquipmentAssetRequest
  ): Promise<EquipmentAssetResponse>;
  updateEquipmentAsset(
    scope: TenantScope,
    assetId: string,
    input: UpdateEquipmentAssetRequest
  ): Promise<EquipmentAssetResponse | null>;
  listEquipmentPools(scope: TenantScope, branchId?: string): Promise<EquipmentPoolResponse[]>;
  createEquipmentPool(
    scope: TenantScope,
    input: CreateEquipmentPoolRequest
  ): Promise<EquipmentPoolResponse>;
  listEquipmentMaintenance(
    scope: TenantScope,
    assetId?: string
  ): Promise<EquipmentMaintenanceRecordResponse[]>;
  createEquipmentMaintenance(
    scope: TenantScope,
    input: CreateMaintenanceRecordRequest
  ): Promise<EquipmentMaintenanceRecordResponse>;
  listOccurrenceEquipmentAllocations(
    scope: TenantScope,
    occurrenceId: string
  ): Promise<import("@fitos/contracts").EquipmentAllocationResponse[]>;
  reserveOccurrenceEquipment(
    scope: TenantScope,
    occurrenceId: string,
    assetId: string
  ): Promise<import("@fitos/contracts").EquipmentAllocationResponse>;
  releaseOccurrenceEquipment(
    scope: TenantScope,
    allocationId: string
  ): Promise<import("@fitos/contracts").EquipmentAllocationResponse | null>;
  listServiceEquipmentRequirements(
    scope: TenantScope,
    serviceId: string
  ): Promise<ServiceEquipmentRequirement[]>;
  replaceServiceEquipmentRequirements(
    scope: TenantScope,
    serviceId: string,
    requirements: ServiceEquipmentRequirement[]
  ): Promise<ServiceEquipmentRequirement[]>;

  // Inventory & Consumables
  listInventoryItems(scope: TenantScope, branchId?: string): Promise<InventoryItemResponse[]>;
  findInventoryItemById(scope: TenantScope, itemId: string): Promise<InventoryItemResponse | null>;
  createInventoryItem(
    scope: TenantScope,
    input: CreateInventoryItemRequest
  ): Promise<InventoryItemResponse>;
  updateInventoryItem(
    scope: TenantScope,
    itemId: string,
    input: UpdateInventoryItemRequest
  ): Promise<InventoryItemResponse | null>;
  listInventoryMovements(scope: TenantScope, itemId?: string): Promise<InventoryMovementResponse[]>;
  createInventoryMovement(
    scope: TenantScope,
    input: CreateInventoryMovementRequest,
    recordedByUserId: string
  ): Promise<InventoryMovementResponse>;
  listPurchaseOrders(scope: TenantScope, branchId?: string): Promise<PurchaseOrderResponse[]>;
  createPurchaseOrder(
    scope: TenantScope,
    input: CreatePurchaseOrderRequest
  ): Promise<PurchaseOrderResponse>;
  listServiceInventoryRequirements(
    scope: TenantScope,
    serviceId: string
  ): Promise<import("@fitos/contracts").ServiceInventoryRequirement[]>;
  replaceServiceInventoryRequirements(
    scope: TenantScope,
    serviceId: string,
    requirements: import("@fitos/contracts").ServiceInventoryRequirement[]
  ): Promise<import("@fitos/contracts").ServiceInventoryRequirement[]>;
  consumeInventory(
    scope: TenantScope,
    input: {
      branchId: string;
      serviceId?: string;
      referenceType: string;
      referenceId: string;
      items: import("@fitos/contracts").ServiceInventoryRequirement[];
    }
  ): Promise<import("@fitos/contracts").InventoryConsumptionResponse[]>;
  listInventoryLots(
    scope: TenantScope,
    itemId?: string
  ): Promise<import("@fitos/contracts").InventoryLotResponse[]>;
  createInventoryLot(
    scope: TenantScope,
    input: import("@fitos/contracts").CreateInventoryLotRequest
  ): Promise<import("@fitos/contracts").InventoryLotResponse>;
  listExpiringInventoryLots(
    scope: TenantScope,
    daysAhead: number
  ): Promise<import("@fitos/contracts").InventoryLotResponse[]>;
  listStocktakes(
    scope: TenantScope,
    branchId?: string
  ): Promise<import("@fitos/contracts").StocktakeResponse[]>;
  createStocktake(
    scope: TenantScope,
    input: import("@fitos/contracts").CreateStocktakeRequest,
    createdByUserId: string
  ): Promise<import("@fitos/contracts").StocktakeResponse>;
  getStocktake(
    scope: TenantScope,
    stocktakeId: string
  ): Promise<import("@fitos/contracts").StocktakeResponse | null>;
  recordStocktakeCount(
    scope: TenantScope,
    stocktakeId: string,
    input: import("@fitos/contracts").RecordStocktakeCountRequest
  ): Promise<import("@fitos/contracts").StocktakeResponse>;
  completeStocktake(
    scope: TenantScope,
    stocktakeId: string,
    actorUserId: string
  ): Promise<import("@fitos/contracts").StocktakeResponse>;

  // FITOS Assess & Performance Profiles
  listAssessmentDefinitions(scope: TenantScope): Promise<AssessmentDefinitionResponse[]>;
  createAssessmentDefinition(
    scope: TenantScope,
    input: CreateAssessmentDefinitionRequest
  ): Promise<AssessmentDefinitionResponse>;
  listAssessmentSessions(
    scope: TenantScope,
    memberId?: string,
    branchId?: string
  ): Promise<AssessmentSessionResponse[]>;
  createAssessmentSession(
    scope: TenantScope,
    input: CreateAssessmentSessionRequest,
    assessorStaffId: string
  ): Promise<AssessmentSessionResponse>;
  getMemberPerformanceProfile(
    scope: TenantScope,
    memberId: string
  ): Promise<MemberPerformanceProfileResponse>;

  // FITOS Therapy & Recovery
  listTherapyModalities(scope: TenantScope): Promise<TherapyModalityResponse[]>;
  createTherapyModality(
    scope: TenantScope,
    input: CreateTherapyModalityRequest
  ): Promise<TherapyModalityResponse>;
  listTherapyProtocols(
    scope: TenantScope,
    modalityCode?: string
  ): Promise<TherapyProtocolResponse[]>;
  createTherapyProtocol(
    scope: TenantScope,
    input: CreateTherapyProtocolRequest
  ): Promise<TherapyProtocolResponse>;
  listTherapySessions(
    scope: TenantScope,
    memberId?: string,
    branchId?: string
  ): Promise<TherapySessionResponse[]>;
  createTherapySession(
    scope: TenantScope,
    input: CreateTherapySessionRequest,
    staffUserId: string
  ): Promise<TherapySessionResponse>;

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
