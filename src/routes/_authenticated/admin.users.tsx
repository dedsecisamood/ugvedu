/**
 * Admin — user management.
 * Create accounts, assign/revoke roles, deactivate. Cannot revoke your own
 * admin role or deactivate your own account (guarded server-side too).
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/state/error-state";
import {
  listUsers, createUser, assignRole, revokeRole, setUserActive,
  type UserListRow,
} from "@/lib/admin-users.functions";

const ROLE_OPTIONS = ["student", "department_head", "registrar", "admin"] as const;

const createSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "At least 8 characters"),
  fullName: z.string().trim().min(1),
  role: z.enum(ROLE_OPTIONS),
});
type CreateForm = z.infer<typeof createSchema>;

export const Route = createFileRoute("/_authenticated/admin/users")({ component: UsersPage });

function UsersPage() {
  const qc = useQueryClient();
  const fetch = useServerFn(listUsers);
  const create = useServerFn(createUser);
  const assign = useServerFn(assignRole);
  const revoke = useServerFn(revokeRole);
  const setActive = useServerFn(setUserActive);

  const { data: users, isLoading, error, refetch } = useQuery({
    queryKey: ["admin-users"], queryFn: () => fetch(),
  });

  const form = useForm<CreateForm>({
    resolver: zodResolver(createSchema),
    defaultValues: { email: "", password: "", fullName: "", role: "student" },
  });
  const createMut = useMutation({
    mutationFn: (v: CreateForm) => create({ data: v }),
    onSuccess: () => {
      toast.success("User created");
      form.reset({ email: "", password: "", fullName: "", role: "student" });
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Create failed"),
  });
  const assignMut = useMutation({
    mutationFn: (v: { userId: string; role: typeof ROLE_OPTIONS[number] }) => assign({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Assign failed"),
  });
  const revokeMut = useMutation({
    mutationFn: (v: { userId: string; role: typeof ROLE_OPTIONS[number] }) => revoke({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Revoke failed"),
  });
  const activeMut = useMutation({
    mutationFn: (v: { userId: string; active: boolean }) => setActive({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-users"] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader crumb="Administration" title="User management" subtitle="Create accounts, assign roles, deactivate." />

      <Card>
        <CardHeader><CardTitle>Create a new account</CardTitle></CardHeader>
        <CardContent>
          <form
            onSubmit={form.handleSubmit((v) => createMut.mutate(v))}
            className="grid gap-4 sm:grid-cols-4"
          >
            <div className="sm:col-span-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...form.register("email")} />
              {form.formState.errors.email && <p className="mt-1 text-xs text-destructive">{form.formState.errors.email.message}</p>}
            </div>
            <div>
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" {...form.register("fullName")} />
              {form.formState.errors.fullName && <p className="mt-1 text-xs text-destructive">{form.formState.errors.fullName.message}</p>}
            </div>
            <div>
              <Label htmlFor="role">Role</Label>
              <Select value={form.watch("role")} onValueChange={(v) => form.setValue("role", v as typeof ROLE_OPTIONS[number])}>
                <SelectTrigger id="role"><SelectValue /></SelectTrigger>
                <SelectContent>{ROLE_OPTIONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="password">Temporary password</Label>
              <Input id="password" type="text" autoComplete="new-password" {...form.register("password")} />
              {form.formState.errors.password && <p className="mt-1 text-xs text-destructive">{form.formState.errors.password.message}</p>}
            </div>
            <div className="sm:col-span-4">
              <Button type="submit" disabled={createMut.isPending}>Create user</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Users ({users?.length ?? 0})</CardTitle></CardHeader>
        <CardContent className="p-0">
          {error && <div className="p-6"><ErrorState onRetry={() => refetch()} /></div>}
          {isLoading && <div className="space-y-2 p-6"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>}
          {users && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name / Email</TableHead>
                    <TableHead>Student ID</TableHead>
                    <TableHead>Roles</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => <UserRow key={u.userId} u={u}
                    onAssign={(role) => assignMut.mutate({ userId: u.userId, role })}
                    onRevoke={(role) => revokeMut.mutate({ userId: u.userId, role })}
                    onToggle={() => activeMut.mutate({ userId: u.userId, active: !u.isActive })}
                  />)}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function UserRow({ u, onAssign, onRevoke, onToggle }: {
  u: UserListRow;
  onAssign: (r: typeof ROLE_OPTIONS[number]) => void;
  onRevoke: (r: typeof ROLE_OPTIONS[number]) => void;
  onToggle: () => void;
}) {
  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{u.fullName ?? "—"}</div>
        <div className="text-xs text-muted-foreground">{u.email ?? "—"}</div>
      </TableCell>
      <TableCell className="whitespace-nowrap">{u.studentId ?? "—"}{u.departmentCode ? <span className="ml-1 text-xs text-muted-foreground">({u.departmentCode})</span> : null}</TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {u.roles.length ? u.roles.map((r) => (
            <button key={r} onClick={() => onRevoke(r)} title="Click to revoke" className="group">
              <Badge variant="secondary" className="cursor-pointer group-hover:bg-destructive/10 group-hover:text-destructive">{r} ×</Badge>
            </button>
          )) : <span className="text-xs text-muted-foreground">none</span>}
        </div>
      </TableCell>
      <TableCell>
        {u.isActive ? <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Active</Badge> : <Badge variant="destructive">Disabled</Badge>}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-2">
          <Select value="" onValueChange={(v) => v && onAssign(v as typeof ROLE_OPTIONS[number])}>
            <SelectTrigger className="h-8 w-[150px]"><SelectValue placeholder="Assign role…" /></SelectTrigger>
            <SelectContent>{ROLE_OPTIONS.filter((r) => !u.roles.includes(r)).map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" variant={u.isActive ? "outline" : "default"} onClick={onToggle}>{u.isActive ? "Deactivate" : "Reactivate"}</Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
