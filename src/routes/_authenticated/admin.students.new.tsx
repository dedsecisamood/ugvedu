/**
 * Admin — student intake.
 * Bind an existing auth user to a new Student row (studentId, name,
 * department, program, admission semester). Program list narrows to the
 * chosen department. Enforces uniqueness on student_id server-side.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useMemo } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { getIntakeOptions, createStudent } from "@/lib/admin-users.functions";

const schema = z.object({
  userId: z.string().uuid("Select a user"),
  studentId: z.string().trim().min(3).max(30),
  fullName: z.string().trim().min(1).max(200),
  departmentId: z.string().uuid("Choose a department"),
  programId: z.string().uuid("Choose a program"),
  admissionSemesterId: z.string().uuid("Choose a semester"),
});
type Form = z.infer<typeof schema>;

export const Route = createFileRoute("/_authenticated/admin/students/new")({ component: IntakePage });

function IntakePage() {
  const qc = useQueryClient();
  const opts = useServerFn(getIntakeOptions);
  const submit = useServerFn(createStudent);
  const { data, isLoading } = useQuery({ queryKey: ["intake-options"], queryFn: () => opts() });

  const form = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { userId: "", studentId: "", fullName: "", departmentId: "", programId: "", admissionSemesterId: "" },
  });

  const deptId = form.watch("departmentId");
  const programsForDept = useMemo(
    () => (data?.programs ?? []).filter((p) => p.departmentId === deptId),
    [data, deptId],
  );

  const mut = useMutation({
    mutationFn: (v: Form) => submit({ data: v }),
    onSuccess: () => {
      toast.success("Student created — they can now sign in and enroll.");
      form.reset({ userId: "", studentId: "", fullName: "", departmentId: "", programId: "", admissionSemesterId: "" });
      qc.invalidateQueries({ queryKey: ["intake-options"] });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to create student"),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        crumb="Administration"
        title="Student intake"
        subtitle="Register a new student roll number. The user account must already exist — create one from Users if needed."
      />

      <Card>
        <CardHeader>
          <CardTitle>New student record</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading || !data ? (
            <div className="space-y-3"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div>
          ) : data.unassignedUsers.length === 0 ? (
            <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              Every existing user is already linked to a student record. <Link to="/admin/users" className="underline">Create an account first</Link>.
            </div>
          ) : (
            <form onSubmit={form.handleSubmit((v) => mut.mutate(v))} className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="userId">Account</Label>
                <Select value={form.watch("userId")} onValueChange={(v) => {
                  form.setValue("userId", v);
                  const u = data.unassignedUsers.find((x) => x.userId === v);
                  if (u?.fullName) form.setValue("fullName", u.fullName);
                }}>
                  <SelectTrigger id="userId"><SelectValue placeholder="Pick an account…" /></SelectTrigger>
                  <SelectContent>
                    {data.unassignedUsers.map((u) => (
                      <SelectItem key={u.userId} value={u.userId}>{u.fullName ?? u.email ?? u.userId}{u.email ? ` — ${u.email}` : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {form.formState.errors.userId && <p className="mt-1 text-xs text-destructive">{form.formState.errors.userId.message}</p>}
              </div>

              <div>
                <Label htmlFor="studentId">Student ID</Label>
                <Input id="studentId" placeholder="e.g. 22521100" {...form.register("studentId")} />
                {form.formState.errors.studentId && <p className="mt-1 text-xs text-destructive">{form.formState.errors.studentId.message}</p>}
              </div>
              <div>
                <Label htmlFor="fullName">Full name</Label>
                <Input id="fullName" {...form.register("fullName")} />
                {form.formState.errors.fullName && <p className="mt-1 text-xs text-destructive">{form.formState.errors.fullName.message}</p>}
              </div>

              <div>
                <Label htmlFor="departmentId">Department</Label>
                <Select value={form.watch("departmentId")} onValueChange={(v) => { form.setValue("departmentId", v); form.setValue("programId", ""); }}>
                  <SelectTrigger id="departmentId"><SelectValue placeholder="Choose…" /></SelectTrigger>
                  <SelectContent>{data.departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.code} — {d.name}</SelectItem>)}</SelectContent>
                </Select>
                {form.formState.errors.departmentId && <p className="mt-1 text-xs text-destructive">{form.formState.errors.departmentId.message}</p>}
              </div>
              <div>
                <Label htmlFor="programId">Program</Label>
                <Select value={form.watch("programId")} onValueChange={(v) => form.setValue("programId", v)} disabled={!deptId}>
                  <SelectTrigger id="programId"><SelectValue placeholder={deptId ? "Choose…" : "Pick a department first"} /></SelectTrigger>
                  <SelectContent>{programsForDept.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
                {form.formState.errors.programId && <p className="mt-1 text-xs text-destructive">{form.formState.errors.programId.message}</p>}
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="admissionSemesterId">Admission semester</Label>
                <Select value={form.watch("admissionSemesterId")} onValueChange={(v) => form.setValue("admissionSemesterId", v)}>
                  <SelectTrigger id="admissionSemesterId"><SelectValue placeholder="Choose…" /></SelectTrigger>
                  <SelectContent>{data.semesters.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
                {form.formState.errors.admissionSemesterId && <p className="mt-1 text-xs text-destructive">{form.formState.errors.admissionSemesterId.message}</p>}
              </div>

              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit" disabled={mut.isPending}>Create student</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
