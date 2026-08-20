import { describe, expect, it } from "vitest";
import { MetricsService, normalizeMetricPath } from "../src/common/metrics/metrics.service.js";

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
