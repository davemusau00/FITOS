import { Body, Controller, Get, Headers, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type {
  CreateLeadRequest,
  LeadListFilters,
  RequestActor,
  UpdateLeadStageRequest
} from "@fitos/contracts";
import { RequirePermission } from "../../common/auth/permissions.decorator.js";
import { IdempotencyService } from "../../common/idempotency/idempotency.service.js";
import { Actor, RequestId } from "../../common/request-context/actor.decorator.js";
import { CoreService } from "../core/core.service.js";

const stages = [
  "new",
  "contacted",
  "trial_booked",
  "trial_completed",
  "offer",
  "joined",
  "lost"
] as const;
const contactSchema = z
  .object({
    firstName: z.string().trim().min(1).max(120),
    lastName: z.string().trim().max(120).nullable().optional(),
    phone: z.string().trim().max(60).nullable().optional(),
    email: z.string().trim().email().max(255).nullable().optional(),
    dateOfBirth: z.string().date().nullable().optional()
  })
  .strict();
const createSchema = z
  .object({
    contact: contactSchema,
    branchId: z.string().uuid().nullable().optional(),
    interest: z.string().trim().max(255).nullable().optional(),
    source: z.string().trim().max(80).nullable().optional(),
    ownerUserId: z.string().uuid().nullable().optional(),
    nextFollowUpAt: z.string().datetime().nullable().optional()
  })
  .strict();
const stageSchema = z
  .object({
    stage: z.enum(stages),
    lostReason: z.string().trim().min(1).max(255).nullable().optional()
  })
  .strict();
const noteSchema = z.object({ body: z.string().trim().min(1).max(10_000) }).strict();
const taskSchema = z
  .object({
    body: z.string().trim().min(1).max(2_000),
    dueAt: z.string().datetime().nullable().optional(),
    assigneeUserId: z.string().uuid().nullable().optional()
  })
  .strict();
const listSchema = z
  .object({
    query: z.string().trim().max(160).optional(),
    stage: z.enum(stages).optional(),
    branchId: z.string().uuid().optional(),
    cursor: z.string().min(1).max(512).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional()
  })
  .passthrough();
const workloadSchema = z.object({ branchId: z.string().uuid().optional() }).passthrough();

@ApiTags("leads")
@Controller("leads")
export class LeadsController {
  constructor(
    @Inject(CoreService) private readonly core: CoreService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService
  ) {}

  @Get()
  @RequirePermission("lead:read")
  list(@Actor() actor: RequestActor, @Query() query: unknown) {
    return this.core.listLeads(actor, listSchema.parse(query) satisfies LeadListFilters);
  }

  @Get("workload")
  @RequirePermission("lead:read")
  workload(@Actor() actor: RequestActor, @Query() query: unknown) {
    return this.core.leadWorkload(actor, workloadSchema.parse(query).branchId);
  }

  @Post()
  @RequirePermission("lead:create")
  create(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Headers("idempotency-key") key: string | undefined,
    @Body() body: unknown
  ) {
    const input = createSchema.parse(body) satisfies CreateLeadRequest;
    return this.idempotency.execute({
      actor,
      operation: "lead:create",
      key,
      body: input,
      status: 201,
      action: () => this.core.createLead(actor, requestId, input)
    });
  }

  @Get(":leadId")
  @RequirePermission("lead:read")
  get(@Actor() actor: RequestActor, @Param("leadId") leadId: string) {
    return this.core.getLead(actor, z.string().uuid().parse(leadId));
  }

  @Post(":leadId/stage")
  @RequirePermission("lead:update")
  stage(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Param("leadId") leadId: string,
    @Body() body: unknown
  ) {
    return this.core.updateLeadStage(
      actor,
      requestId,
      z.string().uuid().parse(leadId),
      stageSchema.parse(body) satisfies UpdateLeadStageRequest
    );
  }

  @Post(":leadId/convert")
  @RequirePermission("lead:convert")
  convert(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Param("leadId") leadId: string
  ) {
    return this.core.convertLead(actor, requestId, z.string().uuid().parse(leadId));
  }

  @Get(":leadId/notes")
  @RequirePermission("lead:read")
  notes(@Actor() actor: RequestActor, @Param("leadId") leadId: string) {
    return this.core.leadNotes(actor, z.string().uuid().parse(leadId));
  }

  @Post(":leadId/notes")
  @RequirePermission("lead:update")
  addNote(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Param("leadId") leadId: string,
    @Body() body: unknown
  ) {
    return this.core.addLeadNote(
      actor,
      requestId,
      z.string().uuid().parse(leadId),
      noteSchema.parse(body).body
    );
  }

  @Get(":leadId/tasks")
  @RequirePermission("lead:read")
  tasks(@Actor() actor: RequestActor, @Param("leadId") leadId: string) {
    return this.core.leadTasks(actor, z.string().uuid().parse(leadId));
  }

  @Post(":leadId/tasks")
  @RequirePermission("lead:update")
  addTask(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Param("leadId") leadId: string,
    @Body() body: unknown
  ) {
    return this.core.createLeadTask(
      actor,
      requestId,
      z.string().uuid().parse(leadId),
      taskSchema.parse(body)
    );
  }

  @Patch(":leadId/tasks/:taskId/complete")
  @RequirePermission("lead:update")
  completeTask(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Param("leadId") leadId: string,
    @Param("taskId") taskId: string
  ) {
    return this.core.completeLeadTask(
      actor,
      requestId,
      z.string().uuid().parse(leadId),
      z.string().uuid().parse(taskId)
    );
  }
}
