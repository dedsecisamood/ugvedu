/**
 * Registrations page.
 *
 * Layout:
 *  - Header with registration-window countdown (or clearly labelled "closed").
 *  - Available offerings for the target semester (capacity progress, seats
 *    fraction "18/30 seats"). Register button is disabled with an
 *    explanation when: window closed, seats full, already registered/enrolled.
 *  - "My Requests" list showing PENDING / APPROVED / REJECTED.
 *
 * The register button never fires when disabled — this satisfies the
 * verification requirement that the UI blocks out-of-window requests
 * instead of failing silently.
 */
import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CalendarClock, Users, User, CheckCircle2, XCircle, Clock3, Lock } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/state/empty-state";
import { ErrorState } from "@/components/state/error-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  listMyRegistrations,
  listRegistrationOfferings,
  requestRegistration,
  type OfferingRow,
} from "@/lib/registrations.functions";

const offeringsQuery = queryOptions({
  queryKey: ["registrations", "offerings"],
  queryFn: () => listRegistrationOfferings(),
});
const myRegsQuery = queryOptions({
  queryKey: ["registrations", "mine"],
  queryFn: () => listMyRegistrations(),
});

export const Route = createFileRoute("/_authenticated/registrations")({
  component: RegistrationsPage,
  head: () => ({ meta: [{ title: `Registrations — ${APP_NAME}` }] }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(offeringsQuery),
      context.queryClient.ensureQueryData(myRegsQuery),
    ]),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader crumb="Registrations" title="Course Registrations" />
      <ErrorState description={error.message} />
    </div>
  ),
});

/** Live-updating countdown to a fixed ISO timestamp. */
function useCountdown(iso: string | null): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!iso) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [iso]);
  if (!iso) return null;
  const diff = Date.parse(iso) - now;
  if (Number.isNaN(diff)) return null;
  if (diff <= 0) return "closed";
  const s = Math.floor(diff / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}

function RegistrationsPage() {
  const { data: offeringsData } = useSuspenseQuery(offeringsQuery);
  const { data: myData } = useSuspenseQuery(myRegsQuery);
  const qc = useQueryClient();
  const requestFn = useServerFn(requestRegistration);

  const semester = offeringsData.semester;
  const windowOpen = semester?.window_open ?? false;
  const countdown = useCountdown(semester?.registration_closes_at ?? null);
  const notYet = semester && !semester.window_open && semester.registration_opens_at
    ? Date.parse(semester.registration_opens_at) > Date.now()
    : false;
  const opensIn = useCountdown(notYet ? semester?.registration_opens_at ?? null : null);

  const register = useMutation({
    mutationFn: (courseOfferingId: string) => requestFn({ data: { courseOfferingId } }),
    onSuccess: (result, courseOfferingId) => {
      if (!result.ok) {
        toast.error(result.error ?? "Could not register");
        return;
      }
      toast.success("Registration submitted");
      qc.invalidateQueries({ queryKey: ["registrations"] });
      // Optimistically nudge the row too.
      const prev = qc.getQueryData<typeof offeringsData>(offeringsQuery.queryKey);
      if (prev) {
        qc.setQueryData(offeringsQuery.queryKey, {
          ...prev,
          offerings: prev.offerings.map((o) =>
            o.offeringId === courseOfferingId
              ? { ...o, alreadyRegistered: true, registrationStatus: "APPROVED" as const, taken: o.taken + 1 }
              : o,
          ),
        });
      }
    },
    onError: (e) => toast.error((e as Error).message),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        crumb="Academics"
        title="Course Registrations"
        subtitle={
          semester
            ? `${semester.name} — ${semester.term} ${semester.year}`
            : "No registration semester scheduled."
        }
      />

      {/* Window banner */}
      {semester && (
        <Card
          className={cn(
            "border",
            windowOpen ? "border-primary/40 bg-primary/[0.04]" : "border-border bg-muted/40",
          )}
        >
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-lg",
                  windowOpen ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                {windowOpen ? (
                  <CalendarClock className="size-5" aria-hidden />
                ) : (
                  <Lock className="size-5" aria-hidden />
                )}
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {windowOpen
                    ? "Registration is open"
                    : notYet
                      ? "Registration opens soon"
                      : "Registration is closed"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {semester.registration_opens_at && (
                    <>Opens {new Date(semester.registration_opens_at).toLocaleString()}. </>
                  )}
                  {semester.registration_closes_at && (
                    <>Closes {new Date(semester.registration_closes_at).toLocaleString()}.</>
                  )}
                </p>
              </div>
            </div>
            <div className="text-right">
              {windowOpen && countdown && (
                <>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Closes in
                  </p>
                  <p className="text-lg font-semibold tabular-nums">{countdown}</p>
                </>
              )}
              {notYet && opensIn && (
                <>
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Opens in
                  </p>
                  <p className="text-lg font-semibold tabular-nums">{opensIn}</p>
                </>
              )}
              {!windowOpen && !notYet && (
                <Badge variant="outline">Window closed</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="available">
        <TabsList>
          <TabsTrigger value="available">
            Available ({offeringsData.offerings.length})
          </TabsTrigger>
          <TabsTrigger value="mine">
            My Requests ({myData.registrations.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="available" className="mt-4">
          {offeringsData.offerings.length === 0 ? (
            <EmptyState
              title="No course offerings"
              description="There are no offerings to register for in this semester."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {offeringsData.offerings.map((o) => (
                <OfferingCard
                  key={o.offeringId}
                  offering={o}
                  disabled={!windowOpen}
                  disabledReason={
                    !semester
                      ? "No registration semester."
                      : notYet
                        ? "Registration hasn't opened yet."
                        : "Registration window is closed."
                  }
                  onRegister={() => register.mutate(o.offeringId)}
                  registering={register.isPending && register.variables === o.offeringId}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="mine" className="mt-4">
          <MyRequests requests={myData.registrations} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OfferingCard({
  offering,
  disabled,
  disabledReason,
  onRegister,
  registering,
}: {
  offering: OfferingRow;
  disabled: boolean;
  disabledReason: string;
  onRegister: () => void;
  registering: boolean;
}) {
  const full = offering.taken >= offering.capacity;
  const pct = Math.min(100, Math.round((offering.taken / Math.max(1, offering.capacity)) * 100));
  const alreadyIn = offering.alreadyRegistered || offering.alreadyEnrolled;

  // Reason is prioritized so the button always explains itself.
  let btnDisabled = false;
  let reason: string | null = null;
  let label = "Register";
  if (alreadyIn) {
    btnDisabled = true;
    label =
      offering.registrationStatus === "PENDING"
        ? "Pending"
        : offering.alreadyEnrolled
          ? "Enrolled"
          : "Approved";
    reason = null;
  } else if (disabled) {
    btnDisabled = true;
    label = "Register";
    reason = disabledReason;
  } else if (full) {
    btnDisabled = true;
    label = "Seats full";
    reason = "No seats remaining.";
  }

  return (
    <Card className="flex flex-col">
      <CardContent className="flex flex-1 flex-col gap-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {offering.code}
              {offering.section ? ` · Section ${offering.section}` : ""}
            </p>
            <h3 className="mt-0.5 truncate text-base font-semibold">{offering.title}</h3>
          </div>
          <Badge variant="secondary" className="shrink-0">
            {offering.credits} CR
          </Badge>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Users className="size-3.5" aria-hidden />
              {offering.taken}/{offering.capacity} seats
            </span>
            <span className={cn(full ? "text-destructive" : "text-muted-foreground")}>
              {full ? "Full" : `${offering.capacity - offering.taken} left`}
            </span>
          </div>
          <Progress value={pct} className={cn("h-1.5", full && "[&>div]:bg-destructive")} />
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <User className="size-3.5" aria-hidden />
          {offering.instructorName ?? "Instructor TBA"}
        </div>

        <div className="mt-auto space-y-1.5">
          <Button
            onClick={onRegister}
            disabled={btnDisabled || registering}
            className="w-full"
            variant={alreadyIn ? "secondary" : "default"}
          >
            {registering ? "Registering…" : label}
          </Button>
          {reason && (
            <p className="text-center text-xs text-muted-foreground">{reason}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function MyRequests({
  requests,
}: {
  requests: ReturnType<typeof useSuspenseQuery<typeof myRegsQuery>>["data"]["registrations"];
}) {
  const grouped = useMemo(() => {
    const g: Record<"PENDING" | "APPROVED" | "REJECTED", typeof requests> = {
      PENDING: [], APPROVED: [], REJECTED: [],
    };
    for (const r of requests) g[r.status].push(r);
    return g;
  }, [requests]);

  if (requests.length === 0) {
    return (
      <EmptyState
        title="No registration requests"
        description="Your registration history will appear here."
      />
    );
  }

  return (
    <div className="space-y-6">
      {(["PENDING", "APPROVED", "REJECTED"] as const).map((s) =>
        grouped[s].length === 0 ? null : (
          <section key={s}>
            <h2 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {s === "PENDING" && <Clock3 className="size-3.5" aria-hidden />}
              {s === "APPROVED" && <CheckCircle2 className="size-3.5 text-primary" aria-hidden />}
              {s === "REJECTED" && <XCircle className="size-3.5 text-destructive" aria-hidden />}
              {s.charAt(0) + s.slice(1).toLowerCase()} ({grouped[s].length})
            </h2>
            <div className="space-y-2">
              {grouped[s].map((r) => (
                <Card key={r.id}>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                        {r.offering?.code ?? "—"}
                        {r.offering?.section ? ` · Section ${r.offering.section}` : ""}
                      </p>
                      <p className="mt-0.5 truncate text-sm font-medium">
                        {r.offering?.title ?? "Offering unavailable"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.offering?.semesterName} · Requested{" "}
                        {new Date(r.requested_at).toLocaleDateString()}
                        {r.decided_at &&
                          ` · Decided ${new Date(r.decided_at).toLocaleDateString()}`}
                      </p>
                    </div>
                    <Badge
                      variant={
                        s === "APPROVED"
                          ? "default"
                          : s === "REJECTED"
                            ? "destructive"
                            : "secondary"
                      }
                    >
                      {s}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        ),
      )}
    </div>
  );
}
