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

const optStr = (max: number) =>
  z.string().trim().max(max).optional().or(z.literal("")).transform((v) => (v ? v : null));

export const profileUpdateSchema = z.object({
  phone: phone.optional().or(z.literal("")).transform((v) => (v ? v : null)),
  address: optStr(500),
  present_address: optStr(300),
  permanent_address: optStr(300),
  emergency_contact_name: optStr(100),
  emergency_contact_phone: phone.optional().or(z.literal("")).transform((v) => (v ? v : null)),
  gender: z.enum(["Male", "Female", "Other"]).optional().nullable(),
  religion: optStr(50),
  father_name: optStr(100),
  mother_name: optStr(100),
  father_phone: phone.optional().or(z.literal("")).transform((v) => (v ? v : null)),
  national_id: optStr(30),
});

export type ProfileUpdateInput = z.input<typeof profileUpdateSchema>;

export type ProfilePayload = {
  userId: string;
  fullName: string;
  studentId: string | null;
  email: string | null;
  photoPath: string | null;
  photoSignedUrl: string | null;
  department: { id: string | null; code: string | null; name: string | null };
  program: string | null;
  currentSemesterName: string | null;
  admissionSemesterName: string | null;
  studentStatus: string | null;
  registrationNumber: string | null;
  applicationCode: string | null;
  nationalId: string | null;
  gender: string | null;
  religion: string | null;
  fatherName: string | null;
  motherName: string | null;
  presentAddress: string | null;
  permanentAddress: string | null;
  fatherPhone: string | null;
  section: string | null;
  studentGroup: string | null;
  admissionDate: string | null;
  registrationDeadline: string | null;
  editable: {
    phone: string | null;
    address: string | null;
    present_address: string | null;
    permanent_address: string | null;
    emergency_contact_name: string | null;
    emergency_contact_phone: string | null;
    gender: string | null;
    religion: string | null;
    father_name: string | null;
    mother_name: string | null;
    father_phone: string | null;
    national_id: string | null;
  };
};

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProfilePayload> => {
    const { supabase, userId, claims } = context;

    const { data: prof, error } = await supabase
      .from("profiles")
      .select("*")
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

    const p = (prof ?? {}) as Record<string, string | null>;

    let signed: string | null = null;
    if (p.photo_url) {
      const { data: sig } = await supabase.storage.from("avatars").createSignedUrl(p.photo_url, 60 * 60);
      signed = sig?.signedUrl ?? null;
    }

    return {
      userId,
      fullName: p.full_name ?? "",
      studentId: p.student_id ?? s?.student_id ?? null,
      email: (claims as { email?: string } | null)?.email ?? null,
      photoPath: p.photo_url ?? null,
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
      registrationNumber: p.registration_number ?? null,
      applicationCode: p.application_code ?? null,
      nationalId: p.national_id ?? null,
      gender: p.gender ?? null,
      religion: p.religion ?? null,
      fatherName: p.father_name ?? null,
      motherName: p.mother_name ?? null,
      presentAddress: p.present_address ?? null,
      permanentAddress: p.permanent_address ?? null,
      fatherPhone: p.father_phone ?? null,
      section: p.section ?? null,
      studentGroup: p.student_group ?? null,
      admissionDate: p.admission_date ?? null,
      registrationDeadline: p.registration_deadline ?? null,
      editable: {
        phone: p.phone ?? null,
        address: p.address ?? null,
        present_address: p.present_address ?? null,
        permanent_address: p.permanent_address ?? null,
        emergency_contact_name: p.emergency_contact_name ?? null,
        emergency_contact_phone: p.emergency_contact_phone ?? null,
        gender: p.gender ?? null,
        religion: p.religion ?? null,
        father_name: p.father_name ?? null,
        mother_name: p.mother_name ?? null,
        father_phone: p.father_phone ?? null,
        national_id: p.national_id ?? null,
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
        present_address: data.present_address,
        permanent_address: data.permanent_address,
        emergency_contact_name: data.emergency_contact_name,
        emergency_contact_phone: data.emergency_contact_phone,
        gender: data.gender ?? null,
        religion: data.religion,
        father_name: data.father_name,
        mother_name: data.mother_name,
        father_phone: data.father_phone,
        national_id: data.national_id,
      })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const changeMyPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) =>
    z
      .object({
        currentPassword: z.string().min(1, "Current password required"),
        newPassword: z.string().min(8, "Password must be at least 8 characters"),
      })
      .parse(raw),
  )
  .handler(async ({ context, data }) => {
    const { supabase, claims } = context;
    const email = (claims as { email?: string } | null)?.email;
    if (!email) throw new Error("No email on account");
    const { error: reErr } = await supabase.auth.signInWithPassword({
      email,
      password: data.currentPassword,
    });
    if (reErr) throw new Error("Current password is incorrect");
    const { error } = await supabase.auth.updateUser({ password: data.newPassword });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setMyProfilePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: unknown) => z.object({ path: z.string().min(1).max(500) }).parse(raw))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    if (!data.path.startsWith(`${userId}/`)) {
      throw new Error("Photo must be uploaded to your own folder");
    }
    const { error } = await supabase.from("profiles").update({ photo_url: data.path }).eq("id", userId);
    if (error) throw new Error(error.message);
    const { data: sig } = await supabase.storage.from("avatars").createSignedUrl(data.path, 60 * 60);
    return { ok: true, signedUrl: sig?.signedUrl ?? null };
  });
