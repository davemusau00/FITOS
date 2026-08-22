import { Body, Controller, Get, Inject, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type { RequestActor, SaaSTenantSignupRequest } from "@fitos/contracts";
import { ScryptPasswordHasher } from "@fitos/auth";
import { Public } from "../../common/auth/public.decorator.js";
import { Actor } from "../../common/request-context/actor.decorator.js";
import { FitosRepositoryToken } from "../../ports/tokens.js";
import type { FitosRepository } from "../../ports/fitos-repository.js";

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
