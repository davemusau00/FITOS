import { Body, Controller, Get, Inject, Post, UnauthorizedException } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { hashSessionToken } from "@fitos/auth";
import { Public } from "../../common/auth/public.decorator.js";
import { FitosRepositoryToken } from "../../ports/tokens.js";
import type { FitosRepository } from "../../ports/fitos-repository.js";
import type { FitosRequest } from "../../common/request-context/request-context.js";
import { Req, Res } from "@nestjs/common";
import type { Response } from "express";

const SESSION_COOKIE = "fitos_member_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const loginSchema = z
  .object({
    identifier: z.string().trim().min(1).max(255),
    pin: z.string().trim().min(4).max(20)
  })
  .strict();

@ApiTags("member-auth")
@Public()
@Controller("member-auth")
export class MemberAuthController {
  constructor(
    @Inject(FitosRepositoryToken) private readonly repository: FitosRepository
  ) {}

  @Post("login")
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) res: Response
  ) {
    const { identifier, pin } = loginSchema.parse(body);
    const member = await this.repository.findMemberByIdentifier(identifier);
    if (!member) throw new UnauthorizedException("Member not found.");

    // Simple PIN check: last 4 digits of phone or "1234" default for dev
    const expectedPin =
      member.contact.phone?.replace(/\D/g, "").slice(-4) ?? "1234";
    if (pin !== expectedPin)
      throw new UnauthorizedException("Incorrect PIN.");

    const rawToken = crypto.randomUUID();
    const tokenHash = hashSessionToken(rawToken);
    const expiresAt = new Date(Date.now() + SESSION_TTL_MS).toISOString();
    await this.repository.createMemberSession({ memberId: member.id, tokenHash, expiresAt });

    res.cookie(SESSION_COOKIE, rawToken, {
      httpOnly: true,
      sameSite: "strict",
      maxAge: SESSION_TTL_MS
    });

    return { ok: true, memberId: member.id };
  }

  @Post("logout")
  async logout(@Req() req: FitosRequest, @Res({ passthrough: true }) res: Response) {
    const token = (req.cookies as Record<string, string>)?.[SESSION_COOKIE];
    if (token) {
      const hash = hashSessionToken(token);
      await this.repository.revokeMemberSession(hash, new Date().toISOString());
    }
    res.clearCookie(SESSION_COOKIE);
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
}
