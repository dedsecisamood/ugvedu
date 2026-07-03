import { createFileRoute } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/constants";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/state/empty-state";

export const Route = createFileRoute("/_authenticated/routine")({
  component: RoutinePage,
  head: () => ({ meta: [{ title: `Weekly Routine — ${APP_NAME}` }] }),
});

function RoutinePage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader crumb="Weekly Routine" title="Weekly Routine" subtitle="Your class schedule." />
      <EmptyState
        title="Coming soon"
        description="This page will render live data once its module is wired to the layout."
      />
    </div>
  );
}
