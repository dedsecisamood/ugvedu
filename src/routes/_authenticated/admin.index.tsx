/** Admin landing — quick tiles for common tasks. */
import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, UserPlus, PencilRuler, Scale, CalendarClock, ScrollText, AlertOctagon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";

const tiles = [
  { to: "/admin/users", icon: Users, label: "User management", desc: "Create accounts, assign roles" },
  { to: "/admin/students/new", icon: UserPlus, label: "Student intake", desc: "Register a new student roll" },
  { to: "/admin/grades", icon: PencilRuler, label: "Grade entry", desc: "Enter and publish semester grades" },
  { to: "/admin/grade-scale", icon: Scale, label: "Grade scale", desc: "Edit letter → point mapping" },
  { to: "/admin/semesters", icon: CalendarClock, label: "Semesters", desc: "Open / close registration windows" },
  { to: "/admin/audit", icon: ScrollText, label: "Audit log", desc: "Every state-changing action" },
  { to: "/faculty/blocked", icon: AlertOctagon, label: "Blocked results", desc: "Resolve F/I grades" },
] as const;

export const Route = createFileRoute("/_authenticated/admin/")({ component: AdminIndex });

function AdminIndex() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader crumb="Administration" title="Administration" subtitle="Operational controls for the portal." />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((t) => (
          <Link key={t.to} to={t.to} className="block">
            <Card className="h-full transition hover:border-primary/40 hover:shadow-sm">
              <CardContent className="flex items-start gap-3 p-5">
                <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
                  <t.icon className="size-5" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{t.label}</p>
                  <p className="text-sm text-muted-foreground">{t.desc}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
