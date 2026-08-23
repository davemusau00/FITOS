import { Queue } from "bullmq";
import type { Redis } from "ioredis";
import { z } from "zod";

const tenantEventBase = z.object({
  eventId: z.string().uuid(),
  tenantId: z.string().uuid(),
  occurredAt: z.string().datetime()
});

export const notificationJobSchema = tenantEventBase.extend({
  type: z.literal("notifications.send"),
  payload: z.object({
    channel: z.enum(["email", "sms", "whatsapp", "in_app"]),
    template: z.string().min(1),
    recipientId: z.string().uuid(),
    data: z.record(z.string(), z.unknown()).default({})
  })
});

export const paymentWebhookJobSchema = tenantEventBase.extend({
  type: z.literal("payments.process_webhook"),
  payload: z.object({ provider: z.string().min(1), providerEventId: z.string().min(1) })
});

export const exportJobSchema = tenantEventBase.extend({
  type: z.literal("reports.generate_export"),
  payload: z.object({ report: z.string().min(1), requestedBy: z.string().uuid() })
});

export const automationJobSchema = tenantEventBase.extend({
  type: z.literal("automations.execute"),
  payload: z.object({
    ruleId: z.string().uuid(),
    triggerEvent: z.string(),
    targetEntityId: z.string().uuid().optional(),
    idempotencyKey: z.string()
  })
});

export const workerJobSchema = z.discriminatedUnion("type", [
  notificationJobSchema,
  paymentWebhookJobSchema,
  exportJobSchema,
  automationJobSchema
]);

export type WorkerJob = z.infer<typeof workerJobSchema>;
export type WorkerJobType = WorkerJob["type"];

export const WORKER_QUEUE = "fitos-operations";

export function createOperationsQueue(connection: Redis) {
  return new Queue<WorkerJob>(WORKER_QUEUE, {
    connection,
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: "exponential", delay: 1_000 },
      removeOnComplete: { age: 60 * 60 * 24 * 7, count: 10_000 },
      removeOnFail: { age: 60 * 60 * 24 * 30, count: 10_000 }
    }
  });
}
