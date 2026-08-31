import { Body, Controller, Get, Headers, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import type {
  CreateTaskRequest,
  CreateTaskCommentRequest,
  RequestActor,
  TaskListFilters,
  UpdateTaskRequest
} from "@fitos/contracts";
import { RequirePermission } from "../../common/auth/permissions.decorator.js";
import { Actor, RequestId } from "../../common/request-context/actor.decorator.js";
import { IdempotencyService } from "../../common/idempotency/idempotency.service.js";
import { CoreService } from "../core/core.service.js";

const taskPriorities = ["low", "normal", "high", "urgent"] as const;
const taskStatuses = ["open", "in_progress", "completed", "cancelled"] as const;
const nullableUuid = z.string().uuid().nullable().optional();
const taskFields = {
  title: z.string().trim().min(1).max(180),
  description: z.string().trim().max(4000).nullable().optional(),
  branchId: nullableUuid,
  assigneeUserId: nullableUuid,
  priority: z.enum(taskPriorities).optional(),
  dueAt: z.string().datetime({ offset: true }).nullable().optional(),
  resourceType: z.string().trim().max(80).nullable().optional(),
  resourceId: nullableUuid
};
const createTaskSchema = z.object(taskFields).strict();
const updateTaskSchema = createTaskSchema
  .extend({ status: z.enum(taskStatuses).optional() })
  .partial()
  .strict();
const listTaskSchema = z
  .object({
    status: z.enum(taskStatuses).optional(),
    assigneeUserId: z.string().uuid().optional(),
    branchId: z.string().uuid().optional(),
    dueBefore: z.string().datetime({ offset: true }).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional()
  })
  .passthrough();
const taskCommentSchema = z.object({ body: z.string().trim().min(1).max(4000) }).strict();
const uuid = z.string().uuid();

@ApiTags("tasks")
@Controller("tasks")
export class TasksController {
  constructor(
    @Inject(CoreService) private readonly core: CoreService,
    @Inject(IdempotencyService) private readonly idempotency: IdempotencyService
  ) {}

  @Get()
  @RequirePermission("task:read")
  list(@Actor() actor: RequestActor, @Query() query: unknown) {
    return this.core.listTasks(actor, listTaskSchema.parse(query) satisfies TaskListFilters);
  }

  @Get(":taskId/comments")
  @RequirePermission("task:read")
  comments(@Actor() actor: RequestActor, @Param("taskId") taskId: string) {
    return this.core.listTaskComments(actor, uuid.parse(taskId));
  }

  @Get(":taskId")
  @RequirePermission("task:read")
  get(@Actor() actor: RequestActor, @Param("taskId") taskId: string) {
    return this.core.getTask(actor, uuid.parse(taskId));
  }

  @Post()
  @RequirePermission("task:manage")
  create(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() body: unknown
  ) {
    const input = createTaskSchema.parse(body) satisfies CreateTaskRequest;
    return this.idempotency.execute({
      actor,
      operation: "task:create",
      key: idempotencyKey,
      body: input,
      status: 201,
      action: () => this.core.createTask(actor, requestId, input)
    });
  }

  @Post(":taskId/comments")
  @RequirePermission("task:manage")
  addComment(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Param("taskId") taskId: string,
    @Headers("idempotency-key") idempotencyKey: string | undefined,
    @Body() body: unknown
  ) {
    const input = taskCommentSchema.parse(body) satisfies CreateTaskCommentRequest;
    return this.idempotency.execute({
      actor,
      operation: "task-comment:create",
      key: idempotencyKey,
      body: input,
      status: 201,
      action: () => this.core.createTaskComment(actor, requestId, uuid.parse(taskId), input)
    });
  }

  @Patch(":taskId")
  @RequirePermission("task:manage")
  update(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Param("taskId") taskId: string,
    @Body() body: unknown
  ) {
    return this.core.updateTask(
      actor,
      requestId,
      uuid.parse(taskId),
      updateTaskSchema.parse(body) satisfies UpdateTaskRequest
    );
  }

  @Post(":taskId/complete")
  @RequirePermission("task:manage")
  complete(
    @Actor() actor: RequestActor,
    @RequestId() requestId: string,
    @Param("taskId") taskId: string
  ) {
    return this.core.completeTask(actor, requestId, uuid.parse(taskId));
  }
}
