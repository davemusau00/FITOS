import type { TenantSummary } from "./identity.js";

export type SaaSPlan = "starter" | "pro" | "business";

export interface SaaSPlanQuotas {
  maxMembers: number;
  maxStaff: number;
  maxBranches: number;
  maxAutomationRuns: number;
  maxStorageMb: number;
}

export interface SaaSPlanDefinition {
  key: SaaSPlan;
  name: string;
  description: string;
  quotas: SaaSPlanQuotas;
  capabilities: SaaSCapabilityKey[];
  isActive?: boolean;
}

/** Product limits used by both adapters; usage itself is always measured from records. */
export const SaaS_PLAN_QUOTAS: Record<SaaSPlan, SaaSPlanQuotas> = {
  starter: {
    maxMembers: 500,
    maxStaff: 20,
    maxBranches: 5,
    maxAutomationRuns: 5000,
    maxStorageMb: 2048
  },
  pro: {
    maxMembers: 2000,
    maxStaff: 75,
    maxBranches: 15,
    maxAutomationRuns: 25000,
    maxStorageMb: 10240
  },
  business: {
    maxMembers: 10000,
    maxStaff: 250,
    maxBranches: 50,
    maxAutomationRuns: 100000,
    maxStorageMb: 51200
  }
};

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
  /** Null until storage is measured from an authoritative provider. */
  storageUsedMb: number | null;
  maxStorageMb: number;
}

/** Safe platform control-plane projection; intentionally excludes member/customer records. */
export interface PlatformTenantControlRecord {
  tenant: TenantSummary;
  subscription: TenantSubscriptionResponse;
  usage: UsageQuotaMetricsResponse;
}

export type PlatformHealthState = "ok" | "degraded" | "unknown";
export interface PlatformOverview {
  tenants: {
    total: number;
    active: number;
    trial: number;
    onboarding: number;
    suspended: number;
    cancelled: number;
    archived: number;
  };
  activity: {
    activeMembers: number;
    automationRunsToday: number | null;
    bookingsToday: number | null;
    sessionsToday: number | null;
  };
  implementation: Record<ImplementationInquiryStatus, number>;
  health: {
    api: PlatformHealthState;
    database: PlatformHealthState;
    redis: PlatformHealthState;
    workers: PlatformHealthState;
    queues: PlatformHealthState;
  };
  attention: Array<{
    key: string;
    severity: "info" | "warning" | "critical";
    label: string;
    count: number;
  }>;
}

export interface FeatureFlagResponse {
  key: string;
  enabled: boolean;
  name: string;
  description: string;
  category: "core" | "advanced" | "beta";
}

export type FeatureFlagScope = "global" | "plan" | "tenant" | "pilot";
export interface FeatureFlagOverrideResponse {
  id: string;
  key: SaaSCapabilityKey;
  scope: FeatureFlagScope;
  scopeValue: string | null;
  enabled: boolean;
  reason: string;
  actorUserId: string | null;
  previousEnabled: boolean | null;
  effectiveFrom: string | null;
  effectiveUntil: string | null;
  createdAt: string;
}

export interface PlatformSupportNoteResponse {
  id: string;
  tenantId: string;
  authorUserId: string | null;
  category: "implementation" | "support" | "account" | "risk";
  note: string;
  createdAt: string;
}

export type PlatformRecoveryCaseOutcome = "pending" | "resolved" | "denied";
export type PlatformRecoveryActionType =
  "verification" | "session_revocation" | "recovery_step" | "note";

export interface PlatformRecoveryAction {
  type: PlatformRecoveryActionType;
  detail: string;
  at: string;
}

export interface PlatformAccountRecoveryCaseResponse {
  id: string;
  tenantId: string;
  subject: {
    userId?: string | null;
    email?: string | null;
    phone?: string | null;
    displayName?: string | null;
  };
  verificationMetadata: Record<string, unknown>;
  actions: PlatformRecoveryAction[];
  sessionRevocation: {
    requested: boolean;
    revokedCount: number;
    completedAt: string | null;
  };
  outcome: PlatformRecoveryCaseOutcome;
  actorUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export type PlatformNoticeScope = "global" | "plan" | "tenant";

export interface PlatformSystemNoticeResponse {
  id: string;
  scope: PlatformNoticeScope;
  scopeValue: string | null;
  title: string;
  body: string;
  startsAt: string;
  expiresAt: string | null;
  requiresAcknowledgement: boolean;
  actorUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SystemNoticeViewResponse extends PlatformSystemNoticeResponse {
  acknowledgedAt: string | null;
}

export type FeatureMaturity = "stable" | "beta" | "internal";
export interface FeatureDefinition {
  key: SaaSCapabilityKey;
  name: string;
  maturity: FeatureMaturity;
  defaultEnabled: boolean;
}

export const PLATFORM_FEATURE_REGISTRY: readonly FeatureDefinition[] = [
  { key: "feature.crm", name: "CRM", maturity: "stable", defaultEnabled: true },
  { key: "feature.insights", name: "Insights", maturity: "stable", defaultEnabled: true },
  { key: "feature.portal", name: "Member Portal", maturity: "stable", defaultEnabled: true },
  { key: "feature.automations", name: "Automations", maturity: "beta", defaultEnabled: false },
  { key: "feature.assessments", name: "Assessments", maturity: "beta", defaultEnabled: false },
  { key: "feature.therapy", name: "Therapy", maturity: "beta", defaultEnabled: false },
  { key: "feature.inventory", name: "Inventory", maturity: "beta", defaultEnabled: false },
  { key: "feature.equipment", name: "Equipment", maturity: "beta", defaultEnabled: false },
  { key: "feature.sites", name: "FITOS Sites", maturity: "beta", defaultEnabled: false },
  { key: "feature.integrations", name: "Integrations", maturity: "beta", defaultEnabled: false }
];

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
