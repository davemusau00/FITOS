import type { PermissionKey, RoleKey } from "./permissions.js";

export interface Money {
  /** A decimal string because JSON numbers cannot safely represent all BIGINT values. */
  amountMinor: string;
  currency: string;
}

export interface RequestActor {
  userId: string;
  tenantId: string;
  tenantUserId: string;
  branchIds: string[];
  permissions: PermissionKey[];
  roleKey: RoleKey | null;
  sessionId: string;
}

export interface CursorPageMeta {
  nextCursor: string | null;
  hasMore: boolean;
}

export interface CursorPage<T> {
  data: T[];
  page: CursorPageMeta;
}

export interface DomainEvent<TPayload = Record<string, unknown>> {
  eventId: string;
  type: string;
  version: number;
  tenantId: string;
  occurredAt: string;
  payload: TPayload;
}

export interface HealthResponse {
  status: "ok" | "degraded";
  requestId: string;
}
