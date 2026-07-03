import { createFileRoute } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/constants";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/state/empty-state";

export const Route = createFileRoute("/_authenticated/course-materials")({
  component: CourseMaterialsPage,
  head: () => ({ meta: [{ title: `Course Materials — ${APP_NAME}` }] }),
});

function CourseMaterialsPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader crumb="Course Materials" title="Course Materials" subtitle="Lecture notes and resources." />
      <EmptyState
        title="Coming soon"
        description="This page will render live data once its module is wired to the layout."
      />
    </div>
  );
}
