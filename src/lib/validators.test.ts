import { describe, it, expect } from "vitest";
import {
  uuidSchema,
  emailSchema,
  passwordSchema,
  roleSchema,
  studentIdSchema,
  paginationSchema,
} from "./validators";

describe("uuidSchema", () => {
  it("accepts a v4 uuid", () => {
    expect(uuidSchema.safeParse("11111111-1111-4111-8111-111111111111").success).toBe(true);
  });
  it("rejects a non-uuid string", () => {
    expect(uuidSchema.safeParse("not-a-uuid").success).toBe(false);
  });
});

describe("emailSchema", () => {
  it("accepts a plain email", () => {
    expect(emailSchema.safeParse("student@ugv.edu.bd").success).toBe(true);
  });
  it("rejects a malformed email", () => {
    expect(emailSchema.safeParse("nope@").success).toBe(false);
  });
  it("rejects an email longer than 320 chars", () => {
    const long = "a".repeat(315) + "@x.io";
    expect(emailSchema.safeParse(long).success).toBe(false);
  });
});

describe("passwordSchema", () => {
  it("requires >= 8 chars", () => {
    expect(passwordSchema.safeParse("short").success).toBe(false);
  });
  it("accepts an 8-char password", () => {
    expect(passwordSchema.safeParse("password").success).toBe(true);
  });
  it("rejects > 128 chars", () => {
    expect(passwordSchema.safeParse("x".repeat(129)).success).toBe(false);
  });
});

describe("roleSchema", () => {
  it("accepts each known role", () => {
    for (const r of ["student", "department_head", "admin"] as const) {
      expect(roleSchema.safeParse(r).success).toBe(true);
    }
  });
  it("rejects unknown role", () => {
    expect(roleSchema.safeParse("superuser").success).toBe(false);
  });
});

describe("studentIdSchema", () => {
  it("accepts 12521076", () => {
    expect(studentIdSchema.safeParse("12521076").success).toBe(true);
  });
  it("accepts hyphenated IDs", () => {
    expect(studentIdSchema.safeParse("CSE-2025-01").success).toBe(true);
  });
  it("rejects IDs with disallowed punctuation", () => {
    expect(studentIdSchema.safeParse("abc/123").success).toBe(false);
  });
  it("rejects too-short IDs", () => {
    expect(studentIdSchema.safeParse("abc").success).toBe(false);
  });
});

describe("paginationSchema", () => {
  it("defaults page and pageSize", () => {
    const r = paginationSchema.parse({});
    expect(r).toEqual({ page: 1, pageSize: 20 });
  });
  it("coerces string numbers", () => {
    const r = paginationSchema.parse({ page: "3", pageSize: "50" });
    expect(r).toEqual({ page: 3, pageSize: 50 });
  });
  it("rejects pageSize > 100", () => {
    expect(paginationSchema.safeParse({ pageSize: 101 }).success).toBe(false);
  });
  it("rejects page < 1", () => {
    expect(paginationSchema.safeParse({ page: 0 }).success).toBe(false);
  });
});
