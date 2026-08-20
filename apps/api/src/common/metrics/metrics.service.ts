import { Injectable } from "@nestjs/common";

type RequestMetric = {
  count: number;
  durationSeconds: number;
};

export type RecordedRequest = {
  method: string;
  path: string;
  statusCode: number;
  durationMs: number;
};

@Injectable()
export class MetricsService {
  private readonly startedAtSeconds = Date.now() / 1_000;
  private readonly release = process.env.FITOS_RELEASE_TAG ?? "development";
  private readonly requests = new Map<string, RequestMetric>();
  private readonly recordedRequests = new WeakSet<object>();

  recordRequest(input: RecordedRequest): void {
    const method = input.method.toUpperCase();
    const path = normalizeMetricPath(input.path);
    const statusCode = String(input.statusCode);
    const key = JSON.stringify([method, path, statusCode]);
    const current = this.requests.get(key) ?? { count: 0, durationSeconds: 0 };
    current.count += 1;
    current.durationSeconds += input.durationMs / 1_000;
    this.requests.set(key, current);
  }

  recordRequestOnce(request: object, input: RecordedRequest): boolean {
    if (this.recordedRequests.has(request)) return false;
    this.recordedRequests.add(request);
    this.recordRequest(input);
    return true;
  }

  render(): string {
    const lines = [
      "# HELP fitos_build_info FITOS deployed release information.",
      "# TYPE fitos_build_info gauge",
      `fitos_build_info{release="${escapeLabel(this.release)}"} 1`,
      "# HELP fitos_process_start_time_seconds Start time of the API process since Unix epoch.",
      "# TYPE fitos_process_start_time_seconds gauge",
      `fitos_process_start_time_seconds ${this.startedAtSeconds}`,
      "# HELP fitos_http_requests_total Total completed HTTP requests.",
      "# TYPE fitos_http_requests_total counter",
      "# HELP fitos_http_request_duration_seconds Request duration summary by method, normalized path, and status.",
      "# TYPE fitos_http_request_duration_seconds summary"
    ];
    for (const [key, metric] of [...this.requests.entries()].sort(([left], [right]) =>
      left.localeCompare(right)
    )) {
      const [method, path, statusCode] = JSON.parse(key) as [string, string, string];
      const labels = `method="${escapeLabel(method)}",path="${escapeLabel(path)}",status_code="${escapeLabel(statusCode)}"`;
      lines.push(`fitos_http_requests_total{${labels}} ${metric.count}`);
      lines.push(`fitos_http_request_duration_seconds_sum{${labels}} ${metric.durationSeconds}`);
      lines.push(`fitos_http_request_duration_seconds_count{${labels}} ${metric.count}`);
    }
    return `${lines.join("\n")}\n`;
  }
}

export function normalizeMetricPath(value: string): string {
  const [path = "/"] = value.split("?");
  return path
    .replace(
      /\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?=\/|$)/gi,
      "/:id"
    )
    .replace(/\/\d+(?=\/|$)/g, "/:number");
}

function escapeLabel(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
}
