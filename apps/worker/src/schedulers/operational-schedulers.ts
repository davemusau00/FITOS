import type { Queue } from "bullmq";
import type { WorkerJob } from "../jobs.js";

/** Scheduled operational jobs are registered here as the relevant modules ship.
 * No recurring customer communication is enabled by default. */
export async function registerOperationalSchedulers(_queue: Queue<WorkerJob>): Promise<void> {
  // Membership expiry and booking reminders require their owning domain tables.
}
