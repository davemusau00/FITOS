import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { z } from "zod";
import { WORKER_QUEUE, workerJobSchema } from "./jobs.js";
import { processOperationsJob } from "./processors/operations.processor.js";
import { startWorkerMetricsServer, WorkerMetrics } from "./metrics.js";

const config = z
  .object({
    REDIS_URL: z.string().url(),
    LOG_LEVEL: z.string().default("info"),
    FITOS_RELEASE_TAG: z.string().default("development"),
    WORKER_METRICS_PORT: z.coerce.number().int().min(1).max(65_535).default(9_464)
  })
  .parse(process.env);

const connection = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
const worker = new Worker(
  WORKER_QUEUE,
  async (job) => processOperationsJob(workerJobSchema.parse(job.data)),
  { connection, concurrency: 10 }
);
const metrics = new WorkerMetrics();
const metricsServer = startWorkerMetricsServer({
  port: config.WORKER_METRICS_PORT,
  release: config.FITOS_RELEASE_TAG,
  metrics,
  redisReady: () => connection.status === "ready"
});

worker.on("active", (job) => metrics.active(String(job.id ?? "unknown")));
worker.on("completed", (job) => {
  metrics.complete(String(job.id ?? "unknown"), "completed");
  process.stdout.write(
    JSON.stringify({ event: "worker.completed", jobId: job.id, name: job.name }) + "\n"
  );
});
worker.on("failed", (job, error) => {
  metrics.complete(String(job?.id ?? "unknown"), "failed");
  process.stderr.write(
    JSON.stringify({
      event: "worker.failed",
      jobId: job?.id,
      name: job?.name,
      attemptsMade: job?.attemptsMade,
      maxAttempts: job?.opts.attempts,
      exhausted: Boolean(job && job.attemptsMade >= (job.opts.attempts ?? 1)),
      message: error.message
    }) + "\n"
  );
});
worker.on("stalled", (jobId) => {
  metrics.complete(String(jobId), "stalled");
  process.stderr.write(JSON.stringify({ event: "worker.stalled", jobId }) + "\n");
});
worker.on("error", (error) => {
  process.stderr.write(JSON.stringify({ event: "worker.error", message: error.message }) + "\n");
});

async function shutdown(signal: string) {
  process.stdout.write(JSON.stringify({ event: "worker.shutdown", signal }) + "\n");
  await new Promise<void>((resolve, reject) =>
    metricsServer.close((error) => (error ? reject(error) : resolve()))
  );
  await worker.close();
  await connection.quit();
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.stdout.write(
  JSON.stringify({
    event: "worker.ready",
    queue: WORKER_QUEUE,
    release: config.FITOS_RELEASE_TAG
  }) + "\n"
);
