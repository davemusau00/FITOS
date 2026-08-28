import { afterEach, describe, expect, it, vi } from "vitest";
import { localDayBounds, todayDate } from "../src/lib/date-context";

describe("todayDate", () => {
  afterEach(() => vi.useRealTimers());

  it("returns an ISO calendar date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-28T12:00:00"));
    expect(todayDate()).toMatch(/^2026-08-28$/);
  });
});

describe("localDayBounds", () => {
  it("covers exactly one local calendar day", () => {
    const bounds = localDayBounds("2026-08-28");
    expect(new Date(bounds.to).getTime() - new Date(bounds.from).getTime()).toBe(
      24 * 60 * 60 * 1000 - 1
    );
  });
});
