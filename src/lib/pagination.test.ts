import { describe, it, expect } from "vitest";
import { encodeCursor, decodeCursor, cursorSchema, pageSizeSchema } from "./pagination";

describe("cursor encode/decode", () => {
  it("round-trips a row", () => {
    const c = encodeCursor({ created_at: "2025-01-02T03:04:05.000Z", id: "abc-123" });
    expect(decodeCursor(c)).toEqual({ createdAt: "2025-01-02T03:04:05.000Z", id: "abc-123" });
  });

  it("returns null for empty/undefined input", () => {
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor("")).toBeNull();
  });

  it("returns null for malformed base64", () => {
    expect(decodeCursor("!!not-base64!!")).toBeNull();
  });

  it("returns null when JSON does not match shape", () => {
    const bad = Buffer.from(JSON.stringify({ foo: "bar" })).toString("base64url");
    expect(decodeCursor(bad)).toBeNull();
  });

  it("returns null when createdAt is not parseable", () => {
    const bad = Buffer.from(JSON.stringify({ createdAt: "notadate", id: "x" })).toString("base64url");
    expect(decodeCursor(bad)).toBeNull();
  });
});

describe("cursorSchema / pageSizeSchema", () => {
  it("cursor accepts undefined", () => {
    expect(cursorSchema.safeParse(undefined).success).toBe(true);
  });
  it("cursor rejects > 512 chars", () => {
    expect(cursorSchema.safeParse("x".repeat(513)).success).toBe(false);
  });
  it("pageSize defaults to 20", () => {
    expect(pageSizeSchema.parse(undefined)).toBe(20);
  });
  it("pageSize coerces strings and caps at 100", () => {
    expect(pageSizeSchema.parse("50")).toBe(50);
    expect(pageSizeSchema.safeParse(101).success).toBe(false);
  });
});
