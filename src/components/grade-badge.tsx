/**
 * Grade badge — semantic color scale from design tokens.
 *
 * Accessibility: the letter text is ALWAYS present alongside color; color is
 * never the sole signal. Includes an aria-label spelling out the meaning.
 */
import { cn } from "@/lib/utils";

const GRADE_META: Record<string, { bg: string; label: string }> = {
  "A":  { bg: "bg-grade-a",        label: "Excellent" },
  "A-": { bg: "bg-grade-a-minus",  label: "Very good" },
  "B+": { bg: "bg-grade-b",        label: "Good" },
  "B":  { bg: "bg-grade-b",        label: "Good" },
  "B-": { bg: "bg-grade-b-minus",  label: "Above average" },
  "C+": { bg: "bg-grade-c",        label: "Average" },
  "C":  { bg: "bg-grade-c",        label: "Average" },
  "D":  { bg: "bg-grade-d",        label: "Pass" },
  "F":  { bg: "bg-grade-f",        label: "Fail" },
  "I":  { bg: "bg-grade-f",        label: "Incomplete" },
};

export function GradeBadge({ letter, className }: { letter: string | null | undefined; className?: string }) {
  const key = (letter ?? "").toUpperCase();
  const meta = GRADE_META[key];
  if (!meta) {
    return (
      <span
        className={cn(
          "inline-flex min-w-9 items-center justify-center rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground",
          className,
        )}
        aria-label="Grade not available"
      >
        —
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex min-w-9 items-center justify-center rounded-md px-2 py-0.5 text-xs font-bold text-grade-foreground shadow-sm",
        meta.bg,
        className,
      )}
      aria-label={`Grade ${key} — ${meta.label}`}
    >
      {key}
    </span>
  );
}
