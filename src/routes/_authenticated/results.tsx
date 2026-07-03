import { createFileRoute } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/constants";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/state/empty-state";

export const Route = createFileRoute("/_authenticated/results")({
  component: ResultsPage,
  head: () => ({ meta: [{ title: `Results — ${APP_NAME}` }] }),
});

function ResultsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader crumb="Results" title="Results" subtitle="Semester results and CGPA." />
      <EmptyState
        title="Coming soon"
        description="This page will render live data once its module is wired to the layout."
      />
    </div>
  );
}
