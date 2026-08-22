import { Body, Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type {
  AssessmentCategory,
  CreateAssessmentDefinitionRequest,
  CreateAssessmentSessionRequest,
  DeviceVendor,
  RequestActor
} from "@fitos/contracts";
import { RequirePermission } from "../../common/auth/permissions.decorator.js";
import { Actor } from "../../common/request-context/actor.decorator.js";
import { FitosRepositoryToken } from "../../ports/tokens.js";
import type { FitosRepository } from "../../ports/fitos-repository.js";

const categories: readonly [AssessmentCategory, ...AssessmentCategory[]] = [
  "body_composition",
  "cardiovascular_vo2",
  "neuromuscular_force",
  "mobility_rom",
  "metabolic"
];

const vendors: readonly [DeviceVendor, ...DeviceVendor[]] = [
  "lookinbody_inbody",
  "vald_forcedecks",
  "cosmed_k5",
  "pnoe",
  "manual"
];

const metricSchema = z.object({
  key: z.string().trim().min(1).max(50),
  name: z.string().trim().min(1).max(100),
  unit: z.string().trim().min(1).max(30),
  description: z.string().trim().max(300).optional(),
  optimalMin: z.number().optional(),
  optimalMax: z.number().optional()
});

const createDefinitionSchema = z
  .object({
    name: z.string().trim().min(1).max(150),
    category: z.enum(categories),
    description: z.string().trim().min(1).max(1000),
    deviceVendor: z.enum(vendors),
    metrics: z.array(metricSchema).min(1)
  })
  .strict();

const createSessionSchema = z
  .object({
    branchId: z.string().uuid(),
    memberId: z.string().uuid(),
    definitionId: z.string().uuid(),
    conductedAt: z.string().optional(),
    summary: z.string().trim().min(1).max(1000),
    metrics: z.record(z.union([z.number(), z.string()])),
    notes: z.string().trim().max(1000).optional()
  })
  .strict();

const toScope = (actor: RequestActor) => ({
  tenantId: actor.tenantId,
  tenantUserId: actor.tenantUserId,
  userId: actor.userId,
  branchIds: actor.branchIds
});

@ApiTags("assessments")
@Controller("assessments")
export class AssessmentsController {
  constructor(
    @Inject(FitosRepositoryToken) private readonly repository: FitosRepository
  ) {}

  @Get("definitions")
  @RequirePermission("assessment:read")
  listDefinitions(@Actor() actor: RequestActor) {
    return this.repository.listAssessmentDefinitions(toScope(actor));
  }

  @Post("definitions")
  @RequirePermission("assessment:write")
  createDefinition(@Actor() actor: RequestActor, @Body() body: unknown) {
    const input = createDefinitionSchema.parse(body) as CreateAssessmentDefinitionRequest;
    return this.repository.createAssessmentDefinition(toScope(actor), input);
  }

  @Get("sessions")
  @RequirePermission("assessment:read")
  listSessions(
    @Actor() actor: RequestActor,
    @Query("memberId") memberId?: string,
    @Query("branchId") branchId?: string
  ) {
    return this.repository.listAssessmentSessions(toScope(actor), memberId, branchId);
  }

  @Post("sessions")
  @RequirePermission("assessment:write")
  createSession(@Actor() actor: RequestActor, @Body() body: unknown) {
    const input = createSessionSchema.parse(body) as CreateAssessmentSessionRequest;
    return this.repository.createAssessmentSession(toScope(actor), input, actor.userId);
  }

  @Get("members/:memberId/profile")
  @RequirePermission("assessment:read")
  getMemberProfile(@Actor() actor: RequestActor, @Param("memberId") memberId: string) {
    return this.repository.getMemberPerformanceProfile(toScope(actor), memberId);
  }
}
