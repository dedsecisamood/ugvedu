/**
 * Shared domain constants for the University Student Portal.
 * Keep grade math + color mappings in ONE place — never inline in components.
 */

export type LetterGrade = "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "C-" | "D" | "F";

/** Standard 4.0 GPA scale used across the portal. */
export const GRADE_POINTS: Record<LetterGrade, number> = {
  A: 4.0,
  "A-": 3.7,
  "B+": 3.3,
  B: 3.0,
  "B-": 2.7,
  "C+": 2.3,
  C: 2.0,
  "C-": 1.7,
  D: 1.0,
  F: 0.0,
};

/**
 * Maps each letter grade to a semantic CSS token name.
 * Consume as `text-grade-a`, `bg-grade-f`, etc. — the token is defined in src/styles.css.
 */
export const GRADE_COLOR_TOKEN: Record<LetterGrade, string> = {
  A: "grade-a",
  "A-": "grade-a-minus",
  "B+": "grade-b",
  B: "grade-b",
  "B-": "grade-b-minus",
  "C+": "grade-c",
  C: "grade-c",
  "C-": "grade-c",
  D: "grade-d",
  F: "grade-f",
};

export const APP_NAME = "University of Global Village, Barishal";
export const APP_SHORT = "UGV Portal";

export const ROLES = ["student", "department_head", "admin"] as const;
export type AppRole = (typeof ROLES)[number];
