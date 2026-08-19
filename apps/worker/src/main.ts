import "reflect-metadata";
import { Worker } from "bullmq";
import { Redis } from "ioredis";
import { z } from "zod";
import { WORKER_QUEUE, workerJobSchema } from "./jobs.js";
import { processOperationsJob } from "./processors/operations.processor.js";

const config = z
  .object({
    REDIS_URL: z.string().url(),
    LOG_LEVEL: z.string().default("info")
  })
  .parse(process.env);

const connection = new Redis(config.REDIS_URL, { maxRetriesPerRequest: null });
const worker = new Worker(
  WORKER_QUEUE,
  async (job) => processOperationsJob(workerJobSchema.parse(job.data)),
  { connection, concurrency: 10 }
);

worker.on("completed", (job) => {
  process.stdout.write(JSON.stringify({ event: "worker.completed", jobId: job.id, name: job.name }) + "\n");
});
worker.on("failed", (job, error) => {
  process.stderr.write(JSON.stringify({ event: "worker.failed", jobId: job?.id, message: error.message }) + "\n");
});

async function shutdown(signal: string) {
  process.stdout.write(JSON.stringify({ event: "worker.shutdown", signal }) + "\n");
  await worker.close();
  await connection.quit();
}

process.once("SIGINT", () => void shutdown("SIGINT"));
process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.stdout.write(JSON.stringify({ event: "worker.ready", queue: WORKER_QUEUE }) + "\n");
