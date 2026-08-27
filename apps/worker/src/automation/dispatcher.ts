import type { AutomationActionResult, AutomationActionType } from "@fitos/contracts";

export interface AutomationActionContext {
  actionId: string;
  tenantId: string;
  recipient?: string;
  config: Record<string, unknown>;
  simulation: boolean;
}

export interface AutomationProvider {
  readonly name: string;
  send(
    channel: "email" | "sms" | "whatsapp",
    context: AutomationActionContext
  ): Promise<string | undefined>;
}

export class SimulationProvider implements AutomationProvider {
  readonly name = "simulation";
  async send(): Promise<string | undefined> {
    return undefined;
  }
}

export class ResendAfricaTalkingProvider implements AutomationProvider {
  readonly name = "resend-africas-talking";

  async send(
    channel: "email" | "sms" | "whatsapp",
    context: AutomationActionContext
  ): Promise<string | undefined> {
    const recipient = context.recipient?.trim();
    if (!recipient) throw new Error("Automation recipient is missing.");
    const body = String(context.config.body ?? context.config.template ?? "");
    if (channel === "email") {
      const key = process.env.RESEND_API_KEY;
      if (!key) throw new Error("RESEND_API_KEY is not configured.");
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL ?? "FITOS <noreply@fitos.app>",
          to: [recipient],
          subject: String(context.config.subject ?? "FITOS notification"),
          html: body
        })
      });
      if (!response.ok) throw new Error(`Resend delivery failed with ${response.status}.`);
      const data = (await response.json()) as { id?: string };
      return data.id;
    }
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
        message: body,
        ...(channel === "whatsapp" ? { from: process.env.AT_WHATSAPP_SENDER ?? "" } : {})
      })
    });
    if (!response.ok) throw new Error(`Africa's Talking delivery failed with ${response.status}.`);
    return undefined;
  }
}

export async function dispatchAutomationAction(
  actionType: AutomationActionType,
  context: AutomationActionContext,
  provider: AutomationProvider = new ResendAfricaTalkingProvider()
): Promise<AutomationActionResult> {
  const completedAt = new Date().toISOString();
  if (context.simulation)
    return {
      actionId: context.actionId,
      actionType,
      status: "simulated",
      provider: "simulation",
      message: "Simulation mode enabled; no external side effect was performed.",
      completedAt
    };
  if (actionType === "create_staff_task" || actionType === "update_crm_stage")
    return {
      actionId: context.actionId,
      actionType,
      status: "skipped",
      provider: "internal",
      message: "This action requires an API-side durable command handler.",
      completedAt
    };
  const channel =
    actionType === "send_email" ? "email" : actionType === "send_sms" ? "sms" : "whatsapp";
  const externalId = await provider.send(channel, context);
  return {
    actionId: context.actionId,
    actionType,
    status: "delivered",
    provider: provider.name,
    message: `${channel} action delivered.`,
    ...(externalId ? { externalId } : {}),
    completedAt
  };
}
