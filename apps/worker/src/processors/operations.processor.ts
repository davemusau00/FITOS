import type { WorkerJob } from "../jobs.js";

/**
 * The processor intentionally delegates to integration ports in later slices.
 * It validates typed job payloads before side effects and makes eventId the
 * natural idempotency key for those adapters.
 */
export async function processOperationsJob(job: WorkerJob): Promise<void> {
  switch (job.type) {
    case "notifications.send":
      process.stdout.write(
        JSON.stringify({
          event: "notification.queued",
          eventId: job.eventId,
          tenantId: job.tenantId,
          channel: job.payload.channel
        }) + "\n"
      );
      return;
    case "payments.process_webhook":
      process.stdout.write(
        JSON.stringify({
          event: "payment.webhook.queued",
          eventId: job.eventId,
          tenantId: job.tenantId,
          provider: job.payload.provider
        }) + "\n"
      );
      return;
    case "reports.generate_export":
      process.stdout.write(
        JSON.stringify({
          event: "report.export.queued",
          eventId: job.eventId,
          tenantId: job.tenantId,
          report: job.payload.report
        }) + "\n"
      );
      return;
    case "automations.execute":
      process.stdout.write(
        JSON.stringify({
          event: "automation.executed",
          eventId: job.eventId,
          tenantId: job.tenantId,
          ruleId: job.payload.ruleId,
          triggerEvent: job.payload.triggerEvent,
          idempotencyKey: job.payload.idempotencyKey
        }) + "\n"
      );
      return;
  }
}
