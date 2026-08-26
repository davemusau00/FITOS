import type { WorkerJob } from "../jobs.js";

/**
 * The processor intentionally delegates to integration ports in later slices.
 * It validates typed job payloads before side effects and makes eventId the
 * natural idempotency key for those adapters.
 */
export async function processOperationsJob(job: WorkerJob): Promise<void> {
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
    case "automations.execute":
      process.stdout.write(
        JSON.stringify({
          event: "automation.simulated",
          eventId: job.eventId,
          tenantId: job.tenantId,
          ruleId: job.payload.ruleId,
          triggerEvent: job.payload.triggerEvent,
          idempotencyKey: job.payload.idempotencyKey,
          actionStatus: "simulated",
          message: "Automation execution was simulated; no customer communication was sent."
        }) + "\n"
      );
      return;
  }
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
