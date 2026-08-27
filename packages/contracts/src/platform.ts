export type SaaSPlan = "starter" | "pro" | "business";

export type TenantAccountStatus =
  "trial" | "active" | "grace" | "suspended" | "cancelled" | "archived";

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
  /** Raw session token — also set as httpOnly fitos_session cookie. */
  token: string;
  /** CSRF token pair for the newly created session. */
  csrfToken: string;
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

export type ImplementationInquiryStatus =
  | "draft"
  | "submitted"
  | "qualified"
  | "needs_clarification"
  | "approved"
  | "converted"
  | "archived";
export interface ImplementationInquiryDraft {
  id?: string;
  contactName?: string;
  businessName?: string;
  email?: string;
  phone?: string;
  country?: string;
  businessType?: string;
  payload: Record<string, unknown>;
}
export interface ImplementationInquiryResponse extends ImplementationInquiryDraft {
  id: string;
  status: ImplementationInquiryStatus;
  schemaVersion: number;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Raw resume token — only returned on first save. Store locally to reconstruct the resume URL. */
  resumeToken?: string;
}
export interface TenantSeedManifest {
  schemaVersion: 1;
  sourceInquiryId: string;
  generatedAt: string;
  business: Record<string, unknown>;
  branches: unknown[];
  services: unknown[];
  team: unknown[];
  equipment: unknown[];
  assessments: unknown[];
  therapy: unknown[];
  inventory: unknown[];
  website: Record<string, unknown>;
  customRequirements: unknown[];
}
