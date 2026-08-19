import type {
  AuthMeResponse,
  BranchResponse,
  CreateBranchRequest,
  CreateMemberRequest,
  CursorPage,
  MemberListItem,
  MemberResponse,
  StaffUserResponse,
  TenantSummary,
  UpdateBranchRequest,
  UpdateMemberRequest,
  UpdateOrganizationRequest
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
  const response = await fetch(`${apiBase}${path}`, { ...init, method, headers, credentials: "include" });
  if (response.status === 204) return undefined as T;
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = payload as { error?: { code?: string; message?: string; fields?: Record<string, string[]>; requestId?: string } } | null;
    throw new ApiClientError(error?.error?.message ?? "The request failed.", response.status, error?.error?.code ?? "UNEXPECTED_ERROR", error?.error?.fields, error?.error?.requestId);
  }
  return payload as T;
}

const json = (payload: unknown) => JSON.stringify(payload);
const idempotency = () => crypto.randomUUID();

export const api = {
  login: (payload: { email: string; password: string }) => request<AuthMeResponse>("/auth/login", { method: "POST", body: json(payload) }),
  logout: () => request<void>("/auth/logout", { method: "POST" }),
  me: () => request<AuthMeResponse>("/auth/me"),
  organization: () => request<TenantSummary>("/organization"),
  updateOrganization: (payload: UpdateOrganizationRequest) => request<TenantSummary>("/organization", { method: "PATCH", body: json(payload) }),
  branches: () => request<BranchResponse[]>("/branches"),
  branch: (id: string) => request<BranchResponse>(`/branches/${id}`),
  createBranch: (payload: CreateBranchRequest) => request<BranchResponse>("/branches", { method: "POST", body: json(payload), headers: { "Idempotency-Key": idempotency() } }),
  updateBranch: (id: string, payload: UpdateBranchRequest) => request<BranchResponse>(`/branches/${id}`, { method: "PATCH", body: json(payload) }),
  members: (params: URLSearchParams) => request<CursorPage<MemberListItem>>(`/members?${params.toString()}`),
  member: (id: string) => request<MemberResponse>(`/members/${id}`),
  createMember: (payload: CreateMemberRequest) => request<MemberResponse>("/members", { method: "POST", body: json(payload), headers: { "Idempotency-Key": idempotency() } }),
  updateMember: (id: string, payload: UpdateMemberRequest) => request<MemberResponse>(`/members/${id}`, { method: "PATCH", body: json(payload) }),
  memberTimeline: (id: string) => request<Array<{ id: string; action: string; createdAt: string; afterSummary: Record<string, unknown> | null }>>(`/members/${id}/timeline`),
  staff: () => request<StaffUserResponse[]>("/users"),
  inviteStaff: (payload: { email: string; displayName?: string; roleId: string; branchIds: string[] }) => request<StaffUserResponse>("/users/invitations", { method: "POST", body: json(payload), headers: { "Idempotency-Key": idempotency() } }),
  updateStaff: (userId: string, payload: { roleId: string; branchIds: string[] }) => request<StaffUserResponse>(`/users/${userId}/access`, { method: "PATCH", body: json(payload) }),
  deactivateStaff: (userId: string) => request<StaffUserResponse>(`/users/${userId}/deactivate`, { method: "POST" })
};
