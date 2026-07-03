import { createFileRoute } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/constants";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/state/empty-state";

export const Route = createFileRoute("/_authenticated/payments")({
  component: PaymentsPage,
  head: () => ({ meta: [{ title: `My Payments — ${APP_NAME}` }] }),
});

function PaymentsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader crumb="My Payments" title="My Payments" subtitle="Fees and payment history." />
      <EmptyState
        title="Coming soon"
        description="This page will render live data once its module is wired to the layout."
      />
    </div>
  );
}
