import { Injectable } from "@nestjs/common";
import { DomainError } from "../errors/domain-error.js";

interface Counter {
  count: number;
  resetAt: number;
}

/** Deliberately small in-process limiter for the memory/dev adapter.
 * Production should replace this with a Redis-backed implementation. */
@Injectable()
export class RateLimitService {
  private readonly counters = new Map<string, Counter>();

  consume(key: string, limit: number, windowMs: number): void {
    const current = Date.now();
    const counter = this.counters.get(key);
    if (!counter || counter.resetAt <= current) {
      this.counters.set(key, { count: 1, resetAt: current + windowMs });
      return;
    }
    counter.count += 1;
    if (counter.count > limit) {
      throw new DomainError("RATE_LIMITED", "Please wait before trying again.", 429);
    }
  }
}
