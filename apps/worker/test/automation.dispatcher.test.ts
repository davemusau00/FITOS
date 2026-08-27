import { describe, expect, it } from "vitest";
import { dispatchAutomationAction, type AutomationProvider } from "../src/automation/dispatcher.js";

const context = {
  actionId: "00000000-0000-4000-8000-000000000001",
  tenantId: "00000000-0000-4000-8000-000000000002",
  recipient: "+254700000000",
  config: { body: "Your session is tomorrow" },
  simulation: false
};

describe("automation action dispatcher", () => {
  it("returns a durable-shaped simulation result without delivery", async () => {
    const result = await dispatchAutomationAction("send_sms", { ...context, simulation: true });
    expect(result).toMatchObject({
      actionId: context.actionId,
      actionType: "send_sms",
      status: "simulated",
      provider: "simulation"
    });
  });

  it("routes notification actions through the provider adapter", async () => {
    const calls: string[] = [];
    const provider: AutomationProvider = {
      name: "test-provider",
      async send(channel) {
        calls.push(channel);
        return "provider-123";
      }
    };
    const result = await dispatchAutomationAction("send_email", context, provider);
    expect(calls).toEqual(["email"]);
    expect(result).toMatchObject({
      status: "delivered",
      provider: "test-provider",
      externalId: "provider-123"
    });
  });

  it("fails clearly when an internal action has no durable handler", async () => {
    const result = await dispatchAutomationAction("create_staff_task", context);
    expect(result).toMatchObject({ status: "failed", provider: "internal" });
  });

  it("routes internal actions through the durable executor", async () => {
    const calls: string[] = [];
    const result = await dispatchAutomationAction("update_crm_stage", {
      ...context,
      internalExecutor: {
        async execute(actionType) {
          calls.push(actionType);
          return "crm-event-1";
        }
      }
    });
    expect(calls).toEqual(["update_crm_stage"]);
    expect(result).toMatchObject({
      status: "delivered",
      provider: "internal",
      externalId: "crm-event-1"
    });
  });
});
