/**
 * Admin — semester registration windows. Times are stored as ISO in UTC;
 * the picker uses the browser's timezone for display and converts on save.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listSemesters, updateSemesterWindow } from "@/lib/admin-config.functions";

export const Route = createFileRoute("/_authenticated/admin/semesters")({ component: SemestersPage });

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}
function fromLocalInput(v: string): string | null {
  if (!v) return null;
  return new Date(v).toISOString();
}

function SemestersPage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listSemesters);
  const updFn = useServerFn(updateSemesterWindow);
  const { data } = useQuery({ queryKey: ["admin-semesters"], queryFn: () => listFn() });
  const [drafts, setDrafts] = useState<Record<string, { opens: string; closes: string }>>({});
  const mut = useMutation({
    mutationFn: (v: { id: string; registrationOpensAt: string | null; registrationClosesAt: string | null }) => updFn({ data: v }),
    onSuccess: () => { toast.success("Window updated"); qc.invalidateQueries({ queryKey: ["admin-semesters"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Update failed"),
  });

  const now = Date.now();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader crumb="Administration" title="Semesters" subtitle="Open and close registration windows per semester." />
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Semester</TableHead>
                  <TableHead>Opens</TableHead>
                  <TableHead>Closes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((s) => {
                  const d = drafts[s.id] ?? { opens: toLocalInput(s.registrationOpensAt), closes: toLocalInput(s.registrationClosesAt) };
                  const opensAt = s.registrationOpensAt ? new Date(s.registrationOpensAt).getTime() : null;
                  const closesAt = s.registrationClosesAt ? new Date(s.registrationClosesAt).getTime() : null;
                  const open = opensAt && closesAt && now >= opensAt && now <= closesAt;
                  return (
                    <TableRow key={s.id}>
                      <TableCell><div className="font-medium">{s.name}</div><div className="text-xs text-muted-foreground">{s.term} {s.year}</div></TableCell>
                      <TableCell><Input type="datetime-local" value={d.opens} onChange={(e) => setDrafts({ ...drafts, [s.id]: { ...d, opens: e.target.value } })} /></TableCell>
                      <TableCell><Input type="datetime-local" value={d.closes} onChange={(e) => setDrafts({ ...drafts, [s.id]: { ...d, closes: e.target.value } })} /></TableCell>
                      <TableCell>{open ? <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Open</Badge> : <Badge variant="secondary">Closed</Badge>}{s.isCurrent && <Badge variant="outline" className="ml-1">Current</Badge>}</TableCell>
                      <TableCell className="text-right"><Button size="sm" onClick={() => mut.mutate({ id: s.id, registrationOpensAt: fromLocalInput(d.opens), registrationClosesAt: fromLocalInput(d.closes) })} disabled={mut.isPending}>Save</Button></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
        <CardHeader className="pt-0"><Label className="text-xs text-muted-foreground">Times shown in your local timezone; saved as UTC.</Label></CardHeader>
      </Card>
    </div>
  );
}
