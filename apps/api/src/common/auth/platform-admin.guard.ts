import type { CanActivate, ExecutionContext } from "@nestjs/common";
import { Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { createHash } from "node:crypto";
import { REQUIRE_PLATFORM_ADMIN } from "./require-platform-admin.decorator.js";
import { DomainError } from "../errors/domain-error.js";
import { FitosRepositoryToken } from "../../ports/tokens.js";
import type { FitosRepository } from "../../ports/fitos-repository.js";
import type { FitosRequest } from "../request-context/request-context.js";

/**
 * Guards endpoints decorated with @RequirePlatformAdmin().
 *
 * Authentication flow:
 *  1. Route must carry @RequirePlatformAdmin() metadata.
 *  2. Request must supply `X-Platform-Token: <raw-token>` header.
 *  3. Token is SHA-256 hashed and compared against the session table OR directly
 *     verified against a user whose `is_platform_admin = true`.
 *
 * Option B implementation: uses the existing `users` table with
 * `is_platform_admin = true`. The raw token is treated as the user's
 * password-equivalent credential — validated by the repository.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(FitosRepositoryToken) private readonly repository: FitosRepository
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean>(REQUIRE_PLATFORM_ADMIN, [
      context.getHandler(),
      context.getClass()
    ]);
    if (!required) return true;

    const request = context.switchToHttp().getRequest<FitosRequest>();
    const rawToken = request.header("x-platform-token");
    if (!rawToken) {
      throw new DomainError(
        "UNAUTHENTICATED",
        "Platform authentication is required. Supply X-Platform-Token.",
        401
      );
    }

    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const platformUser = await this.repository.resolvePlatformAdminByTokenHash(tokenHash);
    if (!platformUser) {
      throw new DomainError("FORBIDDEN", "Invalid or expired platform token.", 403);
    }

    // Attach to request for audit / logging use
    (request as unknown as Record<string, unknown>).platformActor = { userId: platformUser.userId };
    return true;
  }
}
