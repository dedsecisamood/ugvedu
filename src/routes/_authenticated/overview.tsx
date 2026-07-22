/** Overview / dashboard landing — student home. */
import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import {
  AlertTriangle, CalendarDays, IdCard, GraduationCap, Layers, Users, Home,
  Percent, Award, ArrowRight, BookOpen, Heart, Hand, Lightbulb, Sparkles,
} from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { EmptyState } from "@/components/state/empty-state";
import { PageHeader } from "@/components/layout/page-header";
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
    <div className="mx-auto max-w-7xl p-6">
      <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm">
        We couldn't load your dashboard. {error.message}
      </div>
    </div>
  ),
});

function fmtDeadline(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function todayLabel() {
  const d = new Date();
  const day = d.toLocaleDateString("en-US", { weekday: "short" }).toUpperCase();
  const rest = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase();
  return `${day}, ${rest}`;
}

function Overview() {
  const { data } = useSuspenseQuery(overviewQuery);

  if (!data.student) {
    return (
      <div className="mx-auto max-w-7xl">
        <PageHeader crumb="Dashboard" title="Overview" />
        <EmptyState
          title="No student profile"
          description="Your account isn't linked to a student record yet. Contact the registrar's office."
        />
      </div>
    );
  }

  const { student, latestSemester } = data;
  const isBlocked = latestSemester.status === "BLOCKED";
  const deadline = fmtDeadline(student.registrationDeadline);

  // Static Bloom's Taxonomy progress (not tracked in DB yet — matches spec)
  const cognitive = 68;
  const affective = 46;
  const psychomotor = 52;
  const overall = Math.round((cognitive + affective + psychomotor) / 3);
  const attendance = 56;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      {/* Deadline banner moved to bottom of page */}

      {/* Academic alert — result withheld */}
      {isBlocked && (
        <div className="flex flex-col gap-3 rounded-xl border border-destructive/40 bg-destructive p-4 text-destructive-foreground shadow-sm sm:flex-row sm:items-center">
          <div className="flex flex-1 items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-white/15">
              <AlertTriangle className="size-5" aria-hidden />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Academic alert — result withheld</p>
              <p className="mt-0.5 text-xs opacity-90">
                {latestSemester.blockedReason ??
                  "F or I grade found in a recent semester. CGPA is unavailable until resolved. Please contact your Department Head immediately."}
              </p>
            </div>
          </div>
          <Link
            to="/results"
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-4 py-2 text-xs font-semibold text-destructive shadow-sm transition hover:bg-white/90"
          >
            View results <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        </div>
      )}

      {/* Hero identity card */}
      <section className="relative overflow-hidden rounded-2xl border border-border/70 bg-gradient-to-br from-primary/5 via-background to-background shadow-sm">
        {/* Date pill */}
        <div className="absolute left-6 top-6 z-10">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-primary">
            <CalendarDays className="size-3" aria-hidden />
            {todayLabel()}
          </span>
        </div>
        {/* Progress ring */}
        <div className="absolute right-6 top-6 z-10">
          <ProgressRing value={overall + 6} label={`${overall + 6}%`} />
        </div>

        <div className="grid gap-6 px-6 pb-6 pt-20 md:grid-cols-[220px_1fr] md:gap-8 md:px-8 md:pb-8">
          {/* Photo */}
          <div className="mx-auto md:mx-0">
            <div className="overflow-hidden rounded-xl border-2 border-destructive/70 bg-muted shadow-md">
              {student.photoSignedUrl ? (
                <img
                  src={student.photoSignedUrl}
                  alt={student.fullName}
                  className="block aspect-[4/5] w-[190px] object-cover"
                />
              ) : (
                <div className="grid aspect-[4/5] w-[190px] place-items-center bg-primary text-4xl font-bold text-primary-foreground">
                  {student.fullName.split(" ").map((w) => w[0]).slice(0, 2).join("")}
                </div>
              )}
            </div>
          </div>

          {/* Identity */}
          <div className="min-w-0 space-y-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Hi, {student.fullName}
              </h1>
              <div className="mt-3 flex flex-wrap gap-2">
                <Chip icon={<IdCard className="size-3.5" aria-hidden />}>
                  Roll <span className="ml-1 font-bold">{student.studentId}</span>
                </Chip>
                <Chip icon={<CalendarDays className="size-3.5" aria-hidden />}>
                  Admission Session: <span className="ml-1 font-bold">Summer 2025</span>
                </Chip>
              </div>
            </div>

            <div className="rounded-lg border border-primary/15 bg-primary/5 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">
                <GraduationCap className="mr-1 inline size-3.5" aria-hidden /> Program
              </p>
              <p className="mt-0.5 text-sm font-semibold text-foreground">
                B.Sc in Computer Science And Engineering ({student.departmentCode ?? "CSE"})
              </p>
            </div>

            <p className="text-sm text-muted-foreground">
              Let us focus on attendance and upcoming quizzes to lift the score.
            </p>
          </div>
        </div>

        {/* Bottom stats strip */}
        <div className="grid grid-cols-2 gap-px border-t border-border bg-border/70 sm:grid-cols-3 lg:grid-cols-5">
          <MiniStat icon={<Layers className="size-3.5" aria-hidden />} label="Semester" value={student.currentSemesterName ?? "3rd"} />
          <MiniStat icon={<Home className="size-3.5" aria-hidden />} label="Section" value={student.section ?? "B"} />
          <MiniStat icon={<Users className="size-3.5" aria-hidden />} label="Group" value={student.studentGroup ?? "A"} />
          <MiniStat icon={<Percent className="size-3.5" aria-hidden />} label="Attendance" value={`${attendance}%`} tone="danger" />
          <MiniStat icon={<Award className="size-3.5" aria-hidden />} label="CGPA" value={isBlocked ? "Withheld" : (data.cgpa != null ? data.cgpa.toFixed(2) : "—")} tone={isBlocked ? "danger" : "default"} />
        </div>
      </section>

      {/* Bloom's Taxonomy */}
      <section className="rounded-2xl border border-border/70 bg-card p-5 shadow-sm sm:p-6">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Bloom's Taxonomy</p>
            <h2 className="mt-0.5 text-lg font-bold text-foreground">Learning progress</h2>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-500" aria-hidden /> All Live
          </span>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {/* Overall */}
          <div className="rounded-xl border border-border bg-background p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm font-bold text-foreground">Overall</p>
                <p className="text-[11px] text-muted-foreground">3rd semester · 3 domains</p>
              </div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Focus</span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Combined progress across cognitive, affective, and psychomotor learning this semester.
            </p>
            <div className="my-4 flex justify-center">
              <DonutRing value={overall} />
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 text-xs">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Strongest</p>
                <p className="mt-0.5 font-semibold text-rose-600 dark:text-rose-400">● Cognitive · {cognitive}%</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Needs focus</p>
                <p className="mt-0.5 font-semibold text-violet-600 dark:text-violet-400">● Affective · {affective}%</p>
              </div>
            </div>
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-400/50 bg-amber-50 p-2 text-[11px] text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>1 domain needs attention due to withheld or incomplete data.</span>
            </div>
          </div>

          <DomainBeaker
            title="Cognitive"
            subtitle="Class tests, assignments & exams"
            icon={<Lightbulb className="size-4" aria-hidden />}
            value={cognitive}
            tone="rose"
            description="Measures academic performance through class tests, assignments, examinations, and your previous scores."
          />
          <DomainBeaker
            title="Affective"
            subtitle="Attitudes & values"
            icon={<Heart className="size-4" aria-hidden />}
            value={affective}
            tone="violet"
            description="Reflects professional conduct, classroom behavior, and consistent attendance throughout the semester."
          />
          <DomainBeaker
            title="Psychomotor"
            subtitle="Skills & application"
            icon={<Hand className="size-4" aria-hidden />}
            value={psychomotor}
            tone="sky"
            description="Reflects practical skills and hands-on performance in laboratory and skill-based work."
          />
        </div>
      </section>

      {/* Quick links */}
      <section className="grid gap-4 sm:grid-cols-3">
        <QuickLink to="/classes" icon={<BookOpen className="size-4" aria-hidden />} label="My Classes" />
        <QuickLink to="/routine" icon={<CalendarDays className="size-4" aria-hidden />} label="Weekly Routine" />
        <QuickLink to="/notices" icon={<Sparkles className="size-4" aria-hidden />} label="Latest Notices" />
      </section>

      {/* Deadline banner (bottom) */}
      {deadline && (
        <div className="rounded-xl border border-amber-400/60 bg-amber-50 p-4 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div className="text-sm">
              <p className="font-semibold">Register before {deadline}</p>
              <p className="mt-1 text-amber-900/80 dark:text-amber-200/80">
                If you do not complete semester registration before the deadline, the following will apply:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-900/80 dark:text-amber-200/80">
                <li>A registration fine will be added to your ledger.</li>
                <li>Your access to classrooms will be removed.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ----------- pieces ----------- */

function Chip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
      <span className="text-primary">{icon}</span>
      {children}
    </span>
  );
}

function MiniStat({
  icon, label, value, tone = "default",
}: {
  icon: React.ReactNode; label: string; value: string; tone?: "default" | "danger";
}) {
  return (
    <div className="bg-card p-4">
      <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        <span className="text-primary">{icon}</span>
        {label}
      </p>
      <p className={"mt-1 text-lg font-bold " + (tone === "danger" ? "text-destructive" : "text-foreground")}>
        {value}
      </p>
    </div>
  );
}

function ProgressRing({ value, label }: { value: number; label: string }) {
  const size = 56;
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (Math.min(100, Math.max(0, value)) / 100) * c;
  return (
    <div className="relative grid place-items-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" strokeWidth={stroke} fill="none" className="text-muted" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="currentColor" strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
          className="text-primary"
        />
      </svg>
      <span className="absolute text-[11px] font-bold text-foreground">{label}</span>
    </div>
  );
}

function DonutRing({ value }: { value: number }) {
  const size = 140;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const off = c - (value / 100) * c;
  return (
    <div className="relative grid place-items-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="currentColor" strokeWidth={stroke} fill="none" className="text-muted" />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          stroke="url(#donutGrad)" strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={off} strokeLinecap="round"
        />
        <defs>
          <linearGradient id="donutGrad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="hsl(var(--primary))" />
            <stop offset="100%" stopColor="rgb(139 92 246)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute text-center">
        <p className="text-2xl font-bold text-foreground">
          {value}<span className="text-sm text-muted-foreground">%</span>
        </p>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Average</p>
      </div>
    </div>
  );
}

function DomainBeaker({
  title, subtitle, icon, value, tone, description,
}: {
  title: string; subtitle: string; icon: React.ReactNode; value: number;
  tone: "rose" | "violet" | "sky"; description: string;
}) {
  const toneMap = {
    rose: { border: "border-rose-300/60", ring: "text-rose-500", head: "bg-rose-50 dark:bg-rose-500/10", fill: "bg-rose-400", label: "text-rose-600 dark:text-rose-400" },
    violet: { border: "border-violet-300/60", ring: "text-violet-500", head: "bg-violet-50 dark:bg-violet-500/10", fill: "bg-violet-400", label: "text-violet-600 dark:text-violet-400" },
    sky: { border: "border-sky-300/60", ring: "text-sky-500", head: "bg-sky-50 dark:bg-sky-500/10", fill: "bg-sky-400", label: "text-sky-600 dark:text-sky-400" },
  }[tone];

  return (
    <div className={"overflow-hidden rounded-xl border bg-background " + toneMap.border}>
      <div className={"px-5 pb-4 pt-5 text-center " + toneMap.head}>
        <div className={"mx-auto mb-2 grid size-8 place-items-center rounded-full bg-white/70 " + toneMap.ring}>
          {icon}
        </div>
        <p className="text-sm font-bold text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      </div>
      <div className="grid place-items-center px-5 py-6">
        <Beaker value={value} fillClass={toneMap.fill} labelClass={toneMap.label} />
      </div>
      <div className="border-t border-border p-4">
        <p className="text-[11px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function Beaker({ value, fillClass, labelClass }: { value: number; fillClass: string; labelClass: string }) {
  const h = Math.min(100, Math.max(0, value));
  return (
    <div className="relative">
      <div className="relative h-32 w-20 overflow-hidden rounded-b-[28px] rounded-t-md border-2 border-b-4 border-border/70 bg-muted/30">
        <div
          className={"absolute inset-x-0 bottom-0 transition-all " + fillClass}
          style={{ height: `${h}%`, opacity: 0.75 }}
          aria-hidden
        />
        <div className={"absolute inset-x-0 bottom-0 h-1 " + fillClass} aria-hidden />
      </div>
      <p className={"mt-3 text-center text-lg font-bold " + labelClass}>
        {value}<span className="text-xs">%</span>
      </p>
      <p className="text-center text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">Progress</p>
    </div>
  );
}

function QuickLink({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="group flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground shadow-sm transition hover:border-primary/40 hover:bg-primary/5"
    >
      <span className="flex items-center gap-2">
        <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</span>
        {label}
      </span>
      <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden />
    </Link>
  );
}
