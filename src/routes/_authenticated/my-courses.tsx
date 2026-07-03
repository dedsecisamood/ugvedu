import { createFileRoute } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/constants";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/state/empty-state";

export const Route = createFileRoute("/_authenticated/my-courses")({
  component: MyCoursesPage,
  head: () => ({ meta: [{ title: `My Courses — ${APP_NAME}` }] }),
});

function MyCoursesPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader crumb="My Courses" title="My Courses" subtitle="Current and past courses." />
      <EmptyState
        title="Coming soon"
        description="This page will render live data once its module is wired to the layout."
      />
    </div>
  );
}
