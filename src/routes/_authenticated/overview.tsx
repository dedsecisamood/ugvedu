/** Overview / dashboard landing. */
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import {
  BookOpen, GraduationCap, CalendarCheck, Bell, Wallet,
  AlertTriangle, ExternalLink, MapPin, Clock, Pin,
} from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { EmptyState } from "@/components/state/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getOverview } from "@/lib/overview.functions";

const overviewQuery = queryOptions({
  queryKey: ["overview"],
  queryFn: () => getOverview(),
});

export const Route = createFileRoute("/_authenticated/overview")({
  component: Overview,
  head: () => ({ meta: [{ title: `Overview — ${APP_NAME}` }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(overviewQuery),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader crumb="Dashboard" title="Overview" />
      <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm text-foreground">
        We couldn't load your dashboard. {error.message}
      </div>
    </div>
  ),
});

function fmtTime(t: string) {
  // "13:30:00" → "1:30 PM"
  const [hh, mm] = t.split(":");
  const h = parseInt(hh, 10);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${mm} ${suffix}`;
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const DAY_NAMES: Record<string, string> = {
  SUN: "Sunday", MON: "Monday", TUE: "Tuesday", WED: "Wednesday", THU: "Thursday", FRI: "Friday", SAT: "Saturday",
};

function Overview() {
  const { data } = useSuspenseQuery(overviewQuery);

  if (!data.student) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader crumb="Dashboard" title="Overview" />
        <EmptyState
          title="No student profile"
          description="Your account isn't linked to a student record yet. Contact the registrar's office."
        />
      </div>
    );
  }

  const { student, cgpa, latestSemester, credits, notices, todayClasses, todayCode, payments } = data;
  const creditsPct = credits.required ? Math.min(100, Math.round((credits.completed / credits.required) * 100)) : null;
  const isBlocked = latestSemester.status === "BLOCKED";

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        crumb="Dashboard"
        title={`Welcome, ${student.fullName.split(" ")[0]}`}
        subtitle={
          <>
            <span className="font-medium text-foreground">ID {student.studentId}</span>
            {student.programName && <> · {student.programName}</>}
            {student.currentSemesterName && <> · {student.currentSemesterName} semester</>}
          </>  as unknown as string
        }
      />

      {/* Blocked semester banner */}
      {isBlocked && (
        <div
          role="status"
          className="rounded-lg border border-amber-500/40 bg-amber-50 dark:bg-amber-950/30 p-4 sm:p-5"
        >
          <div className="flex items-start gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">
              <AlertTriangle className="size-5" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-foreground">
                Your {latestSemester.name ?? "latest"}-semester result needs attention
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {latestSemester.blockedReason ??
                  "One or more courses need to be resolved before your SGPA can be published."}
                {latestSemester.departmentHeadName && (
                  <>
                    {" "}Reach out to your department head,{" "}
                    <span className="font-medium text-foreground">
                      {latestSemester.departmentHeadName}
                    </span>
                    , for next steps.
                  </>
                )}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="default">
                  <Link to="/results">
                    View results
                    <ExternalLink className="ml-1 size-3.5" aria-hidden />
                  </Link>
                </Button>
                <Button asChild size="sm" variant="outline">
                  <Link to="/profile">Contact department</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick stats */}
      <section aria-label="Summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Current CGPA"
          value={cgpa != null ? cgpa.toFixed(2) : isBlocked ? "—" : "N/A"}
          hint={isBlocked ? "Latest semester blocked" : "Across generated semesters"}
          accent="gold"
          icon={<GraduationCap className="size-5" aria-hidden />}
        />
        <StatCard
          label="Current semester"
          value={student.currentSemesterName ?? "—"}
          hint={student.departmentCode ?? ""}
          accent="navy"
          icon={<CalendarCheck className="size-5" aria-hidden />}
        />
        <StatCard
          label="Credits completed"
          value={
            credits.required != null
              ? `${credits.completed} / ${credits.required}`
              : String(credits.completed)
          }
          hint={creditsPct != null ? `${creditsPct}% of program` : "Program total unknown"}
          icon={<BookOpen className="size-5" aria-hidden />}
        />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Today's classes */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">
              Today's classes
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {DAY_NAMES[todayCode]}
              </span>
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/routine">Full routine</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {todayClasses.length === 0 ? (
              <EmptyState
                icon={<CalendarCheck className="size-6" aria-hidden />}
                title="No classes today"
                description="Enjoy the break, or use the time to review course materials."
              />
            ) : (
              <ul className="divide-y divide-border">
                {todayClasses.map((c) => (
                  <li key={c.id} className="flex items-center gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="grid w-16 shrink-0 place-items-center rounded-md bg-muted px-2 py-2 text-center">
                      <span className="text-xs font-medium tabular-nums text-foreground">
                        {fmtTime(c.start_time)}
                      </span>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        {fmtTime(c.end_time)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">
                        {c.course_code} · {c.course_title}
                      </p>
                      <p className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                        {c.room && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="size-3" aria-hidden /> {c.room}
                          </span>
                        )}
                        {c.section && <span>Section {c.section}</span>}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Payment status */}
        <Card className={payments.overdue ? "border-destructive/50" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <Wallet className="size-4" aria-hidden />
              Payment status
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/payments">Details</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {payments.outstanding <= 0 ? (
              <div className="rounded-lg bg-muted p-4 text-center">
                <p className="text-2xl font-bold text-foreground">All clear</p>
                <p className="mt-1 text-xs text-muted-foreground">No outstanding balance.</p>
              </div>
            ) : (
              <div
                className={
                  "rounded-lg p-4 " +
                  (payments.overdue
                    ? "bg-destructive/10 text-destructive-foreground"
                    : "bg-amber-50 dark:bg-amber-950/30")
                }
              >
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Outstanding balance
                </p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">
                  ৳{payments.outstanding.toLocaleString()}
                </p>
                {payments.overdue && (
                  <Badge variant="destructive" className="mt-2">
                    <AlertTriangle className="mr-1 size-3" aria-hidden /> Overdue
                  </Badge>
                )}
                {payments.items[0]?.due_date && (
                  <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="size-3" aria-hidden /> Next due {fmtDate(payments.items[0].due_date)}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent notices */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="size-4" aria-hidden />
            Recent notices
          </CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link to="/notices">See all</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {notices.length === 0 ? (
            <EmptyState title="No notices yet" description="You'll see department and university announcements here." />
          ) : (
            <ul className="divide-y divide-border">
              {notices.map((n) => (
                <li key={n.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start gap-3">
                    <div
                      aria-hidden
                      className={
                        "mt-1.5 size-2 shrink-0 rounded-full " +
                        (n.is_read ? "bg-muted-foreground/40" : "bg-primary")
                      }
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {n.is_pinned && <Pin className="size-3 text-gold" aria-hidden />}
                        <p className={"truncate text-sm " + (n.is_read ? "font-normal text-muted-foreground" : "font-medium text-foreground")}>
                          {n.title}
                        </p>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{n.body}</p>
                      {n.published_at && (
                        <p className="mt-1 text-[11px] text-muted-foreground">{fmtDate(n.published_at)}</p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
