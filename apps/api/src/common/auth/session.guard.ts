import { CanActivate, ExecutionContext, Inject, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { hashSessionToken, parseCookieHeader } from "@fitos/auth";
import type { RequestActor } from "@fitos/contracts";
import { DomainError } from "../errors/domain-error.js";
import { FitosRepositoryToken } from "../../ports/tokens.js";
import type { FitosRepository } from "../../ports/fitos-repository.js";
import { IS_PUBLIC_ROUTE } from "./public.decorator.js";
import type { FitosRequest } from "../request-context/request-context.js";

const unsafeMethods = new Set(["POST", "PUT", "PATCH", "DELETE"]);

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(FitosRepositoryToken) private readonly repository: FitosRepository
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass()
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<FitosRequest>();
    const cookies = parseCookieHeader(request.headers.cookie);
    const token = cookies.fitos_session;
    if (!token) throw new DomainError("UNAUTHENTICATED", "Authentication is required.", 401);

    if (unsafeMethods.has(request.method)) {
      const csrfCookie = cookies.fitos_csrf;
      const csrfHeader = request.header("x-csrf-token");
      if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
        throw new DomainError("FORBIDDEN", "The request could not be verified.", 403);
      }
      const origin = request.header("origin");
      const allowedOrigin = process.env.WEB_PUBLIC_URL;
      if (origin && allowedOrigin && origin !== allowedOrigin) {
        throw new DomainError("FORBIDDEN", "The request origin is not allowed.", 403);
      }
    }

    const session = await this.repository.resolveSession(hashSessionToken(token), new Date().toISOString());
    if (!session) throw new DomainError("UNAUTHENTICATED", "Your session has expired.", 401);

    const actor: RequestActor = {
      userId: session.user.id,
      tenantId: session.tenant.id,
      tenantUserId: session.tenantUserId,
      branchIds: session.branchIds,
      permissions: session.permissions,
      roleKey: session.role.key,
      sessionId: session.sessionId
    };
    request.actor = actor;
    request.sessionToken = token;
    request.session = session;
    return true;
  }
}
