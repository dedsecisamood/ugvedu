/**
 * GPA calculation engine — pure functions.
 *
 * Rules:
 *  1. A semester is BLOCKED if ANY enrolled course in it has
 *     letterGrade = "F" OR isIncomplete = true. Blocked semesters have
 *     SGPA = null and never contribute to CGPA.
 *  2. SGPA = Σ(gradePoint × credits) / Σ(credits), rounded HALF_UP to 2 dp.
 *  3. CGPA = Σ(gradePoint × credits) / Σ(credits) across ALL enrollments
 *     that belong to NON-blocked semesters. Blocked semesters contribute
 *     zero rows; they do not zero out other semesters.
 *  4. Retake policy: REPLACE — an enrollment with status = "RETAKE" is an
 *     archived original attempt and is EXCLUDED from every calculation.
 *     The new attempt lives as a fresh row and is counted normally.
 *  5. Pure and idempotent — no DB, no I/O, no clock reads. Same input =>
 *     same output, always.
 *
 * All arithmetic goes through decimal.js. Native JS float math is never
 * used for grade points or credits.
 */
import Decimal from "decimal.js";

// Half-up rounding for a "1234 => 12.35" style banker-safe user display.
Decimal.set({ rounding: Decimal.ROUND_HALF_UP });

export type EnrollmentStatus = "ENROLLED" | "COMPLETED" | "RETAKE" | "DROPPED";

export interface EnrollmentInput {
  /** Stable identity — used only by callers for logging; the engine never dereferences it. */
  enrollmentId: string;
  /** Course credits. Decimal-safe string ("3", "1.5") or number. */
  credits: number | string;
  /** Grade point on the 4.00 scale, or null for I/incomplete. */
  gradePoint: number | string | null;
  /** Letter grade string ("A", "B+", "F", "I", ...). */
  letterGrade: string | null;
  /** true iff this enrollment is flagged incomplete. */
  isIncomplete: boolean;
  /** Enrollment lifecycle status. RETAKE rows are archived originals; excluded. */
  status: EnrollmentStatus;
}

export interface SemesterInput {
  semesterId: string;
  enrollments: EnrollmentInput[];
}

export interface SemesterResult {
  semesterId: string;
  status: "GENERATED" | "BLOCKED" | "EMPTY";
  /** SGPA as a Decimal-formatted string with exactly 2 dp, or null when blocked/empty. */
  sgpa: string | null;
  /** Total credits counted in the SGPA numerator/denominator, as a string. */
  totalCredits: string;
  blockedReason: string | null;
  /** Enrollments that were actually counted (RETAKE archives excluded). */
  countedEnrollmentIds: string[];
}

export interface CGPAResult {
  cgpa: string | null;         // 2 dp string, or null when no counted credits
  totalCredits: string;        // total credits from all non-blocked semesters
  countedSemesterIds: string[];
}

// -----------------------------------------------------------------------------
// isSemesterBlocked
// -----------------------------------------------------------------------------
/**
 * A semester is blocked when any COUNTED enrollment (i.e. not a RETAKE
 * archive and not DROPPED) is F or Incomplete.
 */
export function isSemesterBlocked(enrollments: EnrollmentInput[]): {
  blocked: boolean;
  reason: string | null;
} {
  const counted = enrollments.filter(isCounted);
  const offenders = counted.filter(
    (e) => e.isIncomplete || (e.letterGrade ?? "").toUpperCase() === "F",
  );
  if (offenders.length === 0) return { blocked: false, reason: null };

  const codes = offenders
    .map((e) => (e.isIncomplete ? `${e.enrollmentId} (I)` : `${e.enrollmentId} (F)`))
    .join(", ");
  return {
    blocked: true,
    reason:
      "The result was not generated due to F (Fail) or I (Incomplete) of the " +
      `mentioned subject. Please immediate contact to Department Head. [${codes}]`,
  };
}

// -----------------------------------------------------------------------------
// calculateSemesterResult
// -----------------------------------------------------------------------------
export function calculateSemesterResult(input: SemesterInput): SemesterResult {
  const counted = input.enrollments.filter(isCounted);

  // Empty semester — no enrollments to score. Return EMPTY, never NaN.
  if (counted.length === 0) {
    return {
      semesterId: input.semesterId,
      status: "EMPTY",
      sgpa: null,
      totalCredits: "0",
      blockedReason: null,
      countedEnrollmentIds: [],
    };
  }

  const { blocked, reason } = isSemesterBlocked(input.enrollments);
  const countedIds = counted.map((e) => e.enrollmentId);

  if (blocked) {
    return {
      semesterId: input.semesterId,
      status: "BLOCKED",
      sgpa: null,
      totalCredits: sumCredits(counted).toString(),
      blockedReason: reason,
      countedEnrollmentIds: countedIds,
    };
  }

  const totalCredits = sumCredits(counted);
  if (totalCredits.isZero()) {
    // Zero-credit-only semester (e.g. all audit courses) — never divide by zero.
    return {
      semesterId: input.semesterId,
      status: "EMPTY",
      sgpa: null,
      totalCredits: "0",
      blockedReason: null,
      countedEnrollmentIds: countedIds,
    };
  }

  const weighted = counted.reduce(
    (acc, e) => acc.plus(new Decimal(e.gradePoint ?? 0).times(new Decimal(e.credits))),
    new Decimal(0),
  );
  const sgpa = weighted.dividedBy(totalCredits).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

  return {
    semesterId: input.semesterId,
    status: "GENERATED",
    sgpa: sgpa.toFixed(2),
    totalCredits: totalCredits.toString(),
    blockedReason: null,
    countedEnrollmentIds: countedIds,
  };
}

// -----------------------------------------------------------------------------
// calculateCGPA
// -----------------------------------------------------------------------------
/**
 * Aggregate across all semesters that produced a non-blocked, non-empty result.
 * Blocked semesters contribute nothing (per spec). No F/I from a blocked
 * semester leaks into the CGPA.
 */
export function calculateCGPA(semesters: SemesterInput[]): CGPAResult {
  const nonBlocked: EnrollmentInput[] = [];
  const countedSemesterIds: string[] = [];

  for (const s of semesters) {
    const r = calculateSemesterResult(s);
    if (r.status !== "GENERATED") continue;
    countedSemesterIds.push(s.semesterId);
    nonBlocked.push(...s.enrollments.filter(isCounted));
  }

  const totalCredits = sumCredits(nonBlocked);
  if (totalCredits.isZero()) {
    return { cgpa: null, totalCredits: "0", countedSemesterIds };
  }

  const weighted = nonBlocked.reduce(
    (acc, e) => acc.plus(new Decimal(e.gradePoint ?? 0).times(new Decimal(e.credits))),
    new Decimal(0),
  );
  const cgpa = weighted.dividedBy(totalCredits).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
  return { cgpa: cgpa.toFixed(2), totalCredits: totalCredits.toString(), countedSemesterIds };
}

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------
function isCounted(e: EnrollmentInput): boolean {
  // RETAKE = archived original attempt (REPLACE policy). DROPPED = never counted.
  return e.status !== "RETAKE" && e.status !== "DROPPED";
}

function sumCredits(list: EnrollmentInput[]): Decimal {
  return list.reduce((acc, e) => acc.plus(new Decimal(e.credits)), new Decimal(0));
}
