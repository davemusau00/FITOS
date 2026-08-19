/**
 * Stable error codes are part of the public FITOS API contract. New codes may
 * be added, but existing codes must not be repurposed without an API version.
 */
export const API_ERROR_CODES = [
  "VALIDATION_FAILED",
  "UNAUTHENTICATED",
  "FORBIDDEN",
  "RESOURCE_NOT_FOUND",
  "RATE_LIMITED",
  "TENANT_ACCESS_DENIED",
  "BRANCH_ACCESS_DENIED",
  "MEMBER_NOT_FOUND",
  "MEMBER_INACTIVE",
  "BOOKING_CAPACITY_EXCEEDED",
  "BOOKING_WINDOW_CLOSED",
  "BOOKING_INVALID_STATE",
  "MEMBERSHIP_NOT_ELIGIBLE",
  "CREDIT_INSUFFICIENT",
  "PAYMENT_NOT_FOUND",
  "PAYMENT_ALREADY_PROCESSED",
  "PAYMENT_AMOUNT_MISMATCH",
  "PAYMENT_PROVIDER_UNAVAILABLE",
  "REFUND_NOT_ALLOWED",
  "IDEMPOTENCY_KEY_REUSED",
  "IDEMPOTENCY_IN_PROGRESS",
  "FINAL_ACTIVE_OWNER_REQUIRED",
  "INTEGRATION_UNAVAILABLE",
  "UNEXPECTED_ERROR"
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number] | (string & {});

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  requestId: string;
  fields?: Record<string, string[]>;
  details?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  error: ApiErrorBody;
}
