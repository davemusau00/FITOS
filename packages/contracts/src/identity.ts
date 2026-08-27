import type { PermissionKey, RoleKey } from "./permissions.js";

export type TenantStatus = "active" | "suspended" | "archived";
export type UserStatus = "active" | "invited" | "deactivated";

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  status: TenantStatus;
}

export interface BranchResponse {
  id: string;
  name: string;
  slug: string;
  timezone: string | null;
  phone: string | null;
  email: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  countryCode: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserSummary {
  id: string;
  email: string | null;
  displayName: string;
  status: UserStatus;
  lastLoginAt: string | null;
}

export interface RoleResponse {
  id: string;
  key: RoleKey | null;
  name: string;
  permissions: PermissionKey[];
}

export interface StaffUserResponse {
  user: UserSummary;
  role: RoleResponse;
  branches: BranchResponse[];
  tenantUserId: string;
}

export interface AuthMeResponse {
  user: UserSummary;
  tenant: TenantSummary;
  branches: BranchResponse[];
  permissions: PermissionKey[];
  selectedBranchId: string | null;
  role: RoleResponse;
  defaultWorkspace: WorkspaceKey;
  availableWorkspaces: WorkspaceKey[];
}

export const WORKSPACE_KEYS = [
  "command",
  "ops",
  "front_desk",
  "coach",
  "practice",
  "member",
  "platform"
] as const;
export type WorkspaceKey = (typeof WORKSPACE_KEYS)[number];

export interface LoginRequest {
  email: string;
  password: string;
}

export interface UpdateOrganizationRequest {
  name?: string;
  timezone?: string;
  currency?: string;
}

export interface CreateBranchRequest {
  name: string;
  slug?: string;
  timezone?: string | null;
  phone?: string | null;
  email?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  countryCode?: string | null;
}

export interface UpdateBranchRequest extends Partial<CreateBranchRequest> {
  isActive?: boolean;
}

export interface InviteStaffRequest {
  email: string;
  displayName?: string;
  roleId: string;
  branchIds: string[];
}

export interface UpdateStaffAccessRequest {
  roleId: string;
  branchIds: string[];
}
