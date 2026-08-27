import type { AutomationActionResult, AutomationActionType } from "@fitos/contracts";

export interface AutomationActionContext {
  actionId: string;
  tenantId: string;
  recipient?: string;
  config: Record<string, unknown>;
  simulation: boolean;
  targetEntityId?: string;
  internalExecutor?: InternalAutomationExecutor;
}

export interface InternalAutomationExecutor {
  execute(
    actionType: "create_staff_task" | "update_crm_stage",
    context: AutomationActionContext
  ): Promise<string | undefined>;
}

export class ApiInternalAutomationExecutor implements InternalAutomationExecutor {
  async execute(
    actionType: "create_staff_task" | "update_crm_stage",
    context: AutomationActionContext
  ) {
    const url = process.env.FITOS_AUTOMATION_INTERNAL_URL;
    const token = process.env.FITOS_WORKER_CALLBACK_TOKEN;
    if (!url || !token) throw new Error("Internal automation handler is not configured.");
    if (!context.targetEntityId) throw new Error("Internal automation target entity is missing.");
    const response = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", "x-fitos-worker-token": token },
      body: JSON.stringify({
        actionId: context.actionId,
        actionType,
        tenantId: context.tenantId,
        targetEntityId: context.targetEntityId,
        config: context.config
      })
    });
    if (!response.ok)
      throw new Error(`Internal automation handler failed with ${response.status}.`);
    const result = (await response.json()) as { externalId?: string };
    return result.externalId;
  }
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
  if (actionType === "create_staff_task" || actionType === "update_crm_stage") {
    if (!context.internalExecutor) {
      return {
        actionId: context.actionId,
        actionType,
        status: "failed",
        provider: "internal",
        message: "No durable internal automation handler is configured.",
        completedAt
      };
    }
    const externalId = await context.internalExecutor.execute(actionType, context);
    return {
      actionId: context.actionId,
      actionType,
      status: "delivered",
      provider: "internal",
      message: `${actionType} action completed durably.`,
      ...(externalId ? { externalId } : {}),
      completedAt
    };
  }
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
