import { createFileRoute } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/constants";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/state/empty-state";

export const Route = createFileRoute("/_authenticated/lab-projects")({
  component: LabProjectsPage,
  head: () => ({ meta: [{ title: `Lab Projects — ${APP_NAME}` }] }),
});

function LabProjectsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader crumb="Lab Projects" title="Lab Projects" subtitle="Lab assignments and submissions." />
      <EmptyState
        title="Coming soon"
        description="This page will render live data once its module is wired to the layout."
      />
    </div>
  );
}
