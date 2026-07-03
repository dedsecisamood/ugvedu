import { createFileRoute } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/constants";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/state/empty-state";

export const Route = createFileRoute("/_authenticated/registrations")({
  component: RegistrationsPage,
  head: () => ({ meta: [{ title: `Registrations — ${APP_NAME}` }] }),
});

function RegistrationsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader crumb="Registrations" title="Registrations" subtitle="Register for the upcoming semester." />
      <EmptyState
        title="Coming soon"
        description="This page will render live data once its module is wired to the layout."
      />
    </div>
  );
}
