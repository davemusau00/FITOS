import type { Response } from "express";
import { describe, expect, it, vi } from "vitest";
import type { FitosRepository } from "../src/ports/fitos-repository.js";
import { HealthController } from "../src/modules/health/health.controller.js";

describe("health readiness", () => {
  it("returns HTTP 503 when the authoritative repository is unavailable", async () => {
    const repository = { ping: vi.fn().mockResolvedValue(false) } as unknown as FitosRepository;
    const status = vi.fn().mockReturnThis();
    const response = { status } as unknown as Response;
    const controller = new HealthController(repository);

    await expect(controller.ready("request-id", response)).resolves.toMatchObject({
      status: "degraded",
      requestId: "request-id"
    });
    expect(status).toHaveBeenCalledWith(503);
  });

  it("leaves the successful readiness response at HTTP 200", async () => {
    const repository = { ping: vi.fn().mockResolvedValue(true) } as unknown as FitosRepository;
    const status = vi.fn().mockReturnThis();
    const response = { status } as unknown as Response;
    const controller = new HealthController(repository);

    await expect(controller.ready("request-id", response)).resolves.toMatchObject({ status: "ok" });
    expect(status).not.toHaveBeenCalled();
  });
});
