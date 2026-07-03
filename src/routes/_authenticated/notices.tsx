import { createFileRoute } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/constants";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/state/empty-state";

export const Route = createFileRoute("/_authenticated/notices")({
  component: NoticesPage,
  head: () => ({ meta: [{ title: `Notices — ${APP_NAME}` }] }),
});

function NoticesPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader crumb="Notices" title="Notices" subtitle="Announcements from the university." />
      <EmptyState
        title="Coming soon"
        description="This page will render live data once its module is wired to the layout."
      />
    </div>
  );
}
