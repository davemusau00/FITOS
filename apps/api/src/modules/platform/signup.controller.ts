import { Body, Controller, Get, Inject, Post, Param, Patch, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type { RequestActor, SaaSTenantSignupRequest } from "@fitos/contracts";
import { ScryptPasswordHasher } from "@fitos/auth";
import { Public } from "../../common/auth/public.decorator.js";
import { Actor } from "../../common/request-context/actor.decorator.js";
import { FitosRepositoryToken } from "../../ports/tokens.js";
import type { FitosRepository } from "../../ports/fitos-repository.js";
import { RequirePermission } from "../../common/auth/permissions.decorator.js";

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
const inquirySchema = z.object({ id: z.string().uuid().optional(), contactName: z.string().trim().max(160).optional(), businessName: z.string().trim().max(160).optional(), email: z.string().trim().email().max(255).optional(), phone: z.string().trim().max(60).optional(), country: z.string().trim().max(80).optional(), businessType: z.string().trim().max(80).optional(), payload: z.record(z.unknown()) }).strict();

const hasher = new ScryptPasswordHasher();

@ApiTags("platform")
@Controller("platform")
export class PlatformController {
  constructor(
    @Inject(FitosRepositoryToken) private readonly repository: FitosRepository
  ) {}

  @Public()
  @Post("signup")
  async signup(@Body() body: unknown) {
    const input = signupSchema.parse(body) as SaaSTenantSignupRequest;
    const passwordHash = await hasher.hash(input.password);
    return this.repository.signupTenant(input, passwordHash);
  }

  @Public()
  @Post("implementation-inquiries/draft")
  saveInquiryDraft(@Body() body: unknown) {
    return this.repository.saveImplementationInquiry(inquirySchema.parse(body), false);
  }

  @Public()
  @Post("implementation-inquiries/submit")
  submitInquiry(@Body() body: unknown) {
    const input = inquirySchema.extend({ contactName: z.string().trim().min(2).max(160), businessName: z.string().trim().min(2).max(160), email: z.string().trim().email().max(255) }).parse(body);
    return this.repository.saveImplementationInquiry(input, true);
  }

  @Get("implementation-inquiries")
  @RequirePermission("tenant:settings")
  listInquiries(@Query("status") status?: string) { return this.repository.listImplementationInquiries(status as any); }

  @Get("implementation-inquiries/:id")
  @RequirePermission("tenant:settings")
  getInquiry(@Param("id") id: string) { return this.repository.getImplementationInquiry(id); }

  @Patch("implementation-inquiries/:id/status")
  @RequirePermission("tenant:settings")
  updateInquiry(@Param("id") id: string, @Body() body: unknown) { const input = z.object({ status: z.enum(["draft", "submitted", "qualified", "needs_clarification", "approved", "converted", "archived"]) }).strict().parse(body); return this.repository.updateImplementationInquiryStatus(id, input.status); }

  @Get("implementation-inquiries/:id/seed-manifest")
  @RequirePermission("tenant:settings")
  seedManifest(@Param("id") id: string) { return this.repository.buildTenantSeedManifest(id); }

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
