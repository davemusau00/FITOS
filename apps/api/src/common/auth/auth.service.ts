import { Inject, Injectable } from "@nestjs/common";
import { createCsrfToken, createOpaqueSessionToken, hashSessionToken, ScryptPasswordHasher } from "@fitos/auth";
import type { AuthMeResponse, LoginRequest, RequestActor } from "@fitos/contracts";
import { DomainError } from "../errors/domain-error.js";
import { FitosRepositoryToken } from "../../ports/tokens.js";
import type { FitosRepository, ResolvedSession, TenantScope } from "../../ports/fitos-repository.js";

export interface LoginResult {
  auth: AuthMeResponse;
  sessionToken: string;
  csrfToken: string;
}

@Injectable()
export class AuthService {
  private readonly passwordHasher = new ScryptPasswordHasher();

  constructor(@Inject(FitosRepositoryToken) private readonly repository: FitosRepository) {}

  async login(input: LoginRequest, metadata: { ipHash?: string; userAgentSummary?: string }): Promise<LoginResult> {
    const identity = await this.repository.findLoginIdentity(input.email);
    const verified = identity ? await this.passwordHasher.verify(input.password, identity.passwordHash) : false;
    if (!identity || !verified) {
      throw new DomainError("UNAUTHENTICATED", "Email or password is incorrect.", 401);
    }
    const sessionToken = createOpaqueSessionToken();
    const csrfToken = createCsrfToken(sessionToken);
    const now = new Date();
    const ttlSeconds = Number(process.env.SESSION_TTL_SECONDS ?? 28_800);
    const expiresAt = new Date(now.getTime() + ttlSeconds * 1_000).toISOString();
    await this.repository.createSession({
      userId: identity.user.id,
      tenantUserId: identity.tenantUserId,
      tokenHash: hashSessionToken(sessionToken),
      expiresAt,
      ...(metadata.ipHash ? { ipHash: metadata.ipHash } : {}),
      ...(metadata.userAgentSummary ? { userAgentSummary: metadata.userAgentSummary } : {})
    });
    await this.repository.markUserLoggedIn(identity.user.id, now.toISOString());
    return {
      sessionToken,
      csrfToken,
      auth: {
        user: { ...identity.user, lastLoginAt: now.toISOString() },
        tenant: identity.tenant,
        branches: (await this.repository.listBranches(this.scopeFromIdentity(identity))).filter((branch) => identity.branchIds.includes(branch.id)),
        permissions: identity.role.permissions,
        selectedBranchId: identity.branchIds[0] ?? null
      }
    };
  }

  async me(session: ResolvedSession): Promise<AuthMeResponse> {
    const scope: TenantScope = {
      tenantId: session.tenant.id,
      tenantUserId: session.tenantUserId,
      userId: session.user.id,
      branchIds: session.branchIds
    };
    return {
      user: session.user,
      tenant: session.tenant,
      branches: await this.repository.listBranches(scope),
      permissions: session.permissions,
      selectedBranchId: session.branchIds[0] ?? null
    };
  }

  async logout(sessionToken: string): Promise<void> {
    await this.repository.revokeSession(hashSessionToken(sessionToken), new Date().toISOString());
  }

  static scope(actor: RequestActor): TenantScope {
    return { tenantId: actor.tenantId, tenantUserId: actor.tenantUserId, userId: actor.userId, branchIds: actor.branchIds };
  }

  private scopeFromIdentity(identity: {
    tenant: { id: string };
    tenantUserId: string;
    user: { id: string };
    branchIds: string[];
  }): TenantScope {
    return {
      tenantId: identity.tenant.id,
      tenantUserId: identity.tenantUserId,
      userId: identity.user.id,
      branchIds: identity.branchIds
    };
  }
}
