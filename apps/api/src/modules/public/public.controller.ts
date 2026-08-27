import {
  Body,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  Post,
  Query,
  Req
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type { CreatePublicLeadRequest } from "@fitos/contracts";
import { Public } from "../../common/auth/public.decorator.js";
import { FitosRepositoryToken } from "../../ports/tokens.js";
import type { FitosRepository } from "../../ports/fitos-repository.js";
import { RateLimitService } from "../../common/auth/rate-limit.service.js";
import type { FitosRequest } from "../../common/request-context/request-context.js";

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
const reservationSchema = z
  .object({
    branchId: z.string().uuid().optional(),
    occurrenceId: z.string().uuid().optional(),
    serviceId: z.string().uuid().optional(),
    reservationType: z.enum([
      "class",
      "assessment",
      "therapy",
      "recovery",
      "consultation",
      "facility"
    ]),
    firstName: z.string().trim().min(1).max(120),
    lastName: z.string().trim().max(120).optional(),
    phone: z.string().trim().max(60).optional(),
    email: z.string().trim().email().max(255).optional(),
    notes: z.string().trim().max(2000).optional()
  })
  .strict();

@ApiTags("public")
@Public()
@Controller("public/:tenantSlug")
export class PublicController {
  constructor(
    @Inject(FitosRepositoryToken) private readonly repository: FitosRepository,
    @Inject(RateLimitService) private readonly rateLimit: RateLimitService
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

  @Get("site/:pageSlug")
  async sitePage(@Param("tenantSlug") slug: string, @Param("pageSlug") pageSlug: string) {
    const page = await this.repository.getPublicSitePage(slug, pageSlug);
    if (!page) throw new NotFoundException("Published page not found.");
    return page;
  }

  @Post("leads")
  createLead(@Param("tenantSlug") slug: string, @Body() body: unknown, @Req() req: FitosRequest) {
    this.rateLimit.consume(`public-lead:${slug}:${req.ip ?? "unknown"}`, 10, 60 * 60 * 1_000);
    const input = createLeadSchema.parse(body) satisfies CreatePublicLeadRequest;
    return this.repository.createPublicLead(slug, input);
  }

  @Post("reservations")
  createReservation(
    @Param("tenantSlug") slug: string,
    @Body() body: unknown,
    @Req() req: FitosRequest
  ) {
    this.rateLimit.consume(`public-reservation:${slug}:${req.ip ?? "unknown"}`, 5, 60 * 60 * 1_000);
    return this.repository.createPublicReservation(slug, reservationSchema.parse(body));
  }
}
