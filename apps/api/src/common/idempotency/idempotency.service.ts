import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { RequestActor } from "@fitos/contracts";
import { DomainError } from "../errors/domain-error.js";
import { FitosRepositoryToken } from "../../ports/tokens.js";
import type { FitosRepository } from "../../ports/fitos-repository.js";

@Injectable()
export class IdempotencyService {
  constructor(@Inject(FitosRepositoryToken) private readonly repository: FitosRepository) {}

  async execute<T>(input: {
    actor: RequestActor;
    operation: string;
    key?: string;
    body: unknown;
    status: number;
    action: () => Promise<T>;
  }): Promise<T> {
    if (!input.key) return input.action();
    if (input.key.length > 160)
      throw new DomainError("VALIDATION_FAILED", "Idempotency-Key is too long.", 400);
    const fingerprint = createHash("sha256").update(JSON.stringify(input.body)).digest("hex");
    const acquisition = await this.repository.acquireIdempotency({
      tenantId: input.actor.tenantId,
      operation: input.operation,
      key: input.key,
      fingerprint,
      status: "in_progress",
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString()
    });
    if (acquisition.kind === "replay") return acquisition.responseBody as T;
    if (acquisition.kind === "in_progress")
      throw new DomainError(
        "IDEMPOTENCY_IN_PROGRESS",
        "This request is already being processed.",
        409
      );
    if (acquisition.kind === "key_reused")
      throw new DomainError(
        "IDEMPOTENCY_KEY_REUSED",
        "This idempotency key was used for a different request.",
        409
      );
    try {
      const result = await input.action();
      await this.repository.completeIdempotency({
        tenantId: input.actor.tenantId,
        operation: input.operation,
        key: input.key,
        responseStatus: input.status,
        responseBody: result
      });
      return result;
    } catch (error) {
      await this.repository.abandonIdempotency({
        tenantId: input.actor.tenantId,
        operation: input.operation,
        key: input.key
      });
      throw error;
    }
  }
}
