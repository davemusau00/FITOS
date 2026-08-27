import { describe, expect, it } from "vitest";
import { MetricsService, normalizeMetricPath } from "../src/common/metrics/metrics.service.js";
import { InMemoryFitosRepository } from "../src/repositories/in-memory-fitos.repository.js";

describe("API metrics", () => {
  it("normalizes identifiers and exports request/error counters without tenant labels", () => {
    const metrics = new MetricsService();
    metrics.recordRequest({
      method: "get",
      path: "/api/v1/members/8b31aaf3-0f76-4e61-9eef-dddc9fd45ae0?include=history",
      statusCode: 404,
      durationMs: 25
    });
    const output = metrics.render();

    expect(normalizeMetricPath("/api/v1/items/42")).toBe("/api/v1/items/:number");
    expect(output).toContain(
      'fitos_http_requests_total{method="GET",path="/api/v1/members/:id",status_code="404"} 1'
    );
    expect(output).toContain("fitos_http_request_duration_seconds_sum");
    expect(output).not.toContain("8b31aaf3-0f76-4e61-9eef-dddc9fd45ae0");
    expect(output).not.toContain("tenantId");
  });
});

describe("Insights no-data behavior", () => {
  it("does not synthesize attendance, cohorts, or lead-funnel observations", async () => {
    const repository = new InMemoryFitosRepository();
    const result = await repository.getInsightsOverview({
      tenantId: "00000000-0000-4000-8000-000000000001",
      tenantUserId: "00000000-0000-4000-8000-000000000002",
      userId: "00000000-0000-4000-8000-000000000003",
      branchIds: []
    });
    expect(result.summary.avgWeeklyVisits).toBe(0);
    expect(result.summary.classOccupancyRate).toBe(0);
    expect(result.retentionCohorts).toEqual([]);
    expect(result.leadFunnel.every((stage) => stage.count === 0)).toBe(true);
    expect(result.occupancyHeatmap.every((point) => point.sessionCount === 0)).toBe(true);
  });
});
