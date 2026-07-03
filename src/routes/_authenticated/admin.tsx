/**
 * `/admin` layout — client-side role gate.
 *
 * A user without admin/registrar reaching an /admin/* URL directly is
 * redirected to /overview. Every underlying server fn also verifies the
 * role, so this is UX-only; forging the URL still yields 403 at the fn
 * layer.
 */
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getMyRoles } from "@/lib/roles.functions";
import { APP_NAME } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const res = await getMyRoles();
    if (!res.roles.some((r) => r === "admin" || r === "registrar")) {
      throw redirect({ to: "/overview" });
    }
  },
  component: () => <Outlet />,
  head: () => ({ meta: [{ title: `Administration — ${APP_NAME}` }] }),
});
