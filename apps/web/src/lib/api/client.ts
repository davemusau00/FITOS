import type {
  AuthMeResponse,
  BranchResponse,
  CreateBranchRequest,
  CreateMemberRequest,
  CreateLeadRequest,
  CursorPage,
  MemberListItem,
  MemberResponse,
  MemberTagResponse,
  CreateMemberTagRequest,
  UpdateMemberTagRequest,
  MemberSegmentResponse,
  CreateMemberSegmentRequest,
  UpdateMemberSegmentRequest,
  MemberSavedViewResponse,
  CreateMemberSavedViewRequest,
  UpdateMemberSavedViewRequest,
  LeadListResponse,
  LeadNoteResponse,
  LeadResponse,
  LeadTaskResponse,
  CreateLeadTaskRequest,
  UpdateLeadStageRequest,
  StaffUserResponse,
  TenantSummary,
  UpdateBranchRequest,
  UpdateMemberRequest,
  BulkMemberActionResponse,
  UpdateOrganizationRequest,
  ServiceResponse,
  CreateServiceRequest,
  UpdateServiceRequest,
  ServiceEquipmentRequirement,
  RoomResponse,
  CreateRoomRequest,
  UpdateRoomRequest,
  ScheduleOccurrenceResponse,
  CreateScheduleOccurrenceRequest,
  ScheduleOccurrenceListResponse,
  ScheduleTemplateResponse,
  CreateScheduleTemplateRequest,
  ScheduleTemplateMutationResponse,
  OverrideScheduleOccurrenceRequest,
  BookingResponse,
  CreateBookingRequest,
  BookingListResponse,
  MembershipPlanResponse,
  CreateMembershipPlanRequest,
  MemberMembershipResponse,
  CreditLedgerEntryResponse,
  ManualCreditAdjustmentRequest,
  PaymentTransactionResponse,
  CreatePaymentRequest,
  ReconcilePaymentRequest,
  AttendanceRecordResponse,
  UpdateRosterStatusRequest,
  // New: insights, automations, public, member portal
  InsightsOverviewResponse,
  TodayOverviewResponse,
  AutomationRuleResponse,
  CreateAutomationRuleRequest,
  UpdateAutomationRuleRequest,
  AutomationExecutionLogResponse,
  PublicTenantInfoResponse,
  PublicServiceResponse,
  PublicCoachResponse,
  PublicScheduleOccurrenceResponse,
  CreatePublicReservationRequest,
  PublicReservationResponse,
  MemberProfileResponse,
  MemberPortalOverviewResponse,
  // Platform / SaaS
  SaaSTenantSignupRequest,
  SaaSTenantSignupResponse,
  TenantSubscriptionResponse,
  UsageQuotaMetricsResponse,
  FeatureFlagResponse,
  ImplementationInquiryDraft,
  ImplementationInquiryResponse,
  ImplementationInquiryStatus,
  TenantSeedManifest,
  SitePageResponse,
  SaveSitePageRequest,
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
  CreateTherapyModalityRequest,
  TherapyProtocolResponse,
  CreateTherapyProtocolRequest,
  TherapySessionResponse,
  CreateTherapySessionRequest
} from "@fitos/contracts";

export class ApiClientError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string,
    readonly fields?: Record<string, string[]>,
    readonly requestId?: string
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

function cookie(name: string): string | undefined {
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = init.method ?? "GET";
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (path.startsWith("/platform/") && !headers.has("X-Platform-Token")) {
    const platformToken = window.localStorage.getItem("fitos_platform_token");
    if (platformToken) headers.set("X-Platform-Token", platformToken);
  }
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const csrf = cookie("fitos_csrf");
    if (csrf) headers.set("X-CSRF-Token", csrf);
  }
  const response = await fetch(`${apiBase}${path}`, {
    ...init,
    method,
    headers,
    credentials: "include"
  });
  if (response.status === 204) return undefined as T;
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload as {
      error?: {
        code?: string;
        message?: string;
        fields?: Record<string, string[]>;
        requestId?: string;
      };
    } | null;
    throw new ApiClientError(
      error?.error?.message ?? "The request failed.",
      response.status,
      error?.error?.code ?? "UNEXPECTED_ERROR",
      error?.error?.fields,
      error?.error?.requestId
    );
  }
  return payload as T;
}

const json = (payload: unknown) => JSON.stringify(payload);
const idempotency = () => crypto.randomUUID();

export const api = {
  platformLogin: (payload: { email: string; password: string }) =>
    request<{
      token: string;
      expiresAt: string;
      user: { id: string; displayName: string; email: string };
    }>("/platform/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  platformMe: () =>
    request<{ userId: string; email: string; displayName: string }>("/platform/auth/me"),
  platformLogout: () => request<{ ok: boolean }>("/platform/auth/logout", { method: "POST" }),
  login: (payload: { email: string; password: string }) =>
    request<AuthMeResponse>("/auth/login", { method: "POST", body: json(payload) }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  me: () => request<AuthMeResponse>("/auth/me"),
  updateUserProfile: (payload: import("@fitos/contracts").UpdateUserProfileRequest) =>
    request("/users/me/profile", { method: "PATCH", body: json(payload) }),
  notificationPreferences: () =>
    request<import("@fitos/contracts").NotificationPreferences>("/users/me/notifications"),
  updateNotificationPreferences: (
    payload: import("@fitos/contracts").UpdateNotificationPreferencesRequest
  ) => request("/users/me/notifications", { method: "PATCH", body: json(payload) }),
  notificationInbox: () =>
    request<import("@fitos/contracts").NotificationResponse[]>("/users/me/notification-inbox"),
  markNotificationRead: (notificationId: string) =>
    request<import("@fitos/contracts").NotificationResponse>(
      `/users/me/notification-inbox/${notificationId}/read`,
      { method: "PATCH" }
    ),
  systemNotices: () =>
    request<import("@fitos/contracts").SystemNoticeViewResponse[]>("/users/me/system-notices"),
  acknowledgeSystemNotice: (noticeId: string) =>
    request<import("@fitos/contracts").SystemNoticeViewResponse>(
      `/users/me/system-notices/${noticeId}/acknowledge`,
      { method: "POST" }
    ),
  accountExportRequests: () =>
    request<import("@fitos/contracts").AccountExportRequestResponse[]>("/users/me/export-requests"),
  requestAccountExport: () =>
    request<import("@fitos/contracts").AccountExportRequestResponse>("/users/me/export-requests", {
      method: "POST",
      headers: { "Idempotency-Key": idempotency() }
    }),
  changePassword: (payload: { currentPassword: string; newPassword: string }) =>
    request<{ ok: boolean }>("/auth/password", { method: "PATCH", body: json(payload) }),
  sessions: () => request<import("@fitos/contracts").SessionSummary[]>("/auth/sessions"),
  revokeSession: (sessionId: string) =>
    request<{ ok: boolean }>(`/auth/sessions/${sessionId}/revoke`, { method: "POST" }),
  setWorkspace: (workspace: import("@fitos/contracts").WorkspaceKey) =>
    request<AuthMeResponse>("/auth/workspace", {
      method: "PATCH",
      body: json({ workspace })
    }),
  organization: () => request<TenantSummary>("/organization"),
  updateOrganization: (payload: UpdateOrganizationRequest) =>
    request<TenantSummary>("/organization", { method: "PATCH", body: json(payload) }),
  auditEvents: () => request<import("@fitos/contracts").AuditEventResponse[]>("/audit-events"),
  branches: () => request<BranchResponse[]>("/branches"),
  branch: (id: string) => request<BranchResponse>(`/branches/${id}`),
  createBranch: (payload: CreateBranchRequest) =>
    request<BranchResponse>("/branches", {
      method: "POST",
      body: json(payload),
      headers: { "Idempotency-Key": idempotency() }
    }),
  updateBranch: (id: string, payload: UpdateBranchRequest) =>
    request<BranchResponse>(`/branches/${id}`, { method: "PATCH", body: json(payload) }),
  members: (params: URLSearchParams) =>
    request<CursorPage<MemberListItem>>(`/members?${params.toString()}`),
  member: (id: string) => request<MemberResponse>(`/members/${id}`),
  createMember: (payload: CreateMemberRequest) =>
    request<MemberResponse>("/members", {
      method: "POST",
      body: json(payload),
      headers: { "Idempotency-Key": idempotency() }
    }),
  updateMember: (id: string, payload: UpdateMemberRequest) =>
    request<MemberResponse>(`/members/${id}`, { method: "PATCH", body: json(payload) }),
  bulkMemberAction: (payload: {
    memberIds: string[];
    action: "set_status";
    status: import("@fitos/contracts").MemberStatus;
  }) =>
    request<BulkMemberActionResponse>("/members/bulk", {
      method: "POST",
      body: json(payload),
      headers: { "Idempotency-Key": idempotency() }
    }),
  memberTags: () => request<MemberTagResponse[]>("/members/tags"),
  createMemberTag: (payload: CreateMemberTagRequest) =>
    request<MemberTagResponse>("/members/tags", {
      method: "POST",
      body: json(payload),
      headers: { "Idempotency-Key": idempotency() }
    }),
  updateMemberTag: (id: string, payload: UpdateMemberTagRequest) =>
    request<MemberTagResponse>(`/members/tags/${id}`, { method: "PATCH", body: json(payload) }),
  deleteMemberTag: (id: string) =>
    request<MemberTagResponse>(`/members/tags/${id}`, { method: "DELETE" }),
  memberTagsForMember: (memberId: string) =>
    request<MemberTagResponse[]>(`/members/${memberId}/tags`),
  assignMemberTag: (memberId: string, tagId: string) =>
    request<MemberTagResponse>(`/members/${memberId}/tags/${tagId}`, { method: "POST" }),
  unassignMemberTag: (memberId: string, tagId: string) =>
    request<{ removed: boolean }>(`/members/${memberId}/tags/${tagId}`, { method: "DELETE" }),
  memberSegments: () => request<MemberSegmentResponse[]>("/members/segments"),
  createMemberSegment: (payload: CreateMemberSegmentRequest) =>
    request<MemberSegmentResponse>("/members/segments", {
      method: "POST",
      body: json(payload),
      headers: { "Idempotency-Key": idempotency() }
    }),
  updateMemberSegment: (id: string, payload: UpdateMemberSegmentRequest) =>
    request<MemberSegmentResponse>(`/members/segments/${id}`, {
      method: "PATCH",
      body: json(payload)
    }),
  deleteMemberSegment: (id: string) =>
    request<MemberSegmentResponse>(`/members/segments/${id}`, { method: "DELETE" }),
  memberSavedViews: () => request<MemberSavedViewResponse[]>("/members/views"),
  createMemberSavedView: (payload: CreateMemberSavedViewRequest) =>
    request<MemberSavedViewResponse>("/members/views", {
      method: "POST",
      body: json(payload),
      headers: { "Idempotency-Key": idempotency() }
    }),
  updateMemberSavedView: (id: string, payload: UpdateMemberSavedViewRequest) =>
    request<MemberSavedViewResponse>(`/members/views/${id}`, {
      method: "PATCH",
      body: json(payload)
    }),
  deleteMemberSavedView: (id: string) =>
    request<MemberSavedViewResponse>(`/members/views/${id}`, { method: "DELETE" }),
  memberTimeline: (id: string) =>
    request<
      Array<{
        id: string;
        action: string;
        createdAt: string;
        afterSummary: Record<string, unknown> | null;
      }>
    >(`/members/${id}/timeline`),
  leads: (params: URLSearchParams) => request<LeadListResponse>(`/leads?${params.toString()}`),
  lead: (id: string) => request<LeadResponse>(`/leads/${id}`),
  createLead: (payload: CreateLeadRequest) =>
    request<LeadResponse>("/leads", {
      method: "POST",
      body: json(payload),
      headers: { "Idempotency-Key": idempotency() }
    }),
  updateLeadStage: (id: string, payload: UpdateLeadStageRequest) =>
    request<LeadResponse>(`/leads/${id}/stage`, { method: "POST", body: json(payload) }),
  convertLead: (id: string) =>
    request<{ lead: LeadResponse; member: MemberResponse; alreadyConverted: boolean }>(
      `/leads/${id}/convert`,
      { method: "POST", body: json({}) }
    ),
  leadNotes: (id: string) => request<LeadNoteResponse[]>(`/leads/${id}/notes`),
  addLeadNote: (id: string, body: string) =>
    request<LeadNoteResponse>(`/leads/${id}/notes`, {
      method: "POST",
      body: json({ body })
    }),
  leadTasks: (id: string) => request<LeadTaskResponse[]>(`/leads/${id}/tasks`),
  addLeadTask: (id: string, payload: CreateLeadTaskRequest) =>
    request<LeadTaskResponse>(`/leads/${id}/tasks`, {
      method: "POST",
      body: json(payload)
    }),
  completeLeadTask: (leadId: string, taskId: string) =>
    request<LeadTaskResponse>(`/leads/${leadId}/tasks/${taskId}/complete`, { method: "PATCH" }),
  staff: () => request<StaffUserResponse[]>("/users"),
  inviteStaff: (payload: {
    email: string;
    displayName?: string;
    roleId: string;
    branchIds: string[];
  }) =>
    request<StaffUserResponse>("/users/invitations", {
      method: "POST",
      body: json(payload),
      headers: { "Idempotency-Key": idempotency() }
    }),
  staffRoles: () => request<import("@fitos/contracts").RoleResponse[]>("/users/roles"),
  updateStaff: (
    userId: string,
    payload: { roleId: string; roleIds?: string[]; branchIds: string[] }
  ) =>
    request<StaffUserResponse>(`/users/${userId}/access`, { method: "PATCH", body: json(payload) }),
  deactivateStaff: (userId: string) =>
    request<StaffUserResponse>(`/users/${userId}/deactivate`, { method: "POST" }),

  // Services & Rooms
  services: () => request<ServiceResponse[]>("/services"),
  servicesByBranch: (branchId: string) =>
    request<ServiceResponse[]>(`/services?branchId=${encodeURIComponent(branchId)}`),
  service: (id: string) => request<ServiceResponse>(`/services/${id}`),
  createService: (payload: CreateServiceRequest) =>
    request<ServiceResponse>("/services", {
      method: "POST",
      body: json(payload),
      headers: { "Idempotency-Key": idempotency() }
    }),
  updateService: (id: string, payload: UpdateServiceRequest) =>
    request<ServiceResponse>(`/services/${id}`, { method: "PATCH", body: json(payload) }),
  rooms: (branchId?: string) =>
    request<RoomResponse[]>(branchId ? `/rooms?branchId=${branchId}` : "/rooms"),
  room: (id: string) => request<RoomResponse>(`/rooms/${id}`),
  createRoom: (payload: CreateRoomRequest) =>
    request<RoomResponse>("/rooms", {
      method: "POST",
      body: json(payload),
      headers: { "Idempotency-Key": idempotency() }
    }),
  updateRoom: (id: string, payload: UpdateRoomRequest) =>
    request<RoomResponse>(`/rooms/${id}`, { method: "PATCH", body: json(payload) }),

  // Schedule
  scheduleOccurrences: (params?: URLSearchParams) =>
    request<ScheduleOccurrenceListResponse>(
      `/schedule/occurrences${params ? `?${params.toString()}` : ""}`
    ),
  scheduleOccurrence: (id: string) =>
    request<ScheduleOccurrenceResponse>(`/schedule/occurrences/${id}`),
  createScheduleOccurrence: (payload: CreateScheduleOccurrenceRequest) =>
    request<ScheduleOccurrenceResponse>("/schedule/occurrences", {
      method: "POST",
      body: json(payload),
      headers: { "Idempotency-Key": idempotency() }
    }),
  cancelScheduleOccurrence: (id: string, reason: string) =>
    request<ScheduleOccurrenceResponse>(`/schedule/occurrences/${id}/cancel`, {
      method: "POST",
      body: json({ reason })
    }),
  overrideScheduleOccurrence: (id: string, payload: OverrideScheduleOccurrenceRequest) =>
    request<ScheduleOccurrenceResponse>(`/schedule/occurrences/${id}/override`, {
      method: "POST",
      body: json(payload),
      headers: { "Idempotency-Key": idempotency() }
    }),
  scheduleTemplates: (branchId?: string) =>
    request<ScheduleTemplateResponse[]>(
      branchId ? `/schedule/templates?branchId=${branchId}` : "/schedule/templates"
    ),
  createScheduleTemplate: (payload: CreateScheduleTemplateRequest) =>
    request<ScheduleTemplateMutationResponse>("/schedule/templates", {
      method: "POST",
      body: json(payload),
      headers: { "Idempotency-Key": idempotency() }
    }),
  materializeScheduleTemplate: (id: string, throughDate: string) =>
    request<ScheduleTemplateMutationResponse>(`/schedule/templates/${id}/materialize`, {
      method: "POST",
      body: json({ throughDate }),
      headers: { "Idempotency-Key": idempotency() }
    }),

  // Bookings
  bookings: (params?: URLSearchParams) =>
    request<BookingListResponse>(`/bookings${params ? `?${params.toString()}` : ""}`),
  booking: (id: string) => request<BookingResponse>(`/bookings/${id}`),
  createBooking: (payload: CreateBookingRequest) =>
    request<BookingResponse>("/bookings", {
      method: "POST",
      body: json(payload),
      headers: { "Idempotency-Key": idempotency() }
    }),
  cancelBooking: (id: string, reason: string) =>
    request<BookingResponse>(`/bookings/${id}/cancel`, {
      method: "POST",
      body: json({ reason })
    }),
  rescheduleBooking: (id: string, targetOccurrenceId: string) =>
    request<BookingResponse>(`/bookings/${id}/reschedule`, {
      method: "POST",
      body: json({ targetOccurrenceId })
    }),
  promoteWaitlistedBooking: (id: string) =>
    request<BookingResponse>(`/bookings/${id}/promote`, { method: "POST" }),

  // Memberships & Plans
  membershipPlans: (branchId?: string) =>
    request<MembershipPlanResponse[]>(
      branchId ? `/membership-plans?branchId=${branchId}` : "/membership-plans"
    ),
  membershipPlan: (id: string) => request<MembershipPlanResponse>(`/membership-plans/${id}`),
  createMembershipPlan: (payload: CreateMembershipPlanRequest) =>
    request<MembershipPlanResponse>("/membership-plans", {
      method: "POST",
      body: json(payload),
      headers: { "Idempotency-Key": idempotency() }
    }),
  updateMembershipPlan: (
    id: string,
    payload: Partial<CreateMembershipPlanRequest> & { isActive?: boolean }
  ) =>
    request<MembershipPlanResponse>(`/membership-plans/${id}`, {
      method: "PATCH",
      body: json(payload)
    }),
  memberMemberships: (memberId: string) =>
    request<MemberMembershipResponse[]>(`/members/${memberId}/memberships`),
  activateMembership: (memberId: string, payload: { planId: string; startsAt?: string }) =>
    request<{ membership: MemberMembershipResponse; ledgerEntry: CreditLedgerEntryResponse }>(
      `/members/${memberId}/memberships`,
      {
        method: "POST",
        body: json(payload),
        headers: { "Idempotency-Key": idempotency() }
      }
    ),
  cancelMembership: (memberId: string, membershipId: string, reason?: string) =>
    request<MemberMembershipResponse>(`/members/${memberId}/memberships/${membershipId}/cancel`, {
      method: "POST",
      body: json({ reason })
    }),
  holdMembership: (memberId: string, membershipId: string) =>
    request<MemberMembershipResponse>(`/members/${memberId}/memberships/${membershipId}/hold`, {
      method: "POST"
    }),
  resumeMembership: (memberId: string, membershipId: string) =>
    request<MemberMembershipResponse>(`/members/${memberId}/memberships/${membershipId}/resume`, {
      method: "POST"
    }),
  renewMembership: (memberId: string, membershipId: string) =>
    request<{ membership: MemberMembershipResponse; ledgerEntry: CreditLedgerEntryResponse }>(
      `/members/${memberId}/memberships/${membershipId}/renew`,
      { method: "POST" }
    ),
  creditLedger: (memberId: string) =>
    request<CreditLedgerEntryResponse[]>(`/members/${memberId}/credits`),
  creditBalance: (memberId: string) =>
    request<{ balance: number }>(`/members/${memberId}/credits/balance`),
  adjustCredit: (memberId: string, payload: ManualCreditAdjustmentRequest) =>
    request<CreditLedgerEntryResponse>(`/members/${memberId}/credits/adjustments`, {
      method: "POST",
      body: json(payload),
      headers: { "Idempotency-Key": idempotency() }
    }),

  // Payments
  payments: (params?: URLSearchParams) =>
    request<CursorPage<PaymentTransactionResponse>>(
      `/payments${params ? `?${params.toString()}` : ""}`
    ),
  payment: (id: string) => request<PaymentTransactionResponse>(`/payments/${id}`),
  createPayment: (payload: CreatePaymentRequest) =>
    request<PaymentTransactionResponse>("/payments", {
      method: "POST",
      body: json(payload),
      headers: { "Idempotency-Key": idempotency() }
    }),
  voidPayment: (id: string, reason: string) =>
    request<PaymentTransactionResponse>(`/payments/${id}/void`, {
      method: "POST",
      body: json({ reason })
    }),
  reconcilePayment: (id: string, payload: ReconcilePaymentRequest) =>
    request<PaymentTransactionResponse>(`/payments/${id}/reconcile`, {
      method: "POST",
      body: json(payload),
      headers: { "Idempotency-Key": idempotency() }
    }),
  refundPayment: (id: string, reason: string) =>
    request<PaymentTransactionResponse>(`/payments/${id}/refund`, {
      method: "POST",
      body: json({ reason }),
      headers: { "Idempotency-Key": idempotency() }
    }),

  // Attendance
  attendanceRecords: (params?: URLSearchParams) =>
    request<CursorPage<AttendanceRecordResponse>>(
      `/attendance${params ? `?${params.toString()}` : ""}`
    ),
  attendanceRecord: (id: string) => request<AttendanceRecordResponse>(`/attendance/${id}`),
  checkIn: (payload: {
    branchId: string;
    memberId: string;
    occurrenceId?: string | null;
    overrideReason?: string | null;
  }) =>
    request<AttendanceRecordResponse>("/attendance/checkin", {
      method: "POST",
      body: json(payload),
      headers: { "Idempotency-Key": idempotency() }
    }),
  updateAttendanceStatus: (id: string, payload: UpdateRosterStatusRequest) =>
    request<AttendanceRecordResponse>(`/attendance/${id}`, {
      method: "PATCH",
      body: json(payload)
    }),

  // ── Insights ──────────────────────────────────────────────────────────────
  insightsOverview: (branchId?: string) =>
    request<InsightsOverviewResponse>(
      `/insights/overview${branchId ? `?branchId=${branchId}` : ""}`
    ),
  todayOverview: (branchId: string) =>
    request<TodayOverviewResponse>(`/insights/today?branchId=${encodeURIComponent(branchId)}`),
  opsAggregate: (branchId: string) =>
    request<import("@fitos/contracts").OpsAggregateResponse>(
      `/insights/ops/aggregate?branchId=${encodeURIComponent(branchId)}`
    ),
  coachAggregate: (branchId: string) =>
    request<import("@fitos/contracts").CoachAggregateResponse>(
      `/insights/coach/aggregate?branchId=${encodeURIComponent(branchId)}`
    ),

  // ── Automations ───────────────────────────────────────────────────────────
  automations: () => request<AutomationRuleResponse[]>("/automations"),
  automationLogs: () => request<AutomationExecutionLogResponse[]>("/automations/logs"),
  createAutomation: (payload: CreateAutomationRuleRequest) =>
    request<AutomationRuleResponse>("/automations", {
      method: "POST",
      body: json(payload)
    }),
  updateAutomation: (id: string, payload: UpdateAutomationRuleRequest) =>
    request<AutomationRuleResponse>(`/automations/${id}`, {
      method: "PATCH",
      body: json(payload)
    }),
  deleteAutomation: (id: string) =>
    request<{ deleted: boolean }>(`/automations/${id}`, { method: "DELETE" }),
  triggerAutomation: (id: string) =>
    request<AutomationExecutionLogResponse>(`/automations/${id}/trigger`, {
      method: "POST",
      body: json({})
    }),

  // ── Public Tenant (unauthenticated) ───────────────────────────────────────
  publicTenantInfo: (slug: string) => request<PublicTenantInfoResponse>(`/public/${slug}`),
  publicServices: (slug: string) => request<PublicServiceResponse[]>(`/public/${slug}/services`),
  publicCoaches: (slug: string) => request<PublicCoachResponse[]>(`/public/${slug}/coaches`),
  publicSchedule: (slug: string, daysAhead?: number) =>
    request<PublicScheduleOccurrenceResponse[]>(
      `/public/${slug}/schedule${daysAhead ? `?daysAhead=${daysAhead}` : ""}`
    ),
  publicCreateLead: (
    slug: string,
    payload: {
      firstName: string;
      lastName?: string;
      phone?: string;
      email?: string;
      interest?: string;
    }
  ) => request<LeadResponse>(`/public/${slug}/leads`, { method: "POST", body: json(payload) }),
  publicCreateReservation: (slug: string, payload: CreatePublicReservationRequest) =>
    request<PublicReservationResponse>(`/public/${encodeURIComponent(slug)}/reservations`, {
      method: "POST",
      body: json(payload)
    }),

  // ── Member Portal ─────────────────────────────────────────────────────────
  memberLogin: (identifier: string, password: string) =>
    request<{ ok: boolean; memberId: string }>("/member-auth/login", {
      method: "POST",
      body: json({ identifier, password })
    }),
  memberLogout: () => request<{ ok: boolean }>("/member-auth/logout", { method: "POST" }),
  memberMe: () => request<MemberProfileResponse>("/member-auth/me"),
  memberPortalOverview: () => request<MemberPortalOverviewResponse>("/member-auth/overview"),
  memberBook: (occurrenceId: string) =>
    request<BookingResponse>("/member-auth/book", { method: "POST", body: json({ occurrenceId }) }),
  memberCancel: (bookingId: string, reason = "Member self-cancelled") =>
    request<BookingResponse>("/member-auth/cancel", {
      method: "POST",
      body: json({ bookingId, reason })
    }),

  // ── Platform / SaaS Self-Service ─────────────────────────────────────────
  signupTenant: (payload: SaaSTenantSignupRequest) =>
    request<SaaSTenantSignupResponse>("/platform/signup", {
      method: "POST",
      body: json(payload)
    }),
  tenantSubscription: () => request<TenantSubscriptionResponse>("/platform/subscription"),
  tenantUsageQuotas: () => request<UsageQuotaMetricsResponse>("/platform/usage"),
  featureFlags: () => request<FeatureFlagResponse[]>("/platform/feature-flags"),
  platformTenants: () =>
    request<import("@fitos/contracts").PlatformTenantControlRecord[]>("/platform/tenants"),
  platformTenant: (tenantId: string) =>
    request<import("@fitos/contracts").PlatformTenantControlRecord>(
      `/platform/tenants/${tenantId}`
    ),
  platformOverview: () =>
    request<import("@fitos/contracts").PlatformOverview>("/platform/overview"),
  platformFeatures: () =>
    request<import("@fitos/contracts").FeatureDefinition[]>("/platform/features"),
  platformFeatureFlagOverrides: () =>
    request<import("@fitos/contracts").FeatureFlagOverrideResponse[]>(
      "/platform/feature-flag-overrides"
    ),
  createPlatformFeatureFlagOverride: (
    payload: Omit<import("@fitos/contracts").FeatureFlagOverrideResponse, "id" | "createdAt">
  ) =>
    request<import("@fitos/contracts").FeatureFlagOverrideResponse>(
      "/platform/feature-flag-overrides",
      { method: "POST", body: json(payload) }
    ),
  platformPlans: () => request<import("@fitos/contracts").SaaSPlanDefinition[]>("/platform/plans"),
  updatePlatformPlan: (
    key: import("@fitos/contracts").SaaSPlan,
    payload: Omit<import("@fitos/contracts").SaaSPlanDefinition, "key"> & {
      reason: string;
      isActive?: boolean;
    }
  ) =>
    request<import("@fitos/contracts").SaaSPlanDefinition>(`/platform/plans/${key}`, {
      method: "PATCH",
      body: json(payload)
    }),
  platformAudit: () => request<import("@fitos/contracts").AuditEventResponse[]>("/platform/audit"),
  platformAccountExportRequests: () =>
    request<import("@fitos/contracts").AccountExportRequestResponse[]>(
      "/platform/account-export-requests"
    ),
  updatePlatformAccountExportRequest: (
    requestId: string,
    status: import("@fitos/contracts").AccountExportStatus,
    reason: string
  ) =>
    request<import("@fitos/contracts").AccountExportRequestResponse>(
      `/platform/account-export-requests/${requestId}`,
      { method: "PATCH", body: json({ status, reason }) }
    ),
  planChangeRequests: () =>
    request<import("@fitos/contracts").PlanChangeRequestResponse[]>(
      "/users/me/plan-change-requests"
    ),
  requestPlanChange: (requestedPlan: import("@fitos/contracts").SaaSPlan) =>
    request<import("@fitos/contracts").PlanChangeRequestResponse>(
      "/users/me/plan-change-requests",
      {
        method: "POST",
        body: json({ requestedPlan }),
        headers: { "Idempotency-Key": idempotency() }
      }
    ),
  platformPlanChangeRequests: () =>
    request<import("@fitos/contracts").PlanChangeRequestResponse[]>(
      "/platform/plan-change-requests"
    ),
  decidePlatformPlanChangeRequest: (
    requestId: string,
    status: "approved" | "rejected",
    reason: string
  ) =>
    request<import("@fitos/contracts").PlanChangeRequestResponse>(
      `/platform/plan-change-requests/${requestId}`,
      { method: "PATCH", body: json({ status, reason }) }
    ),
  cancellationRequests: () =>
    request<import("@fitos/contracts").AccountCancellationRequestResponse[]>(
      "/users/me/cancellation-requests"
    ),
  requestCancellation: (reason?: string) =>
    request<import("@fitos/contracts").AccountCancellationRequestResponse>(
      "/users/me/cancellation-requests",
      { method: "POST", body: json({ reason }), headers: { "Idempotency-Key": idempotency() } }
    ),
  platformCancellationRequests: () =>
    request<import("@fitos/contracts").AccountCancellationRequestResponse[]>(
      "/platform/cancellation-requests"
    ),
  decidePlatformCancellationRequest: (
    requestId: string,
    status: "reviewing" | "approved" | "rejected",
    reason: string
  ) =>
    request<import("@fitos/contracts").AccountCancellationRequestResponse>(
      `/platform/cancellation-requests/${requestId}`,
      { method: "PATCH", body: json({ status, reason }) }
    ),
  deletionRequests: () =>
    request<import("@fitos/contracts").AccountDeletionRequestResponse[]>(
      "/users/me/deletion-requests"
    ),
  requestDeletion: (reason?: string) =>
    request<import("@fitos/contracts").AccountDeletionRequestResponse>(
      "/users/me/deletion-requests",
      {
        method: "POST",
        body: json({ confirmation: "DELETE WORKSPACE", reason }),
        headers: { "Idempotency-Key": idempotency() }
      }
    ),
  platformDeletionRequests: () =>
    request<import("@fitos/contracts").AccountDeletionRequestResponse[]>(
      "/platform/deletion-requests"
    ),
  platformSupportNotes: (tenantId: string) =>
    request<import("@fitos/contracts").PlatformSupportNoteResponse[]>(
      `/platform/tenants/${tenantId}/support-notes`
    ),
  createPlatformSupportNote: (
    tenantId: string,
    payload: Pick<import("@fitos/contracts").PlatformSupportNoteResponse, "category" | "note">
  ) =>
    request<import("@fitos/contracts").PlatformSupportNoteResponse>(
      `/platform/tenants/${tenantId}/support-notes`,
      { method: "POST", body: json(payload) }
    ),
  platformAccountRecoveryCases: (tenantId: string) =>
    request<import("@fitos/contracts").PlatformAccountRecoveryCaseResponse[]>(
      `/platform/tenants/${tenantId}/recovery-cases`
    ),
  createPlatformAccountRecoveryCase: (
    tenantId: string,
    payload: {
      subject: import("@fitos/contracts").PlatformAccountRecoveryCaseResponse["subject"];
      verificationMetadata: Record<string, unknown>;
      actionType: "verification" | "recovery_step" | "note";
      actionDetail: string;
      revokeSessions: boolean;
      outcome: import("@fitos/contracts").PlatformRecoveryCaseOutcome;
    }
  ) =>
    request<import("@fitos/contracts").PlatformAccountRecoveryCaseResponse>(
      `/platform/tenants/${tenantId}/recovery-cases`,
      { method: "POST", body: json(payload) }
    ),
  platformSystemNotices: () =>
    request<import("@fitos/contracts").PlatformSystemNoticeResponse[]>("/platform/notices"),
  createPlatformSystemNotice: (
    payload: Omit<
      import("@fitos/contracts").PlatformSystemNoticeResponse,
      "id" | "createdAt" | "updatedAt" | "actorUserId"
    >
  ) =>
    request<import("@fitos/contracts").PlatformSystemNoticeResponse>("/platform/notices", {
      method: "POST",
      body: json(payload)
    }),
  decidePlatformDeletionRequest: (
    requestId: string,
    status: "reviewing" | "approved" | "rejected",
    reason: string
  ) =>
    request<import("@fitos/contracts").AccountDeletionRequestResponse>(
      `/platform/deletion-requests/${requestId}`,
      { method: "PATCH", body: json({ status, reason }) }
    ),
  transitionPlatformTenantStatus: (
    tenantId: string,
    status: import("@fitos/contracts").TenantAccountStatus,
    reason: string
  ) =>
    request<import("@fitos/contracts").TenantSubscriptionResponse>(
      `/platform/tenants/${tenantId}/status`,
      { method: "PATCH", body: json({ status, reason }) }
    ),
  updatePlatformTenantCapabilities: (tenantId: string, capabilities: string[], reason: string) =>
    request<import("@fitos/contracts").TenantSubscriptionResponse>(
      `/platform/tenants/${tenantId}/capabilities`,
      { method: "PATCH", body: json({ capabilities, reason }) }
    ),
  saveImplementationInquiryDraft: (payload: ImplementationInquiryDraft) =>
    request<ImplementationInquiryResponse>("/platform/implementation-inquiries/draft", {
      method: "POST",
      body: json(payload)
    }),
  submitImplementationInquiry: (payload: ImplementationInquiryDraft) =>
    request<ImplementationInquiryResponse>("/platform/implementation-inquiries/submit", {
      method: "POST",
      body: json(payload)
    }),
  resumeImplementationInquiry: (id: string, token: string) =>
    request<ImplementationInquiryResponse>(
      `/platform/implementation-inquiries/${id}/resume?token=${encodeURIComponent(token)}`
    ),
  emailInquiryResumeLink: (id: string, email: string) =>
    request<{ ok: boolean; message: string }>(
      `/platform/implementation-inquiries/${id}/email-link`,
      { method: "POST", body: json({ email }) }
    ),
  implementationInquiries: (status?: ImplementationInquiryStatus) =>
    request<ImplementationInquiryResponse[]>(
      `/platform/implementation-inquiries${status ? `?status=${status}` : ""}`
    ),
  implementationInquiry: (id: string) =>
    request<ImplementationInquiryResponse | null>(`/platform/implementation-inquiries/${id}`),
  updateImplementationInquiryStatus: (id: string, status: ImplementationInquiryStatus) =>
    request<ImplementationInquiryResponse | null>(
      `/platform/implementation-inquiries/${id}/status`,
      { method: "PATCH", body: json({ status }) }
    ),
  convertImplementationInquiry: (
    id: string,
    payload: {
      mode: "new" | "existing";
      tenantId?: string | null;
      ownerPassword?: string;
      reason: string;
    }
  ) =>
    request<import("@fitos/contracts").ImplementationInquiryConversionResponse>(
      `/platform/implementation-inquiries/${id}/convert`,
      { method: "POST", body: json(payload) }
    ),
  implementationSeedManifest: (id: string) =>
    request<TenantSeedManifest | null>(`/platform/implementation-inquiries/${id}/seed-manifest`),
  implementationInquiryEvents: (id: string) =>
    request<import("@fitos/contracts").ImplementationInquiryEventResponse[]>(
      `/platform/implementation-inquiries/${id}/events`
    ),
  sitePages: () => request<SitePageResponse[]>("/sites/pages"),
  saveSitePage: (payload: SaveSitePageRequest) =>
    request<SitePageResponse>("/sites/pages", { method: "POST", body: json(payload) }),
  publishSitePage: (id: string) =>
    request<SitePageResponse>(`/sites/pages/${id}/publish`, { method: "POST", body: json({}) }),
  publicSitePage: (tenantSlug: string, pageSlug = "home") =>
    request<SitePageResponse>(
      `/public/${encodeURIComponent(tenantSlug)}/site/${encodeURIComponent(pageSlug)}`
    ),

  // ── Equipment & Resource Scheduling ─────────────────────────────────────
  equipmentAssets: (branchId?: string) =>
    request<EquipmentAssetResponse[]>(
      `/equipment/assets${branchId ? `?branchId=${branchId}` : ""}`
    ),
  equipmentAsset: (assetId: string) =>
    request<EquipmentAssetResponse>(`/equipment/assets/${assetId}`),
  createEquipmentAsset: (payload: CreateEquipmentAssetRequest) =>
    request<EquipmentAssetResponse>("/equipment/assets", {
      method: "POST",
      body: json(payload)
    }),
  updateEquipmentAsset: (assetId: string, payload: UpdateEquipmentAssetRequest) =>
    request<EquipmentAssetResponse>(`/equipment/assets/${assetId}`, {
      method: "PATCH",
      body: json(payload)
    }),
  equipmentPools: (branchId?: string) =>
    request<EquipmentPoolResponse[]>(`/equipment/pools${branchId ? `?branchId=${branchId}` : ""}`),
  createEquipmentPool: (payload: CreateEquipmentPoolRequest) =>
    request<EquipmentPoolResponse>("/equipment/pools", {
      method: "POST",
      body: json(payload)
    }),
  equipmentMaintenance: (assetId?: string) =>
    request<EquipmentMaintenanceRecordResponse[]>(
      `/equipment/maintenance${assetId ? `?assetId=${assetId}` : ""}`
    ),
  createEquipmentMaintenance: (payload: CreateMaintenanceRecordRequest) =>
    request<EquipmentMaintenanceRecordResponse>("/equipment/maintenance", {
      method: "POST",
      body: json(payload)
    }),
  serviceEquipmentRequirements: (serviceId: string) =>
    request<ServiceEquipmentRequirement[]>(`/services/${serviceId}/equipment-requirements`),
  replaceServiceEquipmentRequirements: (
    serviceId: string,
    requirements: ServiceEquipmentRequirement[]
  ) =>
    request<ServiceEquipmentRequirement[]>(`/services/${serviceId}/equipment-requirements`, {
      method: "POST",
      body: json({ requirements })
    }),

  // ── Inventory & Consumables ─────────────────────────────────────────────
  inventoryItems: (branchId?: string) =>
    request<InventoryItemResponse[]>(`/inventory/items${branchId ? `?branchId=${branchId}` : ""}`),
  inventoryItem: (itemId: string) => request<InventoryItemResponse>(`/inventory/items/${itemId}`),
  createInventoryItem: (payload: CreateInventoryItemRequest) =>
    request<InventoryItemResponse>("/inventory/items", {
      method: "POST",
      body: json(payload)
    }),
  updateInventoryItem: (itemId: string, payload: UpdateInventoryItemRequest) =>
    request<InventoryItemResponse>(`/inventory/items/${itemId}`, {
      method: "PATCH",
      body: json(payload)
    }),
  inventoryMovements: (itemId?: string) =>
    request<InventoryMovementResponse[]>(
      `/inventory/movements${itemId ? `?itemId=${itemId}` : ""}`
    ),
  createInventoryMovement: (payload: CreateInventoryMovementRequest) =>
    request<InventoryMovementResponse>("/inventory/movements", {
      method: "POST",
      body: json(payload)
    }),
  purchaseOrders: (branchId?: string) =>
    request<PurchaseOrderResponse[]>(
      `/inventory/purchase-orders${branchId ? `?branchId=${branchId}` : ""}`
    ),
  createPurchaseOrder: (payload: CreatePurchaseOrderRequest) =>
    request<PurchaseOrderResponse>("/inventory/purchase-orders", {
      method: "POST",
      body: json(payload)
    }),
  serviceInventoryBom: (serviceId: string) =>
    request<import("@fitos/contracts").ServiceInventoryRequirement[]>(
      `/inventory/bom/${serviceId}`
    ),
  replaceServiceInventoryBom: (
    serviceId: string,
    requirements: import("@fitos/contracts").ServiceInventoryRequirement[]
  ) =>
    request<import("@fitos/contracts").ServiceInventoryRequirement[]>(
      `/inventory/bom/${serviceId}`,
      { method: "POST", body: json({ requirements }) }
    ),
  consumeInventory: (payload: {
    branchId: string;
    serviceId?: string;
    referenceType: string;
    referenceId: string;
    items: import("@fitos/contracts").ServiceInventoryRequirement[];
  }) =>
    request<import("@fitos/contracts").InventoryConsumptionResponse[]>("/inventory/consume", {
      method: "POST",
      body: json(payload)
    }),
  inventoryLots: (itemId?: string) =>
    request<import("@fitos/contracts").InventoryLotResponse[]>(
      `/inventory/lots${itemId ? `?itemId=${itemId}` : ""}`
    ),
  createInventoryLot: (payload: import("@fitos/contracts").CreateInventoryLotRequest) =>
    request<import("@fitos/contracts").InventoryLotResponse>("/inventory/lots", {
      method: "POST",
      body: json(payload)
    }),
  expiringInventoryLots: (days?: number) =>
    request<import("@fitos/contracts").InventoryLotResponse[]>(
      `/inventory/lots/expiring${days ? `?days=${days}` : ""}`
    ),
  stocktakes: (branchId?: string) =>
    request<import("@fitos/contracts").StocktakeResponse[]>(
      `/inventory/stocktakes${branchId ? `?branchId=${branchId}` : ""}`
    ),
  stocktake: (id: string) =>
    request<import("@fitos/contracts").StocktakeResponse>(`/inventory/stocktakes/${id}`),
  createStocktake: (payload: import("@fitos/contracts").CreateStocktakeRequest) =>
    request<import("@fitos/contracts").StocktakeResponse>("/inventory/stocktakes", {
      method: "POST",
      body: json(payload)
    }),
  recordStocktakeCount: (
    id: string,
    payload: import("@fitos/contracts").RecordStocktakeCountRequest
  ) =>
    request<import("@fitos/contracts").StocktakeResponse>(`/inventory/stocktakes/${id}/count`, {
      method: "POST",
      body: json(payload)
    }),
  completeStocktake: (id: string) =>
    request<import("@fitos/contracts").StocktakeResponse>(`/inventory/stocktakes/${id}/complete`, {
      method: "POST",
      body: json({})
    }),

  // ── FITOS Assess & Performance Profiles ─────────────────────────────────
  assessmentDefinitions: () => request<AssessmentDefinitionResponse[]>("/assessments/definitions"),
  createAssessmentDefinition: (payload: CreateAssessmentDefinitionRequest) =>
    request<AssessmentDefinitionResponse>("/assessments/definitions", {
      method: "POST",
      body: json(payload)
    }),
  assessmentSessions: (memberId?: string, branchId?: string) => {
    const params = new URLSearchParams();
    if (memberId) params.set("memberId", memberId);
    if (branchId) params.set("branchId", branchId);
    const qs = params.toString();
    return request<AssessmentSessionResponse[]>(`/assessments/sessions${qs ? `?${qs}` : ""}`);
  },
  createAssessmentSession: (payload: CreateAssessmentSessionRequest) =>
    request<AssessmentSessionResponse>("/assessments/sessions", {
      method: "POST",
      body: json(payload)
    }),
  importDeviceData: (payload: {
    branchId: string;
    memberId: string;
    deviceVendor: string;
    deviceSerial?: string;
    fileName?: string;
    fileContent: string;
  }) =>
    request<{
      session: AssessmentSessionResponse;
      rawChecksum: string;
      extractedMetricsCount: number;
    }>("/assessments/import-device-data", { method: "POST", body: json(payload) }),
  memberPerformanceProfile: (memberId: string) =>
    request<MemberPerformanceProfileResponse>(`/assessments/members/${memberId}/profile`),

  // ── FITOS Therapy & Recovery ─────────────────────────────────────────────
  therapyModalities: () => request<TherapyModalityResponse[]>("/therapy/modalities"),
  createTherapyModality: (payload: CreateTherapyModalityRequest) =>
    request<TherapyModalityResponse>("/therapy/modalities", {
      method: "POST",
      body: json(payload)
    }),
  therapyProtocols: (modalityCode?: string) =>
    request<TherapyProtocolResponse[]>(
      `/therapy/protocols${modalityCode ? `?modalityCode=${modalityCode}` : ""}`
    ),
  createTherapyProtocol: (payload: CreateTherapyProtocolRequest) =>
    request<TherapyProtocolResponse>("/therapy/protocols", { method: "POST", body: json(payload) }),
  therapySessions: (memberId?: string, branchId?: string) => {
    const params = new URLSearchParams();
    if (memberId) params.set("memberId", memberId);
    if (branchId) params.set("branchId", branchId);
    const qs = params.toString();
    return request<TherapySessionResponse[]>(`/therapy/sessions${qs ? `?${qs}` : ""}`);
  },
  createTherapySession: (payload: CreateTherapySessionRequest) =>
    request<TherapySessionResponse>("/therapy/sessions", { method: "POST", body: json(payload) })
};
