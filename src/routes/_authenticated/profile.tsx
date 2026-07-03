import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { APP_NAME } from "@/lib/constants";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PhotoCropUpload } from "@/components/profile/photo-crop-upload";
import {
  getMyProfile,
  updateMyProfile,
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
});

function ReadOnlyField({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-wider text-muted-foreground">{label}</Label>
      <p className="mt-1 flex min-h-9 items-center rounded-md bg-muted px-3 py-1.5 text-sm text-foreground">
        {value || "—"}
      </p>
    </div>
  );
}

function ProfilePage() {
  const { data } = useSuspenseQuery(profileQuery);
  return <ProfileForm initial={data} />;
}

function ProfileForm({ initial }: { initial: ProfilePayload }) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [photoSrc, setPhotoSrc] = useState<string | null>(initial.photoSignedUrl);

  const form = useForm<ProfileUpdateInput>({
    resolver: zodResolver(profileUpdateSchema),
    defaultValues: {
      phone: initial.editable.phone ?? "",
      address: initial.editable.address ?? "",
      emergency_contact_name: initial.editable.emergency_contact_name ?? "",
      emergency_contact_phone: initial.editable.emergency_contact_phone ?? "",
    },
    mode: "onBlur",
  });

  async function onSubmit(values: ProfileUpdateInput) {
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

  const err = form.formState.errors;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader
        crumb="Your Profile"
        title={initial.fullName || "Your Profile"}
        subtitle="Keep your contact info current so the university can reach you."
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        {/* Left: photo + academic info (read-only) */}
        <div className="space-y-6">
          <Card>
            <CardContent className="p-6">
              <PhotoCropUpload
                userId={initial.userId}
                currentSrc={photoSrc}
                onUploaded={(_path, signed) => {
                  setPhotoSrc(signed);
                  qc.invalidateQueries({ queryKey: ["profile", "self"] });
                }}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                Academic
                <Badge variant="secondary" className="uppercase tracking-wider text-[10px]">Read-only</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ReadOnlyField label="Student ID" value={initial.studentId} />
              <ReadOnlyField label="Department" value={initial.department.name} />
              <ReadOnlyField label="Program" value={initial.program} />
              <ReadOnlyField label="Current semester" value={initial.currentSemesterName} />
              <ReadOnlyField label="Admission" value={initial.admissionSemesterName} />
              <ReadOnlyField label="Status" value={initial.studentStatus} />
            </CardContent>
          </Card>
        </div>

        {/* Right: editable form */}
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6" noValidate>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Personal information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <ReadOnlyField label="Full name" value={initial.fullName} />
              <ReadOnlyField label="Email" value={initial.email} />

              <div>
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  {...form.register("phone")}
                  aria-invalid={!!err.phone}
                  aria-describedby={err.phone ? "phone-error" : undefined}
                  placeholder="+880 1712 345678"
                  autoComplete="tel"
                />
                {err.phone && (
                  <p id="phone-error" role="alert" className="mt-1 text-xs font-medium text-destructive">
                    {err.phone.message}
                  </p>
                )}
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  rows={3}
                  {...form.register("address")}
                  aria-invalid={!!err.address}
                  aria-describedby={err.address ? "address-error" : undefined}
                  placeholder="House, road, area, city"
                />
                {err.address && (
                  <p id="address-error" role="alert" className="mt-1 text-xs font-medium text-destructive">
                    {err.address.message}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Emergency contact</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="ecn">Contact name</Label>
                <Input
                  id="ecn"
                  {...form.register("emergency_contact_name")}
                  aria-invalid={!!err.emergency_contact_name}
                  aria-describedby={err.emergency_contact_name ? "ecn-error" : undefined}
                  placeholder="e.g. Parent, guardian"
                />
                {err.emergency_contact_name && (
                  <p id="ecn-error" role="alert" className="mt-1 text-xs font-medium text-destructive">
                    {err.emergency_contact_name.message}
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="ecp">Contact phone</Label>
                <Input
                  id="ecp"
                  {...form.register("emergency_contact_phone")}
                  aria-invalid={!!err.emergency_contact_phone}
                  aria-describedby={err.emergency_contact_phone ? "ecp-error" : undefined}
                  placeholder="+880 1712 345678"
                  autoComplete="tel"
                />
                {err.emergency_contact_phone && (
                  <p id="ecp-error" role="alert" className="mt-1 text-xs font-medium text-destructive">
                    {err.emergency_contact_phone.message}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

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
      </div>
    </div>
  );
}
