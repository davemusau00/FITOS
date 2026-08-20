import { createServer, type Server } from "node:http";

export type WorkerOutcome = "completed" | "failed" | "stalled";

export class WorkerMetrics {
  private readonly counters: Record<WorkerOutcome, number> = {
    completed: 0,
    failed: 0,
    stalled: 0
  };
  private readonly activeJobIds = new Set<string>();
  private lastFailureAtSeconds = 0;

  active(jobId: string): void {
    this.activeJobIds.add(jobId);
  }

  complete(jobId: string, outcome: WorkerOutcome): void {
    this.activeJobIds.delete(jobId);
    this.counters[outcome] += 1;
    if (outcome === "failed") this.lastFailureAtSeconds = Date.now() / 1_000;
  }

  render(release: string, redisReady: boolean): string {
    return `${[
      "# HELP fitos_worker_build_info FITOS worker deployed release information.",
      "# TYPE fitos_worker_build_info gauge",
      `fitos_worker_build_info{release="${escapeLabel(release)}"} 1`,
      "# HELP fitos_worker_redis_ready Whether the worker Redis connection is ready.",
      "# TYPE fitos_worker_redis_ready gauge",
      `fitos_worker_redis_ready ${redisReady ? 1 : 0}`,
      "# HELP fitos_worker_active_jobs Number of jobs currently being processed.",
      "# TYPE fitos_worker_active_jobs gauge",
      `fitos_worker_active_jobs ${this.activeJobIds.size}`,
      "# HELP fitos_worker_jobs_total Total worker jobs by terminal outcome.",
      "# TYPE fitos_worker_jobs_total counter",
      ...Object.entries(this.counters).map(
        ([outcome, count]) => `fitos_worker_jobs_total{outcome="${outcome}"} ${count}`
      ),
      "# HELP fitos_worker_last_failure_timestamp_seconds Unix timestamp of the last failed job.",
      "# TYPE fitos_worker_last_failure_timestamp_seconds gauge",
      `fitos_worker_last_failure_timestamp_seconds ${this.lastFailureAtSeconds}`
    ].join("\n")}\n`;
  }
}

export function startWorkerMetricsServer(input: {
  port: number;
  release: string;
  metrics: WorkerMetrics;
  redisReady: () => boolean;
}): Server {
  return createServer((request, response) => {
    if (request.url === "/health/live") {
      const ready = input.redisReady();
      response.writeHead(ready ? 200 : 503, { "content-type": "application/json" });
      response.end(JSON.stringify({ status: ready ? "ok" : "degraded", release: input.release }));
      return;
    }
    if (request.url === "/metrics") {
      response.writeHead(200, { "content-type": "text/plain; version=0.0.4; charset=utf-8" });
      response.end(input.metrics.render(input.release, input.redisReady()));
      return;
    }
    response.writeHead(404).end();
  }).listen(input.port, "0.0.0.0");
}

function escapeLabel(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/"/g, '\\"');
}
