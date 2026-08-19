export interface AuditEventResponse {
  id: string;
  tenantId: string;
  branchId: string | null;
  actorUserId: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  beforeSummary: Record<string, unknown> | null;
  afterSummary: Record<string, unknown> | null;
  requestId: string;
  createdAt: string;
}

export interface AuditRecordInput {
  tenantId: string;
  branchId?: string | null;
  actorUserId?: string | null;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  beforeSummary?: Record<string, unknown> | null;
  afterSummary?: Record<string, unknown> | null;
  requestId: string;
}
