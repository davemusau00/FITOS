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
  phone?: string | null;
  displayName: string;
  status: UserStatus;
  lastLoginAt: string | null;
}

export interface NotificationPreferences {
  email: boolean;
  sms: boolean;
  bookingReminders: boolean;
  operationalAlerts: boolean;
  leadFollowUps: boolean;
}

export type UpdateNotificationPreferencesRequest = NotificationPreferences;

export interface RoleResponse {
  id: string;
  key: RoleKey | null;
  name: string;
  permissions: PermissionKey[];
}

export interface StaffUserResponse {
  user: UserSummary;
  role: RoleResponse;
  roles?: RoleResponse[];
  branches: BranchResponse[];
  tenantUserId: string;
}

export interface AuthMeResponse {
  user: UserSummary;
  tenant: TenantSummary;
  branches: BranchResponse[];
  permissions: PermissionKey[];
  /** All tenant role assignments; role remains the primary-role compatibility alias. */
  roles: RoleResponse[];
  selectedBranchId: string | null;
  role: RoleResponse;
  defaultWorkspace: WorkspaceKey;
  availableWorkspaces: WorkspaceKey[];
  onboarding: {
    businessProfile: boolean;
    firstBranch: boolean;
    team: boolean;
    services: boolean;
  };
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

export interface UpdateUserProfileRequest {
  displayName?: string;
  phone?: string | null;
}
export interface SessionSummary {
  id: string;
  createdAt: string;
  lastSeenAt: string | null;
  expiresAt: string;
  userAgentSummary: string | null;
  current: boolean;
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
  roleId?: string;
  roleIds?: string[];
  branchIds: string[];
}
