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
  createdAt: string;
  updatedAt: string;
}
