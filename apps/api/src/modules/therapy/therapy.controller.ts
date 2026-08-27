import { Body, Controller, Get, Inject, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type {
  CreateTherapyProtocolRequest,
  CreateTherapyModalityRequest,
  CreateTherapySessionRequest,
  ModalityCode,
  RequestActor
} from "@fitos/contracts";
import { RequirePermission } from "../../common/auth/permissions.decorator.js";
import { Actor } from "../../common/request-context/actor.decorator.js";
import { FitosRepositoryToken } from "../../ports/tokens.js";
import type { FitosRepository } from "../../ports/fitos-repository.js";

const modalityCodes: readonly [ModalityCode, ...ModalityCode[]] = [
  "neubie_direct_current",
  "alterg_anti_gravity",
  "normatec_compression",
  "hyperbaric_oxygen",
  "cryotherapy",
  "infrared_sauna"
];

const createProtocolSchema = z
  .object({
    modalityCode: z.enum(modalityCodes),
    modalityName: z.string().trim().min(1).max(150),
    name: z.string().trim().min(1).max(150),
    indication: z.string().trim().min(1).max(250),
    targetArea: z.string().trim().min(1).max(150),
    parameters: z.record(z.union([z.string(), z.number()])),
    safetyChecklist: z.array(z.string().trim().min(1)),
    clinicalNotes: z.string().trim().max(2000)
  })
  .strict();

const createModalitySchema = z
  .object({
    code: z.enum(modalityCodes),
    name: z.string().trim().min(1).max(150),
    category: z.enum(["neuromuscular", "unweighted_gait", "pneumatic_compression", "thermal_cryo"]),
    defaultDurationMinutes: z.number().int().min(1).max(240),
    contraindications: z.array(z.string().trim().min(1)),
    description: z.string().trim().min(1).max(2000)
  })
  .strict();

const createSessionSchema = z
  .object({
    branchId: z.string().uuid(),
    memberId: z.string().uuid(),
    protocolId: z.string().uuid(),
    assetId: z.string().uuid().optional(),
    prePainScore: z.number().min(0).max(10).optional(),
    postPainScore: z.number().min(0).max(10).optional(),
    actualDosage: z.record(z.union([z.string(), z.number()])),
    adverseReaction: z.boolean().optional(),
    sessionNotes: z.string().trim().max(1000).optional(),
    status: z.enum(["in_progress", "completed", "interrupted"]).optional()
  })
  .strict();

const toScope = (actor: RequestActor) => ({
  tenantId: actor.tenantId,
  tenantUserId: actor.tenantUserId,
  userId: actor.userId,
  branchIds: actor.branchIds
});

@ApiTags("therapy")
@Controller("therapy")
export class TherapyController {
  constructor(@Inject(FitosRepositoryToken) private readonly repository: FitosRepository) {}

  @Get("modalities")
  @RequirePermission("service:read")
  listModalities(@Actor() actor: RequestActor) {
    return this.repository.listTherapyModalities(toScope(actor));
  }

  @Post("modalities")
  @RequirePermission("service:manage")
  createModality(@Actor() actor: RequestActor, @Body() body: unknown) {
    return this.repository.createTherapyModality(
      toScope(actor),
      createModalitySchema.parse(body) as CreateTherapyModalityRequest
    );
  }

  @Get("protocols")
  @RequirePermission("service:read")
  listProtocols(@Actor() actor: RequestActor, @Query("modalityCode") modalityCode?: string) {
    return this.repository.listTherapyProtocols(toScope(actor), modalityCode);
  }

  @Post("protocols")
  @RequirePermission("service:manage")
  createProtocol(@Actor() actor: RequestActor, @Body() body: unknown) {
    const input = createProtocolSchema.parse(body) as CreateTherapyProtocolRequest;
    return this.repository.createTherapyProtocol(toScope(actor), input);
  }

  @Get("sessions")
  @RequirePermission("attendance:read")
  listSessions(
    @Actor() actor: RequestActor,
    @Query("memberId") memberId?: string,
    @Query("branchId") branchId?: string
  ) {
    return this.repository.listTherapySessions(toScope(actor), memberId, branchId);
  }

  @Post("sessions")
  @RequirePermission("attendance:checkin")
  createSession(@Actor() actor: RequestActor, @Body() body: unknown) {
    const input = createSessionSchema.parse(body) as CreateTherapySessionRequest;
    return this.repository.createTherapySession(toScope(actor), input, actor.userId);
  }
}
