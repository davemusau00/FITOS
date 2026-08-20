import { describe, expect, it, vi } from "vitest";
import { WorkerMetrics } from "../src/metrics.js";

describe("worker metrics", () => {
  it("exposes active, completed, failed, stalled, readiness, and release signals", () => {
    vi.spyOn(Date, "now").mockReturnValue(1_787_256_000_000);
    const metrics = new WorkerMetrics();
    metrics.active("active-job");
    metrics.active("completed-job");
    metrics.complete("completed-job", "completed");
    metrics.complete("failed-job", "failed");
    metrics.complete("stalled-job", "stalled");

    const output = metrics.render("release-test", true);
    expect(output).toContain('fitos_worker_build_info{release="release-test"} 1');
    expect(output).toContain("fitos_worker_redis_ready 1");
    expect(output).toContain("fitos_worker_active_jobs 1");
    expect(output).toContain('fitos_worker_jobs_total{outcome="completed"} 1');
    expect(output).toContain('fitos_worker_jobs_total{outcome="failed"} 1');
    expect(output).toContain('fitos_worker_jobs_total{outcome="stalled"} 1');
    expect(output).toContain("fitos_worker_last_failure_timestamp_seconds 1787256000");
  });
});
