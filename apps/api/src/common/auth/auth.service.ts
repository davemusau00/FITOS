import { Inject, Injectable } from "@nestjs/common";
import {
  createCsrfToken,
  createOpaqueSessionToken,
  hashSessionToken,
  ScryptPasswordHasher
} from "@fitos/auth";
import type {
  AuthMeResponse,
  LoginRequest,
  RequestActor,
  RoleResponse,
  WorkspaceKey
} from "@fitos/contracts";
import { DomainError } from "../errors/domain-error.js";
import { FitosRepositoryToken } from "../../ports/tokens.js";
import type {
  FitosRepository,
  ResolvedSession,
  TenantScope
} from "../../ports/fitos-repository.js";

export interface LoginResult {
  auth: AuthMeResponse;
  sessionToken: string;
  csrfToken: string;
}

@Injectable()
export class AuthService {
  private readonly passwordHasher = new ScryptPasswordHasher();

  constructor(@Inject(FitosRepositoryToken) private readonly repository: FitosRepository) {}

  async login(
    input: LoginRequest,
    metadata: { ipHash?: string; userAgentSummary?: string }
  ): Promise<LoginResult> {
    const identity = await this.repository.findLoginIdentity(input.email);
    const verified = identity
      ? await this.passwordHasher.verify(input.password, identity.passwordHash)
      : false;
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
    const identityScope = this.scopeFromIdentity(identity);
    const [identityBranches, identityStaff, identityServices] = await Promise.all([
      this.repository.listBranches(identityScope),
      this.repository.listStaff(identityScope),
      this.repository.listServices(identityScope)
    ]);
    return {
      sessionToken,
      csrfToken,
      auth: {
        user: { ...identity.user, lastLoginAt: now.toISOString() },
        tenant: identity.tenant,
        branches: identityBranches.filter((branch) => identity.branchIds.includes(branch.id)),
        permissions: this.mergePermissions(identity.roles ?? [identity.role]),
        roles: identity.roles ?? [identity.role],
        selectedBranchId: identity.branchIds[0] ?? null,
        role: identity.role,
        ...(await this.workspaceForRoles(
          identity.roles ?? [identity.role],
          await this.repository.getWorkspacePreference(identity.user.id, identity.tenant.id)
        )),
        onboarding: {
          businessProfile: Boolean(
            identity.tenant.name && identity.tenant.timezone && identity.tenant.currency
          ),
          firstBranch: identityBranches.length > 0,
          team: identityStaff.length > 1,
          services: identityServices.length > 0
        }
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
    const [branches, staff, services] = await Promise.all([
      this.repository.listBranches(scope),
      this.repository.listStaff(scope),
      this.repository.listServices(scope)
    ]);
    return {
      user: session.user,
      tenant: session.tenant,
      branches,
      permissions: session.permissions,
      roles: session.roles ?? [session.role],
      selectedBranchId: session.branchIds[0] ?? null,
      role: session.role,
      ...(await this.workspaceForRoles(
        session.roles ?? [session.role],
        await this.repository.getWorkspacePreference(session.user.id, session.tenant.id)
      )),
      onboarding: {
        businessProfile: Boolean(
          session.tenant.name && session.tenant.timezone && session.tenant.currency
        ),
        firstBranch: branches.length > 0,
        team: staff.length > 1,
        services: services.length > 0
      }
    };
  }

  async logout(sessionToken: string): Promise<void> {
    await this.repository.revokeSession(hashSessionToken(sessionToken), new Date().toISOString());
  }

  async setWorkspace(session: ResolvedSession, workspace: WorkspaceKey): Promise<void> {
    await this.repository.setWorkspacePreference(session.user.id, session.tenant.id, workspace);
  }

  static scope(actor: RequestActor): TenantScope {
    return {
      tenantId: actor.tenantId,
      tenantUserId: actor.tenantUserId,
      userId: actor.userId,
      branchIds: actor.branchIds
    };
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

  private mergePermissions(roles: RoleResponse[]): AuthMeResponse["permissions"] {
    return [...new Set(roles.flatMap((role) => role.permissions))];
  }

  private async workspaceForRoles(
    roles: RoleResponse[],
    preferredWorkspace: WorkspaceKey | null
  ): Promise<{
    defaultWorkspace: WorkspaceKey;
    availableWorkspaces: WorkspaceKey[];
  }> {
    const workspaces = new Set<WorkspaceKey>();
    for (const role of roles) {
      const roleWorkspaces: WorkspaceKey[] =
        role.key === "owner"
          ? ["command", "ops", "front_desk", "coach", "practice"]
          : role.key === "manager"
            ? ["ops", "front_desk"]
            : role.key === "reception"
              ? ["front_desk"]
              : role.key === "trainer"
                ? ["coach"]
                : ["practice"];
      roleWorkspaces.forEach((workspace) => workspaces.add(workspace));
    }
    const availableWorkspaces = [...workspaces];
    const defaultWorkspace =
      preferredWorkspace && availableWorkspaces.includes(preferredWorkspace)
        ? preferredWorkspace
        : availableWorkspaces[0]!;
    return { defaultWorkspace, availableWorkspaces };
  }
}
