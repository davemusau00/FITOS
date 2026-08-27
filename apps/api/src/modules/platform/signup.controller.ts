import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { Response } from "express";
import { z } from "zod";
import type {
  ImplementationInquiryStatus,
  RequestActor,
  SaaSTenantSignupRequest
} from "@fitos/contracts";
import { createHash } from "node:crypto";
import { ScryptPasswordHasher, createOpaqueSessionToken } from "@fitos/auth";
import { Public } from "../../common/auth/public.decorator.js";
import { AuthMode } from "../../common/auth/auth-mode.decorator.js";
import { Actor } from "../../common/request-context/actor.decorator.js";
import { FitosRepositoryToken } from "../../ports/tokens.js";
import type { FitosRepository } from "../../ports/fitos-repository.js";
import { RequirePlatformAdmin } from "../../common/auth/require-platform-admin.decorator.js";
import type { FitosRequest } from "../../common/request-context/request-context.js";

const signupSchema = z
  .object({
    gymName: z.string().trim().min(2).max(100),
    slug: z.string().trim().min(2).max(100),
    businessType: z.string().trim().min(1).max(50).default("gym"),
    country: z.string().trim().min(1).max(50).default("Kenya"),
    timezone: z.string().trim().min(1).max(50).default("Africa/Nairobi"),
    currency: z.string().trim().min(3).max(3).default("KES"),
    branchName: z.string().trim().min(1).max(100).default("Main Branch"),
    branchAddress: z.string().trim().max(200).optional(),
    ownerName: z.string().trim().min(2).max(100),
    ownerEmail: z.string().trim().email(),
    ownerPhone: z.string().trim().max(30).optional(),
    password: z.string().min(8).max(100)
  })
  .strict();

const inquirySchema = z
  .object({
    id: z.string().uuid().optional(),
    contactName: z.string().trim().max(160).optional(),
    businessName: z.string().trim().max(160).optional(),
    email: z.string().trim().email().max(255).optional(),
    phone: z.string().trim().max(60).optional(),
    country: z.string().trim().max(80).optional(),
    businessType: z.string().trim().max(80).optional(),
    payload: z.record(z.unknown())
  })
  .strict();

const platformLoginSchema = z
  .object({
    email: z.string().trim().email(),
    password: z.string().min(1)
  })
  .strict();

const hasher = new ScryptPasswordHasher();

const cookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: Number(process.env.SESSION_TTL_SECONDS ?? 28_800) * 1_000
});

@ApiTags("platform")
@Controller("platform")
export class PlatformController {
  constructor(@Inject(FitosRepositoryToken) private readonly repository: FitosRepository) {}

  @Public()
  @Post("signup")
  async signup(@Body() body: unknown, @Res({ passthrough: true }) response: Response) {
    const input = signupSchema.parse(body) as SaaSTenantSignupRequest;
    const passwordHash = await hasher.hash(input.password);
    const result = await this.repository.signupTenant(input, passwordHash);

    if (result.token) {
      response.cookie("fitos_session", result.token, cookieOptions());
      if (result.csrfToken) {
        response.cookie("fitos_csrf", result.csrfToken, {
          httpOnly: false,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          path: "/",
          maxAge: Number(process.env.SESSION_TTL_SECONDS ?? 28_800) * 1_000
        });
      }
    }

    return result;
  }

  @Public()
  @AuthMode("public")
  @Post("auth/login")
  async platformAdminLogin(@Body() body: unknown) {
    const { email, password } = platformLoginSchema.parse(body);
    const identity = await this.repository.findLoginIdentity(email);
    if (!identity) throw new UnauthorizedException("Invalid credentials.");
    const verified = await hasher.verify(password, identity.passwordHash);
    if (!verified) throw new UnauthorizedException("Invalid credentials.");

    const platformUser = await this.repository.findUserById(identity.user.id);
    if (!platformUser || !platformUser.isPlatformAdmin) {
      throw new UnauthorizedException("Access denied: Not a platform administrator.");
    }

    // Generate a platform bearer token
    const rawToken = createOpaqueSessionToken();
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(
      Date.now() + Number(process.env.PLATFORM_TOKEN_TTL_SECONDS ?? 28_800) * 1_000
    ).toISOString();
    await this.repository.createPlatformAdminToken({
      userId: platformUser.id,
      tokenHash,
      expiresAt
    });
    return {
      token: rawToken,
      expiresAt,
      user: {
        id: platformUser.id,
        displayName: platformUser.displayName,
        email: platformUser.email
      }
    };
  }

  @Post("auth/logout")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  async platformAdminLogout(@Req() request: FitosRequest) {
    const rawToken = request.header("x-platform-token");
    if (rawToken)
      await this.repository.revokePlatformAdminToken(
        createHash("sha256").update(rawToken).digest("hex"),
        new Date().toISOString()
      );
    return { ok: true };
  }

  @Post("auth/revoke-all")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  async revokeAllPlatformTokens(@Req() request: FitosRequest) {
    if (request.platformActor)
      await this.repository.revokeAllPlatformAdminTokens(
        request.platformActor.userId,
        new Date().toISOString()
      );
    return { ok: true };
  }

  @Get("auth/me")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  platformAdminMe(@Req() request: FitosRequest) {
    return request.platformActor;
  }

  @Public()
  @Post("implementation-inquiries/draft")
  saveInquiryDraft(@Body() body: unknown) {
    return this.repository.saveImplementationInquiry(inquirySchema.parse(body), false);
  }

  @Public()
  @Post("implementation-inquiries/submit")
  submitInquiry(@Body() body: unknown) {
    const input = inquirySchema
      .extend({
        contactName: z.string().trim().min(2).max(160),
        businessName: z.string().trim().min(2).max(160),
        email: z.string().trim().email().max(255)
      })
      .parse(body);
    return this.repository.saveImplementationInquiry(input, true);
  }

  @Public()
  @Get("implementation-inquiries/:id/resume")
  async resumeInquiry(@Param("id") id: string, @Query("token") token: string) {
    if (!token) throw new UnauthorizedException("Resume token is required.");
    const inquiry = await this.repository.getImplementationInquiryByToken(id, token);
    if (!inquiry) throw new NotFoundException("Draft inquiry not found or resume token expired.");
    return inquiry;
  }

  @Public()
  @Post("implementation-inquiries/:id/email-link")
  async emailResumeLink(@Param("id") id: string, @Body() body: unknown) {
    const parsed = z.object({ email: z.string().email() }).parse(body);
    const inquiry = await this.repository.getImplementationInquiry(id);
    if (!inquiry) throw new NotFoundException("Inquiry not found.");
    // Log/trigger email with resume token
    return { ok: true, message: `Resume link generated for ${parsed.email}` };
  }

  // ─── Platform Admin Protected Endpoints ─────────────────────────────────────
  @Get("implementation-inquiries")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  listInquiries(@Query("status") status?: string) {
    return this.repository.listImplementationInquiries(
      status as ImplementationInquiryStatus | undefined
    );
  }

  @Get("implementation-inquiries/:id")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  getInquiry(@Param("id") id: string) {
    return this.repository.getImplementationInquiry(id);
  }

  @Patch("implementation-inquiries/:id/status")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  updateInquiry(@Param("id") id: string, @Body() body: unknown) {
    const input = z
      .object({
        status: z.enum([
          "draft",
          "submitted",
          "qualified",
          "needs_clarification",
          "approved",
          "converted",
          "archived"
        ])
      })
      .strict()
      .parse(body);
    return this.repository.updateImplementationInquiryStatus(id, input.status);
  }

  @Get("implementation-inquiries/:id/seed-manifest")
  @AuthMode("platform")
  @RequirePlatformAdmin()
  seedManifest(@Param("id") id: string) {
    return this.repository.buildTenantSeedManifest(id);
  }

  // ─── Tenant Settings / Quotas ───────────────────────────────────────────────
  @Get("subscription")
  subscription(@Actor() actor: RequestActor) {
    return this.repository.getTenantSubscription(actor.tenantId);
  }

  @Get("usage")
  usage(@Actor() actor: RequestActor) {
    return this.repository.getTenantUsageQuotas(actor.tenantId);
  }

  @Get("feature-flags")
  featureFlags(@Actor() actor: RequestActor) {
    return this.repository.listFeatureFlags(actor.tenantId);
  }
}
