/**
 * /course-materials — list resources per course, request signed upload/download URLs.
 * Uploads restricted to staff (RLS enforces on both public.course_materials and
 * storage.objects). MIME + size validated server-side; never trust the client.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  encodeCursor, decodeCursor, cursorSchema, pageSizeSchema, type PageEnvelope,
  type ApiRow,
} from "./pagination";
import { getStorage, ALLOWED_MIME_TYPES, MAX_UPLOAD_BYTES, assertUploadAllowed } from "./storage";

const listInput = z.object({
  courseId: z.string().uuid().optional(),
  courseOfferingId: z.string().uuid().optional(),
  cursor: cursorSchema,
  pageSize: pageSizeSchema,
}).refine((v) => v.courseId || v.courseOfferingId, {
  message: "courseId or courseOfferingId is required",
});

export const listCourseMaterials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => listInput.parse(raw))
  .handler(async ({ data, context }): Promise<PageEnvelope<ApiRow>> => {
    const { supabase } = context;
    let q = supabase
      .from("course_materials")
      .select("id, course_id, course_offering_id, title, description, storage_bucket, storage_path, file_size_bytes, mime_type, created_at", { count: "exact" })
      .is("deleted_at", null);
    if (data.courseId) q = q.eq("course_id", data.courseId);
    if (data.courseOfferingId) q = q.eq("course_offering_id", data.courseOfferingId);

    const cur = decodeCursor(data.cursor);
    q = q.order("created_at", { ascending: false }).order("id", { ascending: false });
    if (cur) {
      q = q.or(`created_at.lt.${cur.createdAt},and(created_at.eq.${cur.createdAt},id.lt.${cur.id})`);
    }
    q = q.limit(data.pageSize + 1);

    const { data: rows, error, count } = await q;
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    const hasMore = list.length > data.pageSize;
    const page = hasMore ? list.slice(0, data.pageSize) : list;
    const last = page[page.length - 1];
    return {
      data: page,
      nextCursor: hasMore && last ? encodeCursor({ created_at: last.created_at, id: last.id }) : null,
      total: count ?? page.length,
    };
  });

const uploadReqInput = z.object({
  courseId: z.string().uuid(),
  courseOfferingId: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
  fileName: z.string().trim().min(1).max(200)
    .regex(/^[A-Za-z0-9._\-\s()]+$/, "Invalid filename"),
  mimeType: z.string().refine((v) => ALLOWED_MIME_TYPES.has(v), {
    message: "Unsupported file type",
  }),
  fileSizeBytes: z.number().int().positive().max(MAX_UPLOAD_BYTES),
});

export const requestMaterialUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => uploadReqInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // Only staff can upload.
    const [{ data: isAdmin }, { data: isReg }, { data: isHead }] = await Promise.all([
      supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "registrar" }),
      supabase.rpc("has_role", { _user_id: userId, _role: "department_head" }),
    ]);
    if (!isAdmin && !isReg && !isHead) throw new Error("Forbidden");

    assertUploadAllowed(data.mimeType, data.fileSizeBytes);

    const safeName = data.fileName.replace(/\s+/g, "_");
    const path = `${data.courseId}/${crypto.randomUUID()}-${safeName}`;
    const storage = getStorage(supabase);
    const target = await storage.createUploadUrl({ bucket: "course-materials", path });

    // Insert row eagerly so ownership is tracked even if the client abandons the upload.
    const { data: row, error } = await supabase.from("course_materials").insert({
      course_id: data.courseId,
      course_offering_id: data.courseOfferingId ?? null,
      title: data.title,
      description: data.description ?? null,
      storage_bucket: "course-materials",
      storage_path: path,
      file_size_bytes: data.fileSizeBytes,
      mime_type: data.mimeType,
      uploaded_by_user_id: userId,
    }).select("id").single();
    if (error) throw new Error(error.message);

    return { material: { id: row.id }, upload: target };
  });

const dlInput = z.object({ materialId: z.string().uuid() });

export const getMaterialDownloadUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => dlInput.parse(raw))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: row, error } = await supabase
      .from("course_materials")
      .select("storage_bucket, storage_path")
      .eq("id", data.materialId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Not found");
    const storage = getStorage(supabase);
    return storage.createDownloadUrl({ bucket: row.storage_bucket, path: row.storage_path, expiresInSec: 300 });
  });
