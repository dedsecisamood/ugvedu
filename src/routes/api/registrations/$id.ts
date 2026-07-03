/** PATCH /api/registrations/:id — approve or reject (admin/registrar/dept_head). */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticate, jsonError, readJson } from "@/lib/api-http";
import { writeAudit, requireRole } from "@/lib/audit";

const patchSchema = z.object({ status: z.enum(["APPROVED", "REJECTED"]) });

export const Route = createFileRoute("/api/registrations/$id")({
  server: {
    handlers: {
      PATCH: async ({ request, params }) => {
        const ctx = await authenticate(request);
        if (ctx instanceof Response) return ctx;
        if (!(await requireRole(ctx.supabase, ctx.userId, ["admin","registrar","department_head"])))
          return jsonError(403, "Forbidden");
        const parsed = patchSchema.safeParse(await readJson(request));
        if (!parsed.success) return jsonError(400, "Invalid body", { issues: parsed.error.issues });
        const { error } = await ctx.supabase
          .from("registrations")
          .update({
            status: parsed.data.status,
            decided_at: new Date().toISOString(),
            decided_by_user_id: ctx.userId,
          })
          .eq("id", params.id);
        if (error) return jsonError(500, error.message);
        await writeAudit(ctx.supabase, ctx.userId, `registration.${parsed.data.status.toLowerCase()}`,
          "registration", params.id, parsed.data);
        return Response.json({ ok: true });
      },
    },
  },
});
