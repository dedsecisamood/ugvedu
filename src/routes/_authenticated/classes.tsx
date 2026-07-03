import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { BookOpen, User, ArrowRight } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/state/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getMyClasses } from "@/lib/classes.functions";

const classesQuery = queryOptions({
  queryKey: ["classes", "self", "current"],
  queryFn: () => getMyClasses(),
});

export const Route = createFileRoute("/_authenticated/classes")({
  component: ClassesPage,
  head: () => ({ meta: [{ title: `Classes — ${APP_NAME}` }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(classesQuery),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader crumb="Classes" title="Classes" />
      <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm">
        Couldn't load your classes. {error.message}
      </div>
    </div>
  ),
});

function ClassesPage() {
  const { data } = useSuspenseQuery(classesQuery);
  const { semesterName, classes } = data;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        crumb="Classes"
        title="Classes"
        subtitle={semesterName ? `Enrolled this ${semesterName} semester` : "No active semester"}
      />

      {classes.length === 0 ? (
        <EmptyState
          title="No enrolled classes"
          description={
            semesterName
              ? "You're not enrolled in any course this semester yet."
              : "There is no active semester right now."
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {classes.map((c) => (
            <Card key={c.enrollmentId} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                      {c.code}
                    </p>
                    <h2 className="mt-0.5 truncate text-base font-semibold text-foreground">
                      {c.title}
                    </h2>
                  </div>
                  <Badge variant="secondary" className="shrink-0">
                    {c.credits} CR
                  </Badge>
                </div>

                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5">
                    <User className="size-3.5" aria-hidden />
                    {c.instructorName ?? "Instructor TBA"}
                  </p>
                  {c.section && <p>Section {c.section}</p>}
                  <p>
                    {c.schedulesCount} class {c.schedulesCount === 1 ? "meeting" : "meetings"} scheduled
                  </p>
                </div>

                <div className="mt-auto flex items-center justify-end gap-2 pt-2">
                  <Button asChild size="sm" variant="outline">
                    <Link to="/routine">Routine</Link>
                  </Button>
                  <Button
                    asChild
                    size="sm"
                    variant="default"
                  >
                    <Link
                      to="/course-materials"
                      search={{ courseOfferingId: c.offeringId } as never}
                    >
                      <BookOpen className="mr-1 size-4" aria-hidden />
                      Materials
                      <ArrowRight className="ml-1 size-3.5" aria-hidden />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
