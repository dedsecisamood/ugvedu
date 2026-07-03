import { createFileRoute } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/constants";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/state/empty-state";

export const Route = createFileRoute("/_authenticated/classes")({
  component: ClassesPage,
  head: () => ({ meta: [{ title: `Classes — ${APP_NAME}` }] }),
});

function ClassesPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader crumb="Classes" title="Classes" subtitle="Your enrolled classes this semester." />
      <EmptyState
        title="Coming soon"
        description="This page will render live data once its module is wired to the layout."
      />
    </div>
  );
}
