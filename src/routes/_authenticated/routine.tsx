/**
 * Weekly Routine — grid view (days × time slots).
 * - Uses the discrete distinct start_time values found in the schedule as row keys
 *   so a full week with mixed durations renders without cell overlap.
 * - Today's column is visually highlighted.
 */
import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { APP_NAME } from "@/lib/constants";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/state/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { getStudentRoutine } from "@/lib/routine.functions";
import { cn } from "@/lib/utils";
import { MapPin, User } from "lucide-react";

const DAYS = [
  { code: "SUN", label: "Sun" },
  { code: "MON", label: "Mon" },
  { code: "TUE", label: "Tue" },
  { code: "WED", label: "Wed" },
  { code: "THU", label: "Thu" },
  { code: "FRI", label: "Fri" },
  { code: "SAT", label: "Sat" },
] as const;

async function loadRoutine() {
  const { data } = await supabase.auth.getUser();
  const userId = data.user?.id;
  if (!userId) throw new Error("Not signed in");
  return getStudentRoutine({ data: { studentUserId: userId } });
}

const routineQuery = queryOptions({
  queryKey: ["routine", "self"],
  queryFn: loadRoutine,
});

export const Route = createFileRoute("/_authenticated/routine")({
  component: RoutinePage,
  head: () => ({ meta: [{ title: `Weekly Routine — ${APP_NAME}` }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(routineQuery),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader crumb="Weekly Routine" title="Weekly Routine" />
      <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm">
        Couldn't load your schedule. {error.message}
      </div>
    </div>
  ),
});

function fmt(t: string) {
  const [hh, mm] = t.split(":");
  const h = parseInt(hh, 10);
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = ((h + 11) % 12) + 1;
  return `${h12}:${mm}${suffix.toLowerCase()}`;
}

type Slot = {
  id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  room: string | null;
  course_offerings: {
    section: string | null;
    instructor_user_id: string | null;
    courses: { code: string; title: string } | null;
  } | null;
};

function RoutinePage() {
  const { data } = useSuspenseQuery(routineQuery);
  const slots = (data.data ?? []) as Slot[];

  if (slots.length === 0) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHeader crumb="Weekly Routine" title="Weekly Routine" subtitle="Your class schedule for the current semester." />
        <EmptyState title="No classes scheduled" description="Your weekly timetable will appear here once schedules are published." />
      </div>
    );
  }

  // Collect distinct row keys as `start_time|end_time` so slots of the same
  // block share a row even if listed in a different order per day.
  const rowKeys = Array.from(
    new Set(slots.map((s) => `${s.start_time}|${s.end_time}`)),
  ).sort();

  // Index by day → rowKey → slot (multiple slots in the same block on the same day = stack)
  const grid = new Map<string, Map<string, Slot[]>>();
  for (const s of slots) {
    const day = grid.get(s.day_of_week) ?? new Map<string, Slot[]>();
    const key = `${s.start_time}|${s.end_time}`;
    const cell = day.get(key) ?? [];
    cell.push(s);
    day.set(key, cell);
    grid.set(s.day_of_week, day);
  }

  const todayCode = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][new Date().getDay()];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        crumb="Weekly Routine"
        title="Weekly Routine"
        subtitle="Your class schedule for the current semester."
      />

      <Card>
        <CardContent className="overflow-x-auto p-0">
          <div
            role="table"
            aria-label="Weekly class timetable"
            className="min-w-[900px] grid"
            style={{
              gridTemplateColumns: `120px repeat(${DAYS.length}, minmax(0,1fr))`,
            }}
          >
            {/* Header row */}
            <div role="columnheader" className="border-b border-border bg-muted/50 px-3 py-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Time
            </div>
            {DAYS.map((d) => (
              <div
                key={d.code}
                role="columnheader"
                className={cn(
                  "border-b border-l border-border px-3 py-3 text-xs font-medium uppercase tracking-wider",
                  d.code === todayCode
                    ? "bg-gold/10 text-gold-foreground ring-1 ring-inset ring-gold/40"
                    : "bg-muted/50 text-muted-foreground",
                )}
              >
                {d.label}
                {d.code === todayCode && (
                  <span className="ml-1 rounded bg-gold px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary-foreground">
                    Today
                  </span>
                )}
              </div>
            ))}

            {/* Body rows */}
            {rowKeys.map((key) => {
              const [start, end] = key.split("|");
              return (
                <RoutineRow
                  key={key}
                  startLabel={fmt(start)}
                  endLabel={fmt(end)}
                  cells={DAYS.map((d) => grid.get(d.code)?.get(key) ?? [])}
                  todayIndex={DAYS.findIndex((d) => d.code === todayCode)}
                />
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function RoutineRow({
  startLabel,
  endLabel,
  cells,
  todayIndex,
}: {
  startLabel: string;
  endLabel: string;
  cells: Slot[][];
  todayIndex: number;
}) {
  return (
    <>
      <div role="rowheader" className="border-b border-border bg-muted/20 px-3 py-3 text-xs tabular-nums text-muted-foreground">
        <p className="font-medium text-foreground">{startLabel}</p>
        <p>{endLabel}</p>
      </div>
      {cells.map((slots, i) => (
        <div
          key={i}
          role="cell"
          className={cn(
            "border-b border-l border-border p-2 align-top",
            i === todayIndex ? "bg-gold/5" : "",
          )}
        >
          <div className="flex flex-col gap-2">
            {slots.map((s) => (
              <SlotCard key={s.id} slot={s} />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

function SlotCard({ slot }: { slot: Slot }) {
  const c = slot.course_offerings?.courses;
  return (
    <div className="rounded-md border border-border bg-card p-2 text-xs shadow-sm">
      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        {c?.code ?? "—"}
      </p>
      <p className="mt-0.5 line-clamp-2 text-xs font-semibold text-foreground">
        {c?.title ?? "Untitled"}
      </p>
      {slot.room && (
        <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
          <MapPin className="size-3" aria-hidden /> {slot.room}
        </p>
      )}
      {slot.course_offerings?.section && (
        <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          <User className="size-3" aria-hidden /> Section {slot.course_offerings.section}
        </p>
      )}
    </div>
  );
}
