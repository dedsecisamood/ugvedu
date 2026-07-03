/** GET /api/payments — student sees own; staff see all (filter via ?studentUserId). */
import { createFileRoute } from "@tanstack/react-router";
import { authenticate, jsonError } from "@/lib/api-http";
import { requireRole } from "@/lib/audit";

export const Route = createFileRoute("/api/payments/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ctx = await authenticate(request);
        if (ctx instanceof Response) return ctx;
        const url = new URL(request.url);
        const filter = url.searchParams.get("studentUserId");
        const isStaff = await requireRole(ctx.supabase, ctx.userId, ["admin","registrar"]);
        const target = isStaff && filter ? filter : ctx.userId;
        if (!isStaff && filter && filter !== ctx.userId) return jsonError(403, "Forbidden");
        const { data, error } = await ctx.supabase
          .from("payments")
          .select("id, student_user_id, semester_id, amount_due, amount_paid, due_date, status, transaction_ref, updated_at")
          .eq("student_user_id", target)
          .order("due_date", { ascending: false });
        if (error) return jsonError(500, error.message);
        return Response.json({ data });
      },
    },
  },
});
