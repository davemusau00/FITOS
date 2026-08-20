import { afterEach, describe, expect, it, vi } from "vitest";
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
});
