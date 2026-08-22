import { Body, Controller, Delete, Get, Inject, NotFoundException, Param, Patch, Post } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type { AutomationActionType, AutomationTriggerType, CreateAutomationRuleRequest, RequestActor, UpdateAutomationRuleRequest } from "@fitos/contracts";
import { RequirePermission } from "../../common/auth/permissions.decorator.js";
import { Actor } from "../../common/request-context/actor.decorator.js";
import { FitosRepositoryToken } from "../../ports/tokens.js";
import type { FitosRepository } from "../../ports/fitos-repository.js";

const triggerTypes = [
  "booking_created",
  "booking_cancelled",
  "member_joined",
  "membership_expiring_soon",
  "member_inactive",
  "trial_completed",
  "payment_failed"
] as const;

const actionTypes = [
  "send_email",
  "send_sms",
  "send_whatsapp",
  "create_staff_task",
  "update_crm_stage"
] as const;

const conditionSchema = z.object({
  field: z.string().trim().min(1),
  operator: z.enum(["equals", "greater_than", "less_than", "contains"]),
  value: z.union([z.string(), z.number(), z.boolean()])
});

const actionConfigSchema = z.object({
  template: z.string().optional(),
  recipientType: z.enum(["member", "staff", "lead"]).optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  targetStage: z.string().optional()
}).passthrough();

const createSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    description: z.string().trim().max(500).optional(),
    triggerType: z.enum(triggerTypes),
    triggerConfig: z.record(z.unknown()).optional().default({}),
    conditions: z.array(conditionSchema).optional().default([]),
    actionType: z.enum(actionTypes),
    actionConfig: actionConfigSchema.default({}),
    isActive: z.boolean().optional().default(true)
  })
  .strict();

const updateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().trim().max(500).optional(),
    triggerType: z.enum(triggerTypes).optional(),
    triggerConfig: z.record(z.unknown()).optional(),
    conditions: z.array(conditionSchema).optional(),
    actionType: z.enum(actionTypes).optional(),
    actionConfig: actionConfigSchema.optional(),
    isActive: z.boolean().optional()
  })
  .strict();

const toScope = (actor: RequestActor) => ({
  tenantId: actor.tenantId,
  tenantUserId: actor.tenantUserId,
  userId: actor.userId,
  branchIds: actor.branchIds
});

@ApiTags("automations")
@Controller("automations")
export class AutomationsController {
  constructor(
    @Inject(FitosRepositoryToken) private readonly repository: FitosRepository
  ) {}

  @Get()
  @RequirePermission("attendance:read")
  list(@Actor() actor: RequestActor) {
    return this.repository.listAutomations(toScope(actor));
  }

  @Post()
  @RequirePermission("attendance:checkin")
  create(@Actor() actor: RequestActor, @Body() body: unknown) {
    const input = createSchema.parse(body) as CreateAutomationRuleRequest;
    return this.repository.createAutomation(toScope(actor), input);
  }

  @Patch(":ruleId")
  @RequirePermission("attendance:checkin")
  async update(
    @Actor() actor: RequestActor,
    @Param("ruleId") ruleId: string,
    @Body() body: unknown
  ) {
    const input = updateSchema.parse(body) as UpdateAutomationRuleRequest;
    const result = await this.repository.updateAutomation(toScope(actor), ruleId, input);
    if (!result) throw new NotFoundException("Automation rule not found.");
    return result;
  }

  @Delete(":ruleId")
  @RequirePermission("attendance:checkin")
  async remove(@Actor() actor: RequestActor, @Param("ruleId") ruleId: string) {
    const deleted = await this.repository.deleteAutomation(toScope(actor), ruleId);
    if (!deleted) throw new NotFoundException("Automation rule not found.");
    return { deleted: true };
  }

  @Post(":ruleId/trigger")
  @RequirePermission("attendance:checkin")
  trigger(@Actor() actor: RequestActor, @Param("ruleId") ruleId: string) {
    return this.repository.triggerAutomation(toScope(actor), ruleId);
  }

  @Get("logs")
  @RequirePermission("attendance:read")
  logs(@Actor() actor: RequestActor) {
    return this.repository.listAutomationLogs(toScope(actor));
  }
}
