/**
 * Lab Projects page.
 *
 * - Course picker sourced from the student's currently ENROLLED offerings
 *   (plus "All my classes").
 * - Each row shows title, due date, max score, submission status:
 *     • Not submitted (overdue = red flag when past due)
 *     • Submitted (awaiting grading)
 *     • Graded (score / max)
 */
import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueries } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CheckCircle2, Clock3, FlaskConical } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/state/empty-state";
import { ErrorState } from "@/components/state/error-state";
import { ListItemSkeleton } from "@/components/state/skeletons";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { getMyClasses, type ClassRow } from "@/lib/classes.functions";
import { listLabProjects } from "@/lib/lab-projects.functions";

const classesQuery = queryOptions({
  queryKey: ["classes", "self", "current", "for-labs"],
  queryFn: () => getMyClasses(),
});

export const Route = createFileRoute("/_authenticated/lab-projects")({
  component: LabProjectsPage,
  head: () => ({ meta: [{ title: `Lab Projects — ${APP_NAME}` }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(classesQuery),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader crumb="Academics" title="Lab Projects" />
      <ErrorState description={error.message} />
    </div>
  ),
});

type LabProject = {
  id: string;
  course_offering_id: string;
  title: string;
  description: string | null;
  due_at: string;
  max_score: number;
  submission: null | {
    id: string;
    submitted_at: string;
    score: number | null;
  };
};

function LabProjectsPage() {
  const { data: classes } = useSuspenseQuery(classesQuery);
  const [selected, setSelected] = useState<string>("all");
  const listFn = useServerFn(listLabProjects);

  const targets: ClassRow[] =
    selected === "all"
      ? classes.classes
      : classes.classes.filter((c) => c.offeringId === selected);

  const queries = useQueries({
    queries: targets.map((c) => ({
      queryKey: ["lab-projects", c.offeringId],
      queryFn: () =>
        listFn({ data: { courseOfferingId: c.offeringId, pageSize: 50, cursor: null } }),
    })),
  });

  const loading = queries.some((q) => q.isPending);
  const errored = queries.find((q) => q.isError);

  const rows = useMemo(() => {
    const out: (LabProject & { courseCode: string; courseTitle: string })[] = [];
    queries.forEach((q, i) => {
      const items = (q.data?.data ?? []) as unknown as LabProject[];
      const cls = targets[i];
      for (const it of items) {
        out.push({ ...it, courseCode: cls.code, courseTitle: cls.title });
      }
    });
    out.sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at));
    return out;
  }, [queries, targets]);

  if (classes.classes.length === 0) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader crumb="Academics" title="Lab Projects" />
        <EmptyState
          title="No enrolled classes"
          description="You'll see lab projects here once you're enrolled in a course."
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        crumb="Academics"
        title="Lab Projects"
        subtitle="Assignments and their submission status."
        actions={
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="Filter by course" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All my classes</SelectItem>
              {classes.classes.map((c) => (
                <SelectItem key={c.offeringId} value={c.offeringId}>
                  <span className="font-mono text-xs mr-2">{c.code}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => <ListItemSkeleton key={i} />)}
        </div>
      )}

      {errored && (
        <ErrorState description={(errored.error as Error).message} />
      )}

      {!loading && !errored && rows.length === 0 && (
        <EmptyState
          icon={<FlaskConical className="size-6" aria-hidden />}
          title="No lab projects yet"
          description="When your instructor posts a lab, it'll show up here."
        />
      )}

      {!loading && !errored && rows.length > 0 && (
        <div className="space-y-2">
          {rows.map((r) => <LabRow key={r.id} row={r} />)}
        </div>
      )}
    </div>
  );
}

function LabRow({ row }: { row: LabProject & { courseCode: string; courseTitle: string } }) {
  const due = new Date(row.due_at);
  const now = Date.now();
  const submitted = !!row.submission;
  const graded = !!row.submission && row.submission.score !== null;
  const overdue = !submitted && due.getTime() < now;

  const status: { label: string; tone: "graded" | "submitted" | "overdue" | "open"; icon: typeof CheckCircle2 } =
    graded
      ? { label: `Graded · ${row.submission!.score}/${row.max_score}`, tone: "graded", icon: CheckCircle2 }
      : submitted
        ? { label: "Submitted", tone: "submitted", icon: CheckCircle2 }
        : overdue
          ? { label: "Overdue", tone: "overdue", icon: AlertTriangle }
          : { label: "Not submitted", tone: "open", icon: Clock3 };

  const StatusIcon = status.icon;

  return (
    <Card
      className={cn(
        "border transition-colors",
        status.tone === "overdue" && "border-destructive/40 bg-destructive/[0.04]",
      )}
    >
      <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
            {row.courseCode}
          </p>
          <p className="mt-0.5 truncate text-sm font-medium">{row.title}</p>
          {row.description && (
            <p className="truncate text-xs text-muted-foreground">{row.description}</p>
          )}
          <p
            className={cn(
              "mt-0.5 text-xs",
              overdue ? "font-medium text-destructive" : "text-muted-foreground",
            )}
          >
            Due {due.toLocaleDateString()} · {due.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            {" · "}
            Max {row.max_score}
          </p>
        </div>
        <Badge
          variant={
            status.tone === "graded"
              ? "default"
              : status.tone === "submitted"
                ? "secondary"
                : status.tone === "overdue"
                  ? "destructive"
                  : "outline"
          }
          className="gap-1"
        >
          <StatusIcon className="size-3" aria-hidden />
          {status.label}
        </Badge>
      </CardContent>
    </Card>
  );
}
