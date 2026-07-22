/**
 * Results page — wired to the pure GPA engine via getStudentResultsDetail.
 *
 * Reference-matching layout:
 *   - "ACADEMIC PERFORMANCE" crumb, "My Results" H1
 *   - Stat row: Entries / CGPA / Semesters
 *   - Context chips: student, department, current semester (read-only)
 *   - Per-semester result cards, newest first
 *   - Blocked semesters: red warning banner naming the blocking course(s)
 *   - Grades table: Code, Course, CR, Grade, GPA — F rows show "—" GPA
 *   - Older semesters (>= 3rd from newest) render collapsed by default
 */
import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { AlertTriangle, ChevronDown, ChevronUp, GraduationCap, ListChecks, CalendarRange, User, Building2 } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { EmptyState } from "@/components/state/empty-state";
import { GradeBadge } from "@/components/grade-badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { getStudentResultsDetail, type ResultsSemester } from "@/lib/results-detail.functions";

const resultsQuery = queryOptions({
  queryKey: ["results", "self"],
  queryFn: () => getStudentResultsDetail({ data: {} }),
});

export const Route = createFileRoute("/_authenticated/results")({
  component: ResultsPage,
  head: () => ({ meta: [{ title: `My Results — ${APP_NAME}` }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(resultsQuery),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader crumb="Academic Performance" title="My Results" />
      <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm">
        We couldn't load your results. {error.message}
      </div>
    </div>
  ),
});

function Chip({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs">
      <span className="grid size-5 place-items-center rounded-full bg-muted text-muted-foreground">{icon}</span>
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

function ResultsPage() {
  const { data } = useSuspenseQuery(resultsQuery);

  if (!data.student) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader crumb="Academic Performance" title="My Results" />
        <EmptyState title="No student profile" description="Your account is not linked to a student record." />
      </div>
    );
  }

  const { student, cgpa, totalEntries, semesterCount, semesters } = data;
  const blockedSems = semesters.filter((s) => s.status === "BLOCKED");

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        crumb="Academic Performance"
        title="My Results"
        subtitle="Semester-wise breakdown, SGPA, and CGPA."
      />

      {blockedSems.length > 0 && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/40 bg-destructive text-destructive-foreground p-4 shadow-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div className="text-sm">
            <p className="font-semibold">Academic alert — result withheld</p>
            <p className="mt-1 opacity-90">
              F or I grade found in {blockedSems.map((s) => s.semesterName).join(", ")}. CGPA is
              unavailable until resolved. Please contact your Department Head immediately.
            </p>
          </div>
        </div>
      )}


      <section aria-label="Summary" className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Entries" value={String(totalEntries)} hint="Course records" icon={<ListChecks className="size-5" aria-hidden />} />
        <StatCard
          label="CGPA"
          value={cgpa ?? "—"}
          hint={cgpa ? "Cumulative" : "Hidden while a semester is blocked"}
          accent="gold"
          icon={<GraduationCap className="size-5" aria-hidden />}
        />
        <StatCard label="Semesters" value={String(semesterCount)} hint="With records" accent="navy" icon={<CalendarRange className="size-5" aria-hidden />} />
      </section>

      <div className="flex flex-wrap items-center gap-2" aria-label="Context">
        <Chip icon={<User className="size-3" aria-hidden />} label="Student" value={`${student.fullName} · ${student.studentId}`} />
        {student.departmentName && (
          <Chip icon={<Building2 className="size-3" aria-hidden />} label="Department" value={student.departmentName} />
        )}
        {student.currentSemesterName && (
          <Chip icon={<CalendarRange className="size-3" aria-hidden />} label="Current" value={`${student.currentSemesterName} semester`} />
        )}
      </div>

      {semesters.length === 0 ? (
        <EmptyState title="No results yet" description="Once grades are published, your semester results appear here." />
      ) : (
        <div className="space-y-5">
          {semesters.map((s, i) => (
            <SemesterCard key={s.semesterId} semester={s} defaultOpen={i < 2} />
          ))}
        </div>
      )}
    </div>
  );
}

function SemesterCard({ semester, defaultOpen }: { semester: ResultsSemester; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const isBlocked = semester.status === "BLOCKED";
  return (
    <Card className={cn(isBlocked && "border-destructive/40")}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className={cn(
              "grid size-11 place-items-center rounded-lg font-bold tabular-nums",
              isBlocked ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
            )}
          >
            {semester.ordinal}
          </span>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Semester results
            </p>
            <p className="text-sm font-semibold text-foreground">
              {semester.semesterName} · {semester.year} {semester.term}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {semester.courses.length} {semester.courses.length === 1 ? "subject" : "subjects"}
              </span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isBlocked ? (
            <Badge variant="destructive" className="uppercase tracking-wide">Result not generated</Badge>
          ) : semester.status === "GENERATED" && semester.sgpa ? (
            <Badge className="bg-gold text-primary-foreground hover:bg-gold">
              CGPA {semester.sgpa}
            </Badge>
          ) : (
            <Badge variant="outline">No data</Badge>
          )}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls={`sem-${semester.semesterId}`}
          >
            {open ? <ChevronUp className="size-4" aria-hidden /> : <ChevronDown className="size-4" aria-hidden />}
            <span className="sr-only">{open ? "Collapse" : "Expand"} semester</span>
          </Button>
        </div>
      </CardHeader>

      {open && (
        <CardContent id={`sem-${semester.semesterId}`} className="space-y-4">
          {isBlocked && (
            <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" aria-hidden />
                <div className="min-w-0">
                  <p className="font-medium text-foreground">
                    The result was not generated due to F (Fail) or I (Incomplete) of the mentioned subject.
                    Please immediately contact the Department Head.
                  </p>
                  {semester.blockingCourses.length > 0 && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Blocking:{" "}
                      {semester.blockingCourses.map((c, i) => (
                        <span key={c.code}>
                          <span className="font-mono font-medium text-foreground">{c.code}</span>{" "}
                          <span className="text-foreground">{c.title}</span>{" "}
                          <span className="text-destructive">({c.reason})</span>
                          {i < semester.blockingCourses.length - 1 ? ", " : ""}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-32">Code</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead className="w-16 text-right">CR</TableHead>
                  <TableHead className="w-24">Grade</TableHead>
                  <TableHead className="w-20 text-right">GPA</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {semester.courses.map((c) => (
                  <TableRow key={c.enrollmentId}>
                    <TableCell className="font-mono text-xs">{c.code}</TableCell>
                    <TableCell className="text-sm">{c.title}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.credits}</TableCell>
                    <TableCell><GradeBadge letter={c.letterGrade} /></TableCell>
                    <TableCell className="text-right tabular-nums">
                      {c.isFail || c.isIncomplete || c.gradePoint == null
                        ? "—"
                        : c.gradePoint.toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
