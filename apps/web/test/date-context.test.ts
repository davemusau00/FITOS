import { afterEach, describe, expect, it, vi } from "vitest";
import { todayDate } from "../src/lib/date-context";

describe("todayDate", () => {
  afterEach(() => vi.useRealTimers());

  it("returns an ISO calendar date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-28T12:00:00"));
    expect(todayDate()).toMatch(/^2026-08-28$/);
  });
});
