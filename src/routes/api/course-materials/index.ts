/**
 * /api/course-materials
 * - GET  ?courseId=<uuid>&cursor=&pageSize= — list resources for a course
 * - POST — request a signed upload URL (staff only). Body:
 *   { courseId, title, description?, fileName, mimeType, fileSizeBytes }
 * MIME + size validated server-side; anything not in the allow-list is rejected.
 */
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { authenticate, jsonError, readJson } from "@/lib/api-http";
import {
  encodeCursor, decodeCursor, cursorSchema, pageSizeSchema,
} from "@/lib/pagination";
import { getStorage, ALLOWED_MIME_TYPES, MAX_UPLOAD_BYTES, assertUploadAllowed } from "@/lib/storage";

const listQuery = z.object({
  courseId: z.string().uuid().optional(),
  courseOfferingId: z.string().uuid().optional(),
  cursor: cursorSchema,
  pageSize: pageSizeSchema,
}).refine((v) => v.courseId || v.courseOfferingId, { message: "courseId or courseOfferingId required" });

const uploadBody = z.object({
  courseId: z.string().uuid(),
  courseOfferingId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  fileName: z.string().trim().min(1).max(200).regex(/^[A-Za-z0-9._\-\s()]+$/, "Invalid filename"),
  mimeType: z.string().refine((v) => ALLOWED_MIME_TYPES.has(v), { message: "Unsupported file type" }),
  fileSizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

export const Route = createFileRoute("/api/course-materials/")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const ctx = await authenticate(request);
        if (ctx instanceof Response) return ctx;

        const url = new URL(request.url);
        const parsed = listQuery.safeParse(Object.fromEntries(url.searchParams));
        if (!parsed.success) return jsonError(400, "Invalid query", { issues: parsed.error.issues });
        const p = parsed.data;

        let q = ctx.supabase
          .from("course_materials")
          .select("id, course_id, course_offering_id, title, description, storage_bucket, storage_path, file_size_bytes, mime_type, created_at", { count: "exact" })
          .is("deleted_at", null);
        if (p.courseId) q = q.eq("course_id", p.courseId);
        if (p.courseOfferingId) q = q.eq("course_offering_id", p.courseOfferingId);

        const cur = decodeCursor(p.cursor);
        q = q.order("created_at", { ascending: false }).order("id", { ascending: false });
        if (cur) q = q.or(`created_at.lt.${cur.createdAt},and(created_at.eq.${cur.createdAt},id.lt.${cur.id})`);
        q = q.limit(p.pageSize + 1);

        const { data: rows, error, count } = await q;
        if (error) return jsonError(500, error.message);
        const list = rows ?? [];
        const hasMore = list.length > p.pageSize;
        const page = hasMore ? list.slice(0, p.pageSize) : list;
        const last = page[page.length - 1];
        return Response.json({
          data: page,
          nextCursor: hasMore && last ? encodeCursor({ created_at: last.created_at, id: last.id }) : null,
          total: count ?? page.length,
        });
      },

      POST: async ({ request }) => {
        const ctx = await authenticate(request);
        if (ctx instanceof Response) return ctx;

        let body: unknown;
        try { body = await readJson(request); } catch (r) { return r as Response; }
        const parsed = uploadBody.safeParse(body);
        if (!parsed.success) return jsonError(400, "Invalid body", { issues: parsed.error.issues });
        const p = parsed.data;

        const [{ data: a }, { data: r }, { data: h }] = await Promise.all([
          ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "admin" }),
          ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "registrar" }),
          ctx.supabase.rpc("has_role", { _user_id: ctx.userId, _role: "department_head" }),
        ]);
        if (!a && !r && !h) return jsonError(403, "Forbidden");

        try { assertUploadAllowed(p.mimeType, p.fileSizeBytes); }
        catch (e) { return jsonError(400, (e as Error).message); }

        const safeName = p.fileName.replace(/\s+/g, "_");
        const path = `${p.courseId}/${crypto.randomUUID()}-${safeName}`;
        const target = await getStorage(ctx.supabase).createUploadUrl({ bucket: "course-materials", path });
        const { data: row, error } = await ctx.supabase.from("course_materials").insert({
          course_id: p.courseId,
          course_offering_id: p.courseOfferingId ?? null,
          title: p.title,
          description: p.description ?? null,
          storage_bucket: "course-materials",
          storage_path: path,
          file_size_bytes: p.fileSizeBytes,
          mime_type: p.mimeType,
          uploaded_by_user_id: ctx.userId,
        }).select("id").single();
        if (error) return jsonError(500, error.message);

        return Response.json({ material: { id: row.id }, upload: target }, { status: 201 });
      },
    },
  },
});
