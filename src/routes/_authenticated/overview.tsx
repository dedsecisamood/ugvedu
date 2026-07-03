/** Overview / dashboard landing. */
import { createFileRoute } from "@tanstack/react-router";
import { BookOpen, GraduationCap, CalendarCheck } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";

export const Route = createFileRoute("/_authenticated/overview")({
  component: Overview,
  head: () => ({ meta: [{ title: `Overview — ${APP_NAME}` }] }),
});

function Overview() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader crumb="Dashboard" title="Overview" subtitle="Your semester at a glance." />
      <section aria-label="Summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="CGPA" value="—" hint="Cumulative" accent="gold" icon={<GraduationCap className="size-5" aria-hidden />} />
        <StatCard label="Current semester" value="—" hint="Registered" accent="navy" icon={<CalendarCheck className="size-5" aria-hidden />} />
        <StatCard label="Enrolled courses" value="—" icon={<BookOpen className="size-5" aria-hidden />} />
      </section>
    </div>
  );
}
