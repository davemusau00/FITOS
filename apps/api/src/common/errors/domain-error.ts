import type { ApiErrorCode } from "@fitos/contracts";

export class DomainError extends Error {
  constructor(
    readonly code: ApiErrorCode,
    message: string,
    readonly status: number,
    readonly fields?: Record<string, string[]>,
    readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export const validationError = (fields: Record<string, string[]>): DomainError =>
  new DomainError("VALIDATION_FAILED", "Some fields are invalid.", 400, fields);
