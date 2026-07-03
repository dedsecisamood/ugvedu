import { describe, it, expect } from "vitest";
import {
  calculateSemesterResult,
  calculateCGPA,
  isSemesterBlocked,
  type EnrollmentInput,
  type SemesterInput,
} from "./gpa-engine";

const enroll = (over: Partial<EnrollmentInput> = {}): EnrollmentInput => ({
  enrollmentId: "e-" + Math.random().toString(36).slice(2, 8),
  credits: 3,
  gradePoint: 3.5,
  letterGrade: "A-",
  isIncomplete: false,
  status: "COMPLETED",
  ...over,
});

describe("isSemesterBlocked", () => {
  it("is not blocked when everyone passes", () => {
    expect(isSemesterBlocked([enroll(), enroll()]).blocked).toBe(false);
  });
  it("is blocked by a single F", () => {
    const r = isSemesterBlocked([enroll(), enroll({ letterGrade: "F", gradePoint: 0 })]);
    expect(r.blocked).toBe(true);
    expect(r.reason).toMatch(/Please immediate contact to Department Head/);
  });
  it("is blocked by a single Incomplete", () => {
    expect(
      isSemesterBlocked([enroll(), enroll({ isIncomplete: true, gradePoint: null, letterGrade: "I" })])
        .blocked,
    ).toBe(true);
  });
  it("is blocked by F + I combined", () => {
    const r = isSemesterBlocked([
      enroll(),
      enroll({ letterGrade: "F", gradePoint: 0 }),
      enroll({ isIncomplete: true, letterGrade: "I", gradePoint: null }),
    ]);
    expect(r.blocked).toBe(true);
    expect(r.reason).toMatch(/\(F\)/);
    expect(r.reason).toMatch(/\(I\)/);
  });
  it("ignores RETAKE archives when deciding blocked-ness", () => {
    // Original attempt is F but archived (RETAKE). New attempt passes. Not blocked.
    const r = isSemesterBlocked([
      enroll({ enrollmentId: "orig", letterGrade: "F", gradePoint: 0, status: "RETAKE" }),
      enroll({ enrollmentId: "new", letterGrade: "B", gradePoint: 3.0 }),
    ]);
    expect(r.blocked).toBe(false);
  });
});

describe("calculateSemesterResult", () => {
  it("all-pass semester: computes SGPA with 2dp rounding", () => {
    // 3 credits × 4.0 + 3 × 3.5 + 2 × 3.0 = 12 + 10.5 + 6 = 28.5; /8 = 3.5625 → 3.56
    const r = calculateSemesterResult({
      semesterId: "s1",
      enrollments: [
        enroll({ credits: 3, gradePoint: 4.0 }),
        enroll({ credits: 3, gradePoint: 3.5 }),
        enroll({ credits: 2, gradePoint: 3.0 }),
      ],
    });
    expect(r.status).toBe("GENERATED");
    expect(r.sgpa).toBe("3.56");
    expect(r.totalCredits).toBe("8");
  });

  it("single F blocks the semester and SGPA is null", () => {
    const r = calculateSemesterResult({
      semesterId: "s1",
      enrollments: [enroll(), enroll({ letterGrade: "F", gradePoint: 0 })],
    });
    expect(r.status).toBe("BLOCKED");
    expect(r.sgpa).toBeNull();
    expect(r.blockedReason).toMatch(/F \(Fail\) or I \(Incomplete\)/);
  });

  it("single Incomplete blocks the semester", () => {
    const r = calculateSemesterResult({
      semesterId: "s1",
      enrollments: [enroll(), enroll({ isIncomplete: true, letterGrade: "I", gradePoint: null })],
    });
    expect(r.status).toBe("BLOCKED");
    expect(r.sgpa).toBeNull();
  });

  it("F + I combined still blocks (once)", () => {
    const r = calculateSemesterResult({
      semesterId: "s1",
      enrollments: [
        enroll({ letterGrade: "F", gradePoint: 0 }),
        enroll({ isIncomplete: true, letterGrade: "I", gradePoint: null }),
      ],
    });
    expect(r.status).toBe("BLOCKED");
  });

  it("empty semester (no enrollments) returns EMPTY, never divides by zero", () => {
    const r = calculateSemesterResult({ semesterId: "s1", enrollments: [] });
    expect(r.status).toBe("EMPTY");
    expect(r.sgpa).toBeNull();
    expect(r.totalCredits).toBe("0");
  });

  it("zero-credit-only semester (audit courses) does not divide by zero", () => {
    const r = calculateSemesterResult({
      semesterId: "s1",
      enrollments: [enroll({ credits: 0, gradePoint: 4.0 })],
    });
    expect(r.status).toBe("EMPTY");
    expect(r.sgpa).toBeNull();
  });

  it("retake REPLACE policy: archived F is excluded, new grade counts", () => {
    const r = calculateSemesterResult({
      semesterId: "s1",
      enrollments: [
        // Archived original F — excluded.
        enroll({ enrollmentId: "orig", credits: 3, letterGrade: "F", gradePoint: 0, status: "RETAKE" }),
        // Fresh retake attempt — B (3.0)
        enroll({ enrollmentId: "new", credits: 3, letterGrade: "B", gradePoint: 3.0 }),
        enroll({ credits: 3, gradePoint: 4.0 }),
      ],
    });
    expect(r.status).toBe("GENERATED");
    // (3×3.0 + 3×4.0) / 6 = 21/6 = 3.50
    expect(r.sgpa).toBe("3.50");
    expect(r.countedEnrollmentIds).not.toContain("orig");
    expect(r.countedEnrollmentIds).toContain("new");
  });

  it("rounding: value exactly at .xx5 rounds half-up", () => {
    // 3 × 3.335 = 10.005 / 3 = 3.335 → 3.34 (half-up)
    const r = calculateSemesterResult({
      semesterId: "s1",
      enrollments: [enroll({ credits: 3, gradePoint: "3.335" })],
    });
    expect(r.sgpa).toBe("3.34");
  });

  it("rounding: bankers-style edge — 3.125 → 3.13", () => {
    // 1 × 3.125 / 1 = 3.125 → 3.13 (half-up)
    const r = calculateSemesterResult({
      semesterId: "s1",
      enrollments: [enroll({ credits: 1, gradePoint: "3.125" })],
    });
    expect(r.sgpa).toBe("3.13");
  });

  it("is idempotent: same input => same output on repeated calls", () => {
    const input: SemesterInput = {
      semesterId: "s1",
      enrollments: [
        enroll({ credits: 3, gradePoint: 4.0 }),
        enroll({ credits: 3, gradePoint: 3.5 }),
        enroll({ credits: 2, gradePoint: 3.0 }),
      ],
    };
    const a = calculateSemesterResult(input);
    const b = calculateSemesterResult(input);
    expect(a).toEqual(b);
  });
});

describe("calculateCGPA", () => {
  it("skips blocked semesters — clean semester still gets a valid CGPA", () => {
    const clean: SemesterInput = {
      semesterId: "s1",
      enrollments: [
        enroll({ credits: 3, gradePoint: 4.0 }),
        enroll({ credits: 3, gradePoint: 3.0 }),
      ],
    };
    const blocked: SemesterInput = {
      semesterId: "s2",
      enrollments: [
        enroll({ credits: 3, gradePoint: 4.0 }),
        enroll({ letterGrade: "F", gradePoint: 0, credits: 3 }),
      ],
    };
    const r = calculateCGPA([clean, blocked]);
    // Only s1 contributes: (12 + 9) / 6 = 21/6 = 3.50
    expect(r.cgpa).toBe("3.50");
    expect(r.countedSemesterIds).toEqual(["s1"]);
    expect(r.totalCredits).toBe("6");
  });

  it("returns null CGPA when every semester is blocked", () => {
    const blocked: SemesterInput = {
      semesterId: "s1",
      enrollments: [enroll({ letterGrade: "F", gradePoint: 0 })],
    };
    const r = calculateCGPA([blocked]);
    expect(r.cgpa).toBeNull();
    expect(r.countedSemesterIds).toEqual([]);
  });

  it("aggregates across multiple clean semesters correctly", () => {
    const s1: SemesterInput = {
      semesterId: "s1",
      enrollments: [
        enroll({ credits: 3, gradePoint: 4.0 }),
        enroll({ credits: 3, gradePoint: 3.0 }),
      ], // 21 / 6
    };
    const s2: SemesterInput = {
      semesterId: "s2",
      enrollments: [enroll({ credits: 4, gradePoint: 3.5 })], // 14 / 4
    };
    // Total: (21 + 14) / (6 + 4) = 35/10 = 3.50
    expect(calculateCGPA([s1, s2]).cgpa).toBe("3.50");
  });
});
