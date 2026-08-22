export type SaaSPlan = "starter" | "pro" | "business";

export type TenantAccountStatus = "trial" | "active" | "grace" | "suspended" | "cancelled" | "archived";

export type SaaSCapabilityKey =
  | "feature.crm"
  | "feature.automations"
  | "feature.insights"
  | "feature.portal"
  | "feature.assessments"
  | "feature.therapy"
  | "feature.inventory"
  | "feature.equipment"
  | "feature.sites"
  | "feature.integrations";

export interface SaaSTenantSignupRequest {
  gymName: string;
  slug: string;
  businessType: string;
  country: string;
  timezone: string;
  currency: string;
  branchName: string;
  branchAddress?: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone?: string;
  password: string;
}

export interface SaaSTenantSignupResponse {
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  branchId: string;
  ownerUserId: string;
  ownerEmail: string;
  token: string;
  trialEndsAt: string;
}

export interface TenantSubscriptionResponse {
  tenantId: string;
  plan: SaaSPlan;
  planName: string;
  status: TenantAccountStatus;
  trialEndsAt: string | null;
  currentPeriodEndsAt: string | null;
  capabilities: SaaSCapabilityKey[];
}

export interface UsageQuotaMetricsResponse {
  activeMembers: number;
  maxMembers: number;
  activeStaff: number;
  maxStaff: number;
  branches: number;
  maxBranches: number;
  automationRunsThisMonth: number;
  maxAutomationRuns: number;
  storageUsedMb: number;
  maxStorageMb: number;
}

export interface FeatureFlagResponse {
  key: string;
  enabled: boolean;
  name: string;
  description: string;
  category: "core" | "advanced" | "beta";
}
