import { afterEach, describe, expect, it, vi } from "vitest";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { workerJobSchema } from "../src/jobs.js";
import { processOperationsJob } from "../src/processors/operations.processor.js";

const base = {
  eventId: "00000000-0000-4000-8000-000000000001",
  tenantId: "00000000-0000-4000-8000-000000000002",
  occurredAt: "2026-08-20T12:00:00.000Z"
};

afterEach(() => vi.restoreAllMocks());

describe("operations worker", () => {
  it("validates tenant-scoped jobs before processing", () => {
    expect(() =>
      workerJobSchema.parse({
        ...base,
        tenantId: "not-a-uuid",
        type: "notifications.send",
        payload: {
          channel: "email",
          template: "booking-confirmed",
          recipientId: "00000000-0000-4000-8000-000000000003",
          data: {}
        }
      })
    ).toThrow();
  });

  it("emits structured, tenant-scoped completion information", async () => {
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    await processOperationsJob(
      workerJobSchema.parse({
        ...base,
        type: "notifications.send",
        payload: {
          channel: "email",
          template: "booking-confirmed",
          recipientId: "00000000-0000-4000-8000-000000000003",
          data: {}
        }
      })
    );

    expect(write).toHaveBeenCalledOnce();
    expect(JSON.parse(String(write.mock.calls[0]?.[0]))).toMatchObject({
      event: "notification.queued",
      eventId: base.eventId,
      tenantId: base.tenantId,
      channel: "email"
    });
  });

  it("persists automation action results through the authenticated callback", async () => {
    const received: { token?: string; body?: unknown } = {};
    const server = createServer((request, response) => {
      received.token = request.headers["x-fitos-worker-token"];
      let body = "";
      request.on("data", (chunk) => (body += chunk));
      request.on("end", () => {
        received.body = JSON.parse(body);
        response.writeHead(200).end();
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address() as AddressInfo;
    const previousUrl = process.env.FITOS_AUTOMATION_RESULT_URL;
    const previousToken = process.env.FITOS_WORKER_CALLBACK_TOKEN;
    process.env.FITOS_AUTOMATION_RESULT_URL = `http://127.0.0.1:${address.port}/results`;
    process.env.FITOS_WORKER_CALLBACK_TOKEN = "processor-callback-token";
    try {
      await processOperationsJob(
        workerJobSchema.parse({
          ...base,
          type: "automations.execute",
          payload: {
            ruleId: "00000000-0000-4000-8000-000000000003",
            triggerEvent: "member_joined",
            idempotencyKey: base.eventId,
            actionId: base.eventId,
            actionType: "send_email",
            actionConfig: { recipient: "member@example.test", body: "Welcome" },
            simulation: true
          }
        })
      );
      expect(received.token).toBe("processor-callback-token");
      expect(received.body).toMatchObject({ actionId: base.eventId, status: "simulated" });
    } finally {
      if (previousUrl === undefined) delete process.env.FITOS_AUTOMATION_RESULT_URL;
      else process.env.FITOS_AUTOMATION_RESULT_URL = previousUrl;
      if (previousToken === undefined) delete process.env.FITOS_WORKER_CALLBACK_TOKEN;
      else process.env.FITOS_WORKER_CALLBACK_TOKEN = previousToken;
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      );
    }
  });
});
