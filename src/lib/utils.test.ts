import { describe, it, expect } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("joins string classes", () => {
    expect(cn("a", "b")).toBe("a b");
  });
  it("filters falsy values", () => {
    expect(cn("a", false, null, undefined, "b")).toBe("a b");
  });
  it("deduplicates tailwind conflicts via twMerge (last wins)", () => {
    expect(cn("p-2", "p-4")).toBe("p-4");
  });
  it("handles conditional object syntax", () => {
    expect(cn({ a: true, b: false, c: true })).toBe("a c");
  });
});
