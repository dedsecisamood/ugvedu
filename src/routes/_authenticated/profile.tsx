import { createFileRoute } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/constants";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/state/empty-state";

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
  head: () => ({ meta: [{ title: `Your Profile — ${APP_NAME}` }] }),
});

function ProfilePage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader crumb="Your Profile" title="Your Profile" subtitle="Personal details and academic info." />
      <EmptyState
        title="Coming soon"
        description="This page will render live data once its module is wired to the layout."
      />
    </div>
  );
}
