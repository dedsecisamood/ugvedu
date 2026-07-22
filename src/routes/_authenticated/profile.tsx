import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  AlertTriangle, Building2, Calendar, CalendarClock, CircleUser, Fingerprint,
  GraduationCap, Hash, Home, IdCard, Layers, Loader2, Lock, Mail, MapPin,
  Phone, Save, ShieldCheck, Smartphone, User, UserRound, Users,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { APP_NAME } from "@/lib/constants";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PhotoCropUpload } from "@/components/profile/photo-crop-upload";
import {
  getMyProfile,
  updateMyProfile,
  changeMyPassword,
  profileUpdateSchema,
  type ProfileUpdateInput,
  type ProfilePayload,
} from "@/lib/profile.functions";

const profileQuery = queryOptions({
  queryKey: ["profile", "self"],
  queryFn: () => getMyProfile(),
});

export const Route = createFileRoute("/_authenticated/profile")({
  component: ProfilePage,
  head: () => ({ meta: [{ title: `Your Profile — ${APP_NAME}` }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(profileQuery),
  errorComponent: ({ error }) => (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader crumb="Your Profile" title="Your Profile" />
      <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-sm">
        Couldn't load your profile. {error.message}
      </div>
    </div>
  ),
  notFoundComponent: () => <div className="p-6">Profile not found.</div>,
});

/* ---------- shared field renderers ---------- */

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-card px-4 py-3">
      <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-4" aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <div className="mt-0.5 text-sm font-semibold text-foreground">{children}</div>
      </div>
    </div>
  );
}

function ReadValue({ value }: { value: string | null | undefined }) {
  return <span className={value ? "" : "text-muted-foreground"}>{value || "N/A"}</span>;
}

function fmtDate(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/* ---------- page ---------- */

function ProfilePage() {
  const { data } = useSuspenseQuery(profileQuery);
  return <ProfileShell initial={data} />;
}

function ProfileShell({ initial }: { initial: ProfilePayload }) {
  const qc = useQueryClient();
  const [photoSrc, setPhotoSrc] = useState<string | null>(initial.photoSignedUrl);

  const deadline = useMemo(() => fmtDate(initial.registrationDeadline), [initial.registrationDeadline]);
  const initials = (initial.fullName || "?")
    .split(/\s+/).map((w) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        crumb="Account"
        title={initial.fullName || "Your Profile"}
        subtitle="Manage your personal information, academic record, and account security."
      />

      {/* Identity strip */}
      <Card className="overflow-hidden border-border/70">
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4">
            <div className="relative">
              {photoSrc ? (
                <img
                  src={photoSrc}
                  alt=""
                  className="size-20 rounded-2xl object-cover ring-2 ring-primary/20"
                />
              ) : (
                <div className="flex size-20 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground ring-2 ring-primary/20">
                  {initials}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                {initial.department.code ?? "—"} · Roll {initial.studentId ?? "—"}
              </p>
              <h2 className="mt-0.5 truncate text-xl font-bold text-foreground">
                {initial.fullName || "Student"}
              </h2>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                {initial.program ?? "—"} · {initial.currentSemesterName ?? "—"}
              </p>
            </div>
          </div>
          <div className="sm:ml-auto">
            <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400">
              <ShieldCheck className="mr-1 size-3.5" aria-hidden /> {initial.studentStatus ?? "ACTIVE"}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Deadline banner */}
      {deadline && (
        <div
          role="alert"
          className="rounded-xl border border-amber-400/50 bg-amber-50 p-4 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
            <div className="text-sm">
              <p className="font-semibold">Register before {deadline}</p>
              <p className="mt-1 text-amber-900/80 dark:text-amber-200/80">
                If you do not complete semester registration before the deadline, the following will apply:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-amber-900/80 dark:text-amber-200/80">
                <li>A registration fine will be added to your ledger.</li>
                <li>Your access to classrooms will be removed.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      <Tabs defaultValue="personal" className="space-y-6">
        <TabsList className="h-auto flex-wrap gap-1 bg-muted/60 p-1">
          <TabsTrigger value="personal" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <UserRound className="size-4" aria-hidden /> Personal
          </TabsTrigger>
          <TabsTrigger value="academic" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <GraduationCap className="size-4" aria-hidden /> Academic
          </TabsTrigger>
          <TabsTrigger value="contact" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Phone className="size-4" aria-hidden /> Contact
          </TabsTrigger>
          <TabsTrigger value="password" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Lock className="size-4" aria-hidden /> Password
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personal">
          <PersonalTab initial={initial} photoSrc={photoSrc} onPhoto={(u) => { setPhotoSrc(u); qc.invalidateQueries({ queryKey: ["profile", "self"] }); }} />
        </TabsContent>
        <TabsContent value="academic">
          <AcademicTab initial={initial} />
        </TabsContent>
        <TabsContent value="contact">
          <ContactTab initial={initial} />
        </TabsContent>
        <TabsContent value="password">
          <PasswordTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- PERSONAL ---------- */

function PersonalTab({
  initial,
  photoSrc,
  onPhoto,
}: {
  initial: ProfilePayload;
  photoSrc: string | null;
  onPhoto: (signed: string | null) => void;
}) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const form = useForm<ProfileUpdateInput, unknown, ProfileUpdateInput>({
    resolver: zodResolver(profileUpdateSchema) as unknown as import("react-hook-form").Resolver<ProfileUpdateInput, unknown, ProfileUpdateInput>,
    defaultValues: {
      phone: initial.editable.phone ?? "",
      address: initial.editable.address ?? "",
      present_address: initial.editable.present_address ?? "",
      permanent_address: initial.editable.permanent_address ?? "",
      emergency_contact_name: initial.editable.emergency_contact_name ?? "",
      emergency_contact_phone: initial.editable.emergency_contact_phone ?? "",
      gender: (initial.editable.gender as "Male" | "Female" | "Other" | null) ?? null,
      religion: initial.editable.religion ?? "",
      father_name: initial.editable.father_name ?? "",
      mother_name: initial.editable.mother_name ?? "",
      father_phone: initial.editable.father_phone ?? "",
      national_id: initial.editable.national_id ?? "",
    },
    mode: "onBlur",
  });

  async function save(values: ProfileUpdateInput) {
    setSaving(true);
    try {
      await updateMyProfile({ data: values });
      toast.success("Profile saved");
      await qc.invalidateQueries({ queryKey: ["profile", "self"] });
      form.reset(values, { keepDirty: false });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const gender = form.watch("gender");

  return (
    <Card>
      <CardContent className="space-y-6 p-6">
        {/* Photo */}
        <div className="rounded-xl border border-dashed border-border p-4">
          <PhotoCropUpload
            userId={initial.userId}
            currentSrc={photoSrc}
            onUploaded={(_p, signed) => onPhoto(signed)}
          />
        </div>

        {/* Read-only identity */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field icon={User} label="Full name"><ReadValue value={initial.fullName} /></Field>
          <Field icon={IdCard} label="Roll number"><ReadValue value={initial.studentId} /></Field>
          <Field icon={Hash} label="Registration number"><ReadValue value={initial.registrationNumber} /></Field>
          <Field icon={Fingerprint} label="Application code"><ReadValue value={initial.applicationCode} /></Field>
          <div className="md:col-span-2">
            <Field icon={IdCard} label="National ID (NID)"><ReadValue value={initial.nationalId} /></Field>
          </div>
        </div>

        {/* Editable */}
        <form onSubmit={form.handleSubmit(save)} className="space-y-5" noValidate>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <CircleUser className="size-4" aria-hidden />
              </div>
              <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Gender</Label>
            </div>
            <RadioGroup
              value={gender ?? ""}
              onValueChange={(v) => form.setValue("gender", v as "Male" | "Female" | "Other", { shouldDirty: true })}
              className="flex flex-wrap gap-4"
            >
              {(["Male", "Female", "Other"] as const).map((g) => (
                <label key={g} className="flex items-center gap-2 text-sm font-medium">
                  <RadioGroupItem value={g} id={`g-${g}`} />
                  {g}
                </label>
              ))}
            </RadioGroup>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="religion">Religion</Label>
              <Input id="religion" {...form.register("religion")} placeholder="e.g. Muslim" />
            </div>
            <div>
              <Label htmlFor="father_name">Father's name</Label>
              <Input id="father_name" {...form.register("father_name")} />
            </div>
            <div>
              <Label htmlFor="mother_name">Mother's name</Label>
              <Input id="mother_name" {...form.register("mother_name")} />
            </div>
            <div>
              <Label htmlFor="present_address">Present address</Label>
              <Input id="present_address" {...form.register("present_address")} />
            </div>
            <div className="md:col-span-2">
              <Label htmlFor="permanent_address">Permanent address</Label>
              <Textarea id="permanent_address" rows={2} {...form.register("permanent_address")} />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => form.reset()} disabled={!form.formState.isDirty || saving}>
              Reset
            </Button>
            <Button type="submit" disabled={!form.formState.isDirty || saving}>
              {saving ? <Loader2 className="mr-1 size-4 animate-spin" aria-hidden /> : <Save className="mr-1 size-4" aria-hidden />}
              Save changes
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/* ---------- ACADEMIC ---------- */

function AcademicTab({ initial }: { initial: ProfilePayload }) {
  return (
    <Card>
      <CardContent className="grid grid-cols-1 gap-3 p-6 md:grid-cols-2">
        <Field icon={Building2} label="Department"><ReadValue value={initial.department.name} /></Field>
        <Field icon={GraduationCap} label="Program / Course"><ReadValue value={initial.program} /></Field>
        <Field icon={Calendar} label="Academic session"><ReadValue value={initial.currentSemesterName} /></Field>
        <Field icon={CalendarClock} label="Admission session"><ReadValue value={initial.admissionSemesterName} /></Field>
        <Field icon={Layers} label="Current semester"><ReadValue value={"3rd"} /></Field>
        <Field icon={Users} label="Student group"><ReadValue value={initial.studentGroup} /></Field>
        <Field icon={Home} label="Section"><ReadValue value={initial.section} /></Field>
        <Field icon={Calendar} label="Admission date"><ReadValue value={fmtDate(initial.admissionDate)} /></Field>
        <div className="md:col-span-2">
          <Field icon={ShieldCheck} label="Status">
            <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400">
              <ShieldCheck className="mr-1 size-3.5" aria-hidden /> {initial.studentStatus ?? "ACTIVE"}
            </Badge>
          </Field>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- CONTACT ---------- */

function ContactTab({ initial }: { initial: ProfilePayload }) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  const form = useForm<ProfileUpdateInput, unknown, ProfileUpdateInput>({
    resolver: zodResolver(profileUpdateSchema) as unknown as import("react-hook-form").Resolver<ProfileUpdateInput, unknown, ProfileUpdateInput>,
    defaultValues: {
      phone: initial.editable.phone ?? "",
      father_phone: initial.editable.father_phone ?? "",
      address: initial.editable.address ?? "",
      present_address: initial.editable.present_address ?? "",
      permanent_address: initial.editable.permanent_address ?? "",
      emergency_contact_name: initial.editable.emergency_contact_name ?? "",
      emergency_contact_phone: initial.editable.emergency_contact_phone ?? "",
      gender: (initial.editable.gender as "Male" | "Female" | "Other" | null) ?? null,
      religion: initial.editable.religion ?? "",
      father_name: initial.editable.father_name ?? "",
      mother_name: initial.editable.mother_name ?? "",
      national_id: initial.editable.national_id ?? "",
    },
    mode: "onBlur",
  });

  async function save(values: ProfileUpdateInput) {
    setSaving(true);
    try {
      await updateMyProfile({ data: values });
      toast.success("Contact info saved");
      await qc.invalidateQueries({ queryKey: ["profile", "self"] });
      form.reset(values, { keepDirty: false });
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const err = form.formState.errors;

  return (
    <Card>
      <CardContent className="space-y-6 p-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field icon={Mail} label="Email address"><ReadValue value={initial.email} /></Field>
        </div>

        <form onSubmit={form.handleSubmit(save)} className="space-y-5" noValidate>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="phone">Contact number</Label>
              <Input id="phone" autoComplete="tel" {...form.register("phone")} aria-invalid={!!err.phone} />
              {err.phone && <p className="mt-1 text-xs font-medium text-destructive">{err.phone.message}</p>}
            </div>
            <div>
              <Label htmlFor="father_phone">Father's phone</Label>
              <Input id="father_phone" autoComplete="tel" {...form.register("father_phone")} aria-invalid={!!err.father_phone} />
              {err.father_phone && <p className="mt-1 text-xs font-medium text-destructive">{err.father_phone.message}</p>}
            </div>
            <div>
              <Label htmlFor="present_address">Present address</Label>
              <Input id="present_address" {...form.register("present_address")} />
            </div>
            <div>
              <Label htmlFor="permanent_address">Permanent address</Label>
              <Input id="permanent_address" {...form.register("permanent_address")} />
            </div>
            <div>
              <Label htmlFor="ecn">Emergency contact name</Label>
              <Input id="ecn" {...form.register("emergency_contact_name")} />
            </div>
            <div>
              <Label htmlFor="ecp">Emergency contact phone</Label>
              <Input id="ecp" autoComplete="tel" {...form.register("emergency_contact_phone")} aria-invalid={!!err.emergency_contact_phone} />
              {err.emergency_contact_phone && (
                <p className="mt-1 text-xs font-medium text-destructive">{err.emergency_contact_phone.message}</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => form.reset()} disabled={!form.formState.isDirty || saving}>
              Reset
            </Button>
            <Button type="submit" disabled={!form.formState.isDirty || saving}>
              {saving ? <Loader2 className="mr-1 size-4 animate-spin" aria-hidden /> : <Save className="mr-1 size-4" aria-hidden />}
              Save changes
            </Button>
          </div>
        </form>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Field icon={Smartphone} label="Current on file"><ReadValue value={initial.editable.phone} /></Field>
          <Field icon={MapPin} label="On record"><ReadValue value={initial.presentAddress} /></Field>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------- PASSWORD ---------- */

const pwSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password"),
    newPassword: z.string().min(8, "At least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ["confirmPassword"],
    message: "Passwords do not match",
  });

type PwInput = z.infer<typeof pwSchema>;

function PasswordTab() {
  const [saving, setSaving] = useState(false);
  const form = useForm<PwInput>({
    resolver: zodResolver(pwSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
  });

  async function save(values: PwInput) {
    setSaving(true);
    try {
      await changeMyPassword({
        data: { currentPassword: values.currentPassword, newPassword: values.newPassword },
      });
      toast.success("Password updated");
      form.reset();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not change password");
    } finally {
      setSaving(false);
    }
  }

  const err = form.formState.errors;

  return (
    <Card>
      <CardContent className="p-6">
        <form onSubmit={form.handleSubmit(save)} className="grid max-w-lg grid-cols-1 gap-4" noValidate>
          <div>
            <Label htmlFor="cur">Current password</Label>
            <Input id="cur" type="password" autoComplete="current-password" {...form.register("currentPassword")} aria-invalid={!!err.currentPassword} />
            {err.currentPassword && <p className="mt-1 text-xs font-medium text-destructive">{err.currentPassword.message}</p>}
          </div>
          <div>
            <Label htmlFor="new">New password</Label>
            <Input id="new" type="password" autoComplete="new-password" {...form.register("newPassword")} aria-invalid={!!err.newPassword} />
            {err.newPassword && <p className="mt-1 text-xs font-medium text-destructive">{err.newPassword.message}</p>}
          </div>
          <div>
            <Label htmlFor="conf">Confirm new password</Label>
            <Input id="conf" type="password" autoComplete="new-password" {...form.register("confirmPassword")} aria-invalid={!!err.confirmPassword} />
            {err.confirmPassword && <p className="mt-1 text-xs font-medium text-destructive">{err.confirmPassword.message}</p>}
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="mr-1 size-4 animate-spin" aria-hidden /> : <Lock className="mr-1 size-4" aria-hidden />}
              Update password
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
