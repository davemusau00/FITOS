import type {
  AuthMeResponse,
  BranchResponse,
  CreateBranchRequest,
  CreateMemberRequest,
  CreateLeadRequest,
  CursorPage,
  MemberListItem,
  MemberResponse,
  LeadListResponse,
  LeadResponse,
  UpdateLeadStageRequest,
  StaffUserResponse,
  TenantSummary,
  UpdateBranchRequest,
  UpdateMemberRequest,
  UpdateOrganizationRequest,
  ServiceResponse,
  CreateServiceRequest,
  UpdateServiceRequest,
  RoomResponse,
  CreateRoomRequest,
  ScheduleOccurrenceResponse,
  CreateScheduleOccurrenceRequest,
  ScheduleOccurrenceListResponse,
  BookingResponse,
  CreateBookingRequest,
  BookingListResponse,
  MembershipPlanResponse,
  CreateMembershipPlanRequest,
  MemberMembershipResponse,
  ActivateMembershipRequest,
  CreditLedgerEntryResponse,
  PaymentTransactionResponse,
  CreatePaymentRequest,
  AttendanceRecordResponse,
  UpdateRosterStatusRequest
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
  login: (payload: { email: string; password: string }) =>
    request<AuthMeResponse>("/auth/login", { method: "POST", body: json(payload) }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  me: () => request<AuthMeResponse>("/auth/me"),
  organization: () => request<TenantSummary>("/organization"),
  updateOrganization: (payload: UpdateOrganizationRequest) =>
    request<TenantSummary>("/organization", { method: "PATCH", body: json(payload) }),
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
  updateStaff: (userId: string, payload: { roleId: string; branchIds: string[] }) =>
    request<StaffUserResponse>(`/users/${userId}/access`, { method: "PATCH", body: json(payload) }),
  deactivateStaff: (userId: string) =>
    request<StaffUserResponse>(`/users/${userId}/deactivate`, { method: "POST" }),

  // Services & Rooms
  services: () => request<ServiceResponse[]>("/services"),
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
  createRoom: (payload: CreateRoomRequest) =>
    request<RoomResponse>("/rooms", {
      method: "POST",
      body: json(payload),
      headers: { "Idempotency-Key": idempotency() }
    }),

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
  creditLedger: (memberId: string) =>
    request<CreditLedgerEntryResponse[]>(`/members/${memberId}/credits`),
  creditBalance: (memberId: string) =>
    request<{ balance: number }>(`/members/${memberId}/credits/balance`),

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
  voidPayment: (id: string, reason?: string) =>
    request<PaymentTransactionResponse>(`/payments/${id}/void`, {
      method: "POST",
      body: json({ reason })
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
    })
};
