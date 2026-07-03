/** `/faculty` layout — allows dept_head and admin. */
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getMyRoles } from "@/lib/roles.functions";
import { APP_NAME } from "@/lib/constants";

export const Route = createFileRoute("/_authenticated/faculty")({
  beforeLoad: async () => {
    const res = await getMyRoles();
    if (!res.roles.some((r) => r === "department_head" || r === "admin")) {
      throw redirect({ to: "/overview" });
    }
  },
  component: () => <Outlet />,
  head: () => ({ meta: [{ title: `Faculty — ${APP_NAME}` }] }),
});
