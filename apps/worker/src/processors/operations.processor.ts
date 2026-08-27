import type { WorkerJob } from "../jobs.js";
import {
  ApiInternalAutomationExecutor,
  dispatchAutomationAction
} from "../automation/dispatcher.js";
import type { AutomationActionResult } from "@fitos/contracts";

/**
 * The processor intentionally delegates to integration ports in later slices.
 * It validates typed job payloads before side effects and makes eventId the
 * natural idempotency key for those adapters.
 */
export async function processOperationsJob(job: WorkerJob): Promise<AutomationActionResult | void> {
  switch (job.type) {
    case "notifications.send":
      await dispatchNotification(job);
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
    case "automations.execute": {
      if (!job.payload.actionType)
        throw new Error("Automation actionType is required for execution.");
      const result = await dispatchAutomationAction(job.payload.actionType, {
        actionId: job.payload.actionId ?? job.eventId,
        tenantId: job.tenantId,
        targetEntityId: job.payload.targetEntityId,
        recipient:
          typeof job.payload.actionConfig?.recipient === "string"
            ? job.payload.actionConfig.recipient
            : undefined,
        config: job.payload.actionConfig ?? {},
        simulation: job.payload.simulation,
        internalExecutor: new ApiInternalAutomationExecutor()
      });
      await persistAutomationResult(result);
      return result;
    }
  }
}

async function persistAutomationResult(result: AutomationActionResult): Promise<void> {
  const url = process.env.FITOS_AUTOMATION_RESULT_URL;
  const token = process.env.FITOS_WORKER_CALLBACK_TOKEN;
  if (!url || !token) return;
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-fitos-worker-token": token },
    body: JSON.stringify(result)
  });
  if (!response.ok) throw new Error(`Automation result callback failed with ${response.status}.`);
}

async function dispatchNotification(
  job: Extract<WorkerJob, { type: "notifications.send" }>
): Promise<void> {
  const { channel, data } = job.payload;
  const recipient = String(data.recipient ?? data.email ?? data.phone ?? "");
  if (!recipient) {
    process.stdout.write(
      JSON.stringify({
        event: "notification.queued",
        eventId: job.eventId,
        tenantId: job.tenantId,
        channel
      }) + "\n"
    );
    return;
  }
  if (channel === "email") {
    const key = process.env.RESEND_API_KEY;
    if (!key) throw new Error("RESEND_API_KEY is not configured.");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL ?? "FITOS <noreply@fitos.app>",
        to: [recipient],
        subject: String(data.subject ?? job.payload.template),
        html: String(data.body ?? "")
      })
    });
    if (!response.ok) throw new Error(`Resend delivery failed with ${response.status}.`);
  } else if (channel === "sms" || channel === "whatsapp") {
    const key = process.env.AT_API_KEY;
    const username = process.env.AT_USERNAME;
    if (!key || !username) throw new Error("AT_API_KEY and AT_USERNAME are not configured.");
    const response = await fetch("https://api.africastalking.com/version1/messaging", {
      method: "POST",
      headers: {
        apiKey: key,
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        username,
        to: recipient,
        message: String(data.body ?? job.payload.template),
        ...(channel === "whatsapp" ? { from: process.env.AT_WHATSAPP_SENDER ?? "" } : {})
      })
    });
    if (!response.ok) throw new Error(`Africa's Talking delivery failed with ${response.status}.`);
  } else {
    process.stdout.write(
      JSON.stringify({
        event: "notification.queued",
        eventId: job.eventId,
        tenantId: job.tenantId,
        channel
      }) + "\n"
    );
  }
}
