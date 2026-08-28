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
