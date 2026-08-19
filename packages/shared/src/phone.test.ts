import { describe, expect, it } from "vitest";
import { normalizePhone } from "./phone.js";

describe("normalizePhone", () => {
  it("normalizes common Kenyan mobile formats", () => {
    expect(normalizePhone("0712 345 678")).toBe("+254712345678");
    expect(normalizePhone("254712345678")).toBe("+254712345678");
    expect(normalizePhone("+254712345678")).toBe("+254712345678");
  });

  it("rejects ambiguous local formats", () => {
    expect(normalizePhone("712345678")).toBeNull();
  });
});
