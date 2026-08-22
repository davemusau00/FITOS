import { Body, Controller, Get, Inject, NotFoundException, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type { CreatePublicLeadRequest } from "@fitos/contracts";
import { Public } from "../../common/auth/public.decorator.js";
import { FitosRepositoryToken } from "../../ports/tokens.js";
import type { FitosRepository } from "../../ports/fitos-repository.js";

const createLeadSchema = z
  .object({
    firstName: z.string().trim().min(1).max(120),
    lastName: z.string().trim().max(120).nullable().optional(),
    phone: z.string().trim().max(60).nullable().optional(),
    email: z.string().trim().email().max(255).nullable().optional(),
    interest: z.string().trim().max(255).nullable().optional(),
    source: z.string().trim().max(80).nullable().optional()
  })
  .strict();

const scheduleQuerySchema = z
  .object({
    daysAhead: z.coerce.number().int().min(1).max(90).optional()
  })
  .passthrough();

@ApiTags("public")
@Public()
@Controller("public/:tenantSlug")
export class PublicController {
  constructor(
    @Inject(FitosRepositoryToken) private readonly repository: FitosRepository
  ) {}

  @Get()
  async tenantInfo(@Param("tenantSlug") slug: string) {
    const info = await this.repository.getPublicTenantInfo(slug);
    if (!info) throw new NotFoundException("Tenant not found.");
    return info;
  }

  @Get("services")
  listServices(@Param("tenantSlug") slug: string) {
    return this.repository.listPublicServices(slug);
  }

  @Get("coaches")
  listCoaches(@Param("tenantSlug") slug: string) {
    return this.repository.listPublicCoaches(slug);
  }

  @Get("schedule")
  listSchedule(@Param("tenantSlug") slug: string, @Query() query: unknown) {
    const { daysAhead } = scheduleQuerySchema.parse(query);
    return this.repository.listPublicSchedule(slug, daysAhead);
  }

  @Post("leads")
  createLead(@Param("tenantSlug") slug: string, @Body() body: unknown) {
    const input = createLeadSchema.parse(body) satisfies CreatePublicLeadRequest;
    return this.repository.createPublicLead(slug, input);
  }
}
