/**
 * Profile server functions: read self, update editable fields, set photo URL.
 * Photos are uploaded client-side directly to Storage (RLS scopes to user folder);
 * this fn only records the resulting path on the profile row.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Loose international phone: 7-20 chars, digits/spaces/+()-. Trimmed in schema.
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9 ()-]{7,20}$/, "Enter a valid phone number (7–20 digits)");

export const profileUpdateSchema = z.object({
  phone: phone.optional().or(z.literal("")).transform((v) => (v ? v : null)),
  address: z
    .string()
    .trim()
    .max(500, "Address must be 500 characters or fewer")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  emergency_contact_name: z
    .string()
    .trim()
    .max(100, "Name must be 100 characters or fewer")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  emergency_contact_phone: phone.optional().or(z.literal("")).transform((v) => (v ? v : null)),
});

export type ProfileUpdateInput = z.input<typeof profileUpdateSchema>;

export type ProfilePayload = {
  userId: string;
  fullName: string;
  studentId: string | null;
  email: string | null;
  photoPath: string | null; // storage path in "avatars" bucket
  photoSignedUrl: string | null;
  department: {
    id: string | null;
    code: string | null;
    name: string | null;
  };
  program: string | null;
  currentSemesterName: string | null;
  admissionSemesterName: string | null;
  studentStatus: string | null;
  editable: {
    phone: string | null;
    address: string | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
  };
};

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProfilePayload> => {
    const { supabase, userId, claims } = context;

    const { data: prof, error } = await supabase
      .from("profiles")
      .select(
        "id, full_name, student_id, photo_url, phone, address, emergency_contact_name, emergency_contact_phone",
      )
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);

    const { data: student } = await supabase
      .from("students")
      .select(
        "student_id, status, departments(id, code, name), programs(name), current:semesters!students_current_semester_id_fkey(name), admission:semesters!students_admission_semester_id_fkey(name)",
      )
      .eq("user_id", userId)
      .maybeSingle();

    const s = student as unknown as {
      student_id: string | null;
      status: string | null;
      departments: { id: string; code: string; name: string } | null;
      programs: { name: string } | null;
      current: { name: string } | null;
      admission: { name: string } | null;
    } | null;

    // Signed URL for the avatar (bucket is private)
    let signed: string | null = null;
    if (prof?.photo_url) {
      const { data: sig } = await supabase.storage.from("avatars").createSignedUrl(prof.photo_url, 60 * 60);
      signed = sig?.signedUrl ?? null;
    }

    return {
      userId,
      fullName: prof?.full_name ?? "",
      studentId: prof?.student_id ?? s?.student_id ?? null,
      email: (claims as { email?: string } | null)?.email ?? null,
      photoPath: prof?.photo_url ?? null,
      photoSignedUrl: signed,
      department: {
        id: s?.departments?.id ?? null,
        code: s?.departments?.code ?? null,
        name: s?.departments?.name ?? null,
      },
      program: s?.programs?.name ?? null,
      currentSemesterName: s?.current?.name ?? null,
      admissionSemesterName: s?.admission?.name ?? null,
      studentStatus: s?.status ?? null,
      editable: {
        phone: prof?.phone ?? null,
        address: prof?.address ?? null,
        emergency_contact_name: prof?.emergency_contact_name ?? null,
        emergency_contact_phone: prof?.emergency_contact_phone ?? null,
      },
    };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => profileUpdateSchema.parse(raw))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({
        phone: data.phone,
        address: data.address,
        emergency_contact_name: data.emergency_contact_name,
        emergency_contact_phone: data.emergency_contact_phone,
      })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setMyProfilePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ path: z.string().min(1).max(500) }).parse(raw))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    // Path must live inside this user's folder — belt+braces around the storage RLS.
    if (!data.path.startsWith(`${userId}/`)) {
      throw new Error("Photo must be uploaded to your own folder");
    }
    const { error } = await supabase.from("profiles").update({ photo_url: data.path }).eq("id", userId);
    if (error) throw new Error(error.message);
    const { data: sig } = await supabase.storage.from("avatars").createSignedUrl(data.path, 60 * 60);
    return { ok: true, signedUrl: sig?.signedUrl ?? null };
  });
