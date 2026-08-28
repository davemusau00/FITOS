import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  Res
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { z } from "zod";
import { AuthService } from "../../common/auth/auth.service.js";
import { Public } from "../../common/auth/public.decorator.js";
import { RateLimitService } from "../../common/auth/rate-limit.service.js";
import type { FitosRequest } from "../../common/request-context/request-context.js";
import { DomainError } from "../../common/errors/domain-error.js";
import type { WorkspaceKey } from "@fitos/contracts";

const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(512)
});
const workspaceSchema = z.object({
  workspace: z.enum(["command", "ops", "front_desk", "coach", "practice"])
});
const passwordSchema = z
  .object({ currentPassword: z.string().min(1), newPassword: z.string().min(8).max(100) })
  .strict();

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: Number(process.env.SESSION_TTL_SECONDS ?? 28_800) * 1_000
});

@ApiTags("authentication")
@Controller("auth")
export class AuthController {
  constructor(
    @Inject(AuthService) private readonly auth: AuthService,
    @Inject(RateLimitService) private readonly rateLimit: RateLimitService
  ) {}

  @Public()
  @Post("login")
  async login(
    @Req() request: FitosRequest,
    @Res({ passthrough: true }) response: Response
  ): Promise<unknown> {
    const body = loginSchema.parse(request.body);
    this.rateLimit.consume(`login:${request.ip ?? "unknown"}`, 10, 15 * 60 * 1_000);
    const result = await this.auth.login(body, {
      ...(request.ip ? { ipHash: request.ip } : {}),
      ...(request.header("user-agent")
        ? { userAgentSummary: request.header("user-agent")!.slice(0, 255) }
        : {})
    });
    response.cookie("fitos_session", result.sessionToken, cookieOptions());
    response.cookie("fitos_csrf", result.csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: Number(process.env.SESSION_TTL_SECONDS ?? 28_800) * 1_000
    });
    return result.auth;
  }

  @Get("me")
  async me(@Req() request: FitosRequest): Promise<unknown> {
    if (!request.session)
      throw new DomainError("UNAUTHENTICATED", "Your session has expired.", 401);
    return this.auth.me(request.session);
  }

  @Post("logout")
  @HttpCode(204)
  async logout(
    @Req() request: FitosRequest,
    @Res({ passthrough: true }) response: Response
  ): Promise<void> {
    if (request.sessionToken) await this.auth.logout(request.sessionToken);
    response.clearCookie("fitos_session", { path: "/" });
    response.clearCookie("fitos_csrf", { path: "/" });
  }

  @Patch("workspace")
  async setWorkspace(@Req() request: FitosRequest, @Body() body: unknown): Promise<unknown> {
    if (!request.session)
      throw new DomainError("UNAUTHENTICATED", "Your session has expired.", 401);
    const { workspace } = workspaceSchema.parse(body) as { workspace: WorkspaceKey };
    const auth = await this.auth.me(request.session);
    if (!auth.availableWorkspaces.includes(workspace)) {
      throw new DomainError("FORBIDDEN", "That workspace is not assigned to your account.", 403);
    }
    await this.auth.setWorkspace(request.session, workspace);
    return this.auth.me(request.session);
  }

  @Patch("password")
  async changePassword(
    @Req() request: FitosRequest,
    @Body() body: unknown
  ): Promise<{ ok: boolean }> {
    if (!request.session)
      throw new DomainError("UNAUTHENTICATED", "Your session has expired.", 401);
    const input = passwordSchema.parse(body);
    await this.auth.changePassword(request.session, input.currentPassword, input.newPassword);
    return { ok: true };
  }

  @Get("sessions")
  async sessions(@Req() request: FitosRequest) {
    if (!request.session)
      throw new DomainError("UNAUTHENTICATED", "Your session has expired.", 401);
    return this.auth.sessions(request.session);
  }

  @Post("sessions/:sessionId/revoke")
  async revokeSession(@Req() request: FitosRequest, @Param("sessionId") sessionId: string) {
    if (!request.session)
      throw new DomainError("UNAUTHENTICATED", "Your session has expired.", 401);
    await this.auth.revokeSession(request.session, sessionId);
    return { ok: true };
  }
}
