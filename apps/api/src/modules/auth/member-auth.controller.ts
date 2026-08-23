import { Body, Controller, Get, Inject, Post, UnauthorizedException } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { hashSessionToken, ScryptPasswordHasher } from "@fitos/auth";
import { Public } from "../../common/auth/public.decorator.js";
import { FitosRepositoryToken } from "../../ports/tokens.js";
import type { FitosRepository } from "../../ports/fitos-repository.js";
import type { FitosRequest } from "../../common/request-context/request-context.js";
import { Req, Res } from "@nestjs/common";
import type { Response } from "express";
import { RateLimitService } from "../../common/auth/rate-limit.service.js";

const SESSION_COOKIE = "fitos_member_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const loginSchema = z
  .object({
    identifier: z.string().trim().min(1).max(255),
    password: z.string().min(10).max(255)
  })
  .strict();

@ApiTags("member-auth")
@Public()
@Controller("member-auth")
export class MemberAuthController {
  constructor(
    @Inject(FitosRepositoryToken) private readonly repository: FitosRepository,
    @Inject(RateLimitService) private readonly rateLimit: RateLimitService
  ) {}

  @Post("login")
  async login(
    @Body() body: unknown,
    @Req() req: FitosRequest,
    @Res({ passthrough: true }) res: Response
  ) {
    this.rateLimit.consume(`member-login:${req.ip ?? "unknown"}`, 10, 15 * 60 * 1_000);
    const { identifier, password } = loginSchema.parse(body);
    const member = await this.repository.findMemberByIdentifier(identifier);
    if (!member) throw new UnauthorizedException("Invalid credentials.");

    if (!(await this.repository.verifyMemberPassword(member.id, password))) throw new UnauthorizedException("Invalid credentials.");

    const rawToken = crypto.randomUUID();
    const tokenHash = hashSessionToken(rawToken);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    await this.repository.createMemberSession({ memberId: member.id, tokenHash, expiresAt });

    res.cookie(SESSION_COOKIE, rawToken, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: SESSION_TTL_MS
    });

    return { ok: true, memberId: member.id };
  }

  @Post("set-password")
  async setPassword(@Body() body: unknown, @Req() req: FitosRequest) {
    const { currentPassword, password } = z.object({ currentPassword: z.string().min(10).max(255), password: z.string().min(10).max(255) }).strict().parse(body);
    const token = (req.cookies as Record<string, string>)?.[SESSION_COOKIE];
    const profile = token ? await this.repository.resolveMemberSession(hashSessionToken(token), new Date().toISOString()) : null;
    if (!profile || !(await this.repository.verifyMemberPassword(profile.id, currentPassword))) throw new UnauthorizedException("Invalid credentials.");
    await this.repository.setMemberPassword(profile.id, await new ScryptPasswordHasher().hash(password));
    await this.repository.revokeMemberSession(hashSessionToken(token!), new Date().toISOString());
    return { ok: true };
  }

  @Post("logout")
  async logout(@Req() req: FitosRequest, @Res({ passthrough: true }) res: Response) {
    const token = (req.cookies as Record<string, string>)?.[SESSION_COOKIE];
    if (token) {
      const hash = hashSessionToken(token);
      await this.repository.revokeMemberSession(hash, new Date().toISOString());
    }
    res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: "strict", secure: process.env.NODE_ENV === "production" });
    return { ok: true };
  }

  @Get("me")
  async me(@Req() req: FitosRequest) {
    const token = (req.cookies as Record<string, string>)?.[SESSION_COOKIE];
    if (!token) throw new UnauthorizedException("Not logged in.");
    const hash = hashSessionToken(token);
    const profile = await this.repository.resolveMemberSession(hash, new Date().toISOString());
    if (!profile) throw new UnauthorizedException("Session expired.");
    return profile;
  }

  @Get("overview")
  async overview(@Req() req: FitosRequest) {
    const token = (req.cookies as Record<string, string>)?.[SESSION_COOKIE];
    if (!token) throw new UnauthorizedException("Not logged in.");
    const hash = hashSessionToken(token);
    const profile = await this.repository.resolveMemberSession(hash, new Date().toISOString());
    if (!profile) throw new UnauthorizedException("Session expired.");
    const overview = await this.repository.getMemberPortalOverview(profile.id);
    if (!overview) throw new UnauthorizedException("Member not found.");
    return overview;
  }

  @Post("book")
  async book(@Req() req: FitosRequest, @Body() body: unknown) {
    const token = (req.cookies as Record<string, string>)?.[SESSION_COOKIE];
    if (!token) throw new UnauthorizedException("Not logged in.");
    const hash = hashSessionToken(token);
    const profile = await this.repository.resolveMemberSession(hash, new Date().toISOString());
    if (!profile) throw new UnauthorizedException("Session expired.");
    const { occurrenceId } = z.object({ occurrenceId: z.string().uuid() }).parse(body);
    return this.repository.memberSelfBook(profile.id, occurrenceId);
  }

  @Post("cancel")
  async cancel(@Req() req: FitosRequest, @Body() body: unknown) {
    const token = (req.cookies as Record<string, string>)?.[SESSION_COOKIE];
    if (!token) throw new UnauthorizedException("Not logged in.");
    const hash = hashSessionToken(token);
    const profile = await this.repository.resolveMemberSession(hash, new Date().toISOString());
    if (!profile) throw new UnauthorizedException("Session expired.");
    const { bookingId, reason } = z
      .object({ bookingId: z.string().uuid(), reason: z.string().trim().min(1).max(255).default("Member self-cancelled") })
      .parse(body);
    return this.repository.memberSelfCancel(profile.id, bookingId, reason);
  }
}

