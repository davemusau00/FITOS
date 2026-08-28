export const ACCOUNT_EXPORT_STATUSES = ["requested", "processing", "completed", "failed"] as const;
export type AccountExportStatus = (typeof ACCOUNT_EXPORT_STATUSES)[number];

export interface AccountExportRequestResponse {
  id: string;
  tenantId: string;
  requestedByUserId: string;
  status: AccountExportStatus;
  format: "json";
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export const PLAN_CHANGE_REQUEST_STATUSES = ["requested", "approved", "rejected"] as const;
export type PlanChangeRequestStatus = (typeof PLAN_CHANGE_REQUEST_STATUSES)[number];

export interface PlanChangeRequestResponse {
  id: string;
  tenantId: string;
  requestedByUserId: string;
  requestedPlan: import("./platform.js").SaaSPlan;
  status: PlanChangeRequestStatus;
  reason: string | null;
  decidedByUserId: string | null;
  decidedAt: string | null;
  effectiveAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export const ACCOUNT_CANCELLATION_STATUSES = [
  "requested",
  "reviewing",
  "approved",
  "rejected"
] as const;
export type AccountCancellationStatus = (typeof ACCOUNT_CANCELLATION_STATUSES)[number];
export interface AccountCancellationRequestResponse {
  id: string;
  tenantId: string;
  requestedByUserId: string;
  status: AccountCancellationStatus;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AccountDeletionStatus = AccountCancellationStatus;
export interface AccountDeletionRequestResponse {
  id: string;
  tenantId: string;
  requestedByUserId: string;
  status: AccountDeletionStatus;
  confirmation: string;
  reason: string | null;
  createdAt: string;
  updatedAt: string;
}
