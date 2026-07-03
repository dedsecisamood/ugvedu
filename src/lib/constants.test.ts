import { describe, it, expect } from "vitest";
import { GRADE_POINTS, GRADE_COLOR_TOKEN, ROLES, APP_NAME, APP_SHORT } from "./constants";

describe("GRADE_POINTS", () => {
  it("maps every letter grade to a numeric point in [0,4]", () => {
    for (const [letter, gp] of Object.entries(GRADE_POINTS)) {
      expect(typeof gp).toBe("number");
      expect(gp).toBeGreaterThanOrEqual(0);
      expect(gp).toBeLessThanOrEqual(4);
      expect(Number.isFinite(gp)).toBe(true);
      expect(letter.length).toBeGreaterThan(0);
    }
  });
  it("F is worth zero", () => {
    expect(GRADE_POINTS.F).toBe(0);
  });
  it("A is worth 4.0", () => {
    expect(GRADE_POINTS.A).toBe(4.0);
  });
  it("is monotonically non-increasing A > A- > B+ > B", () => {
    expect(GRADE_POINTS.A).toBeGreaterThan(GRADE_POINTS["A-"]);
    expect(GRADE_POINTS["A-"]).toBeGreaterThan(GRADE_POINTS["B+"]);
    expect(GRADE_POINTS["B+"]).toBeGreaterThan(GRADE_POINTS.B);
  });
});

describe("GRADE_COLOR_TOKEN", () => {
  it("has a token for every graded letter", () => {
    for (const letter of Object.keys(GRADE_POINTS)) {
      expect(GRADE_COLOR_TOKEN[letter as keyof typeof GRADE_COLOR_TOKEN]).toBeTruthy();
    }
  });
});

describe("ROLES + branding", () => {
  it("exposes exactly the three app roles", () => {
    expect([...ROLES].sort()).toEqual(["admin", "department_head", "student"]);
  });
  it("exposes app name constants", () => {
    expect(APP_NAME).toMatch(/University/);
    expect(APP_SHORT.length).toBeGreaterThan(0);
  });
});
