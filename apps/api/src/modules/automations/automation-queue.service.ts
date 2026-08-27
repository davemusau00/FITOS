import { Injectable } from "@nestjs/common";
import type { OnModuleDestroy } from "@nestjs/common";
import { Queue } from "bullmq";
import { Redis } from "ioredis";
import type { AutomationExecutionLogResponse } from "@fitos/contracts";

/** API-side handoff. Delivery truth is written back by the worker callback. */
@Injectable()
export class AutomationQueueService implements OnModuleDestroy {
  private readonly connection: Redis | null =
    process.env.NODE_ENV !== "test" && process.env.REDIS_URL
      ? new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null })
      : null;
  private readonly queue = this.connection
    ? new Queue("fitos-operations", { connection: this.connection })
    : null;

  async enqueue(log: AutomationExecutionLogResponse): Promise<boolean> {
    if (!this.queue || !log.actionId || !log.actionType) return false;
    await this.queue.add("automation-action", {
      eventId: log.id,
      tenantId: log.tenantId,
      occurredAt: log.executedAt,
      type: "automations.execute",
      payload: {
        ruleId: log.ruleId,
        triggerEvent: log.triggerEvent,
        idempotencyKey: log.actionId,
        actionId: log.actionId,
        actionType: log.actionType,
        actionConfig: log.actionConfig,
        simulation: process.env.FITOS_AUTOMATION_SIMULATION === "true"
      }
    });
    return true;
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
    await this.connection?.quit();
  }
}
