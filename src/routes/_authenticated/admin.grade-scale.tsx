/**
 * Admin — grade scale editor. Letters, grade points, and pass/fail flags
 * live in the DB (per UGV's non-standard scale) — never hardcode in the
 * app. Deleting a letter that is currently in use is blocked by FK.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { listGradeScale, upsertGradeScale, deleteGradeScale, type GradeScaleRow } from "@/lib/admin-config.functions";

export const Route = createFileRoute("/_authenticated/admin/grade-scale")({ component: GradeScalePage });

const EMPTY: GradeScaleRow = { letter: "", gradePoint: 0, isFail: false, minPercent: null, maxPercent: null, sortOrder: 0 };

function GradeScalePage() {
  const qc = useQueryClient();
  const listFn = useServerFn(listGradeScale);
  const upsertFn = useServerFn(upsertGradeScale);
  const delFn = useServerFn(deleteGradeScale);
  const { data } = useQuery({ queryKey: ["grade-scale"], queryFn: () => listFn() });

  const [draft, setDraft] = useState<GradeScaleRow>(EMPTY);

  const upsertMut = useMutation({
    mutationFn: (v: GradeScaleRow) => upsertFn({ data: v }),
    onSuccess: () => {
      toast.success("Saved");
      setDraft(EMPTY);
      qc.invalidateQueries({ queryKey: ["grade-scale"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });
  const delMut = useMutation({
    mutationFn: (letter: string) => delFn({ data: { letter } }),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["grade-scale"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed (in use?)"),
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader crumb="Administration" title="Grade scale" subtitle="Letter → grade point mapping used by the GPA engine." />

      <Card>
        <CardHeader><CardTitle>Add or update a letter</CardTitle></CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-6">
            <div><Label>Letter</Label><Input value={draft.letter} onChange={(e) => setDraft({ ...draft, letter: e.target.value.toUpperCase() })} placeholder="A" /></div>
            <div><Label>Grade point</Label><Input type="number" step="0.05" value={draft.gradePoint ?? ""} onChange={(e) => setDraft({ ...draft, gradePoint: e.target.value === "" ? null : Number(e.target.value) })} /></div>
            <div><Label>Min %</Label><Input type="number" value={draft.minPercent ?? ""} onChange={(e) => setDraft({ ...draft, minPercent: e.target.value === "" ? null : Number(e.target.value) })} /></div>
            <div><Label>Max %</Label><Input type="number" value={draft.maxPercent ?? ""} onChange={(e) => setDraft({ ...draft, maxPercent: e.target.value === "" ? null : Number(e.target.value) })} /></div>
            <div><Label>Sort order</Label><Input type="number" value={draft.sortOrder} onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) })} /></div>
            <div className="flex items-end gap-3">
              <div className="flex items-center gap-2"><Switch checked={draft.isFail} onCheckedChange={(v) => setDraft({ ...draft, isFail: v })} id="isFail" /><Label htmlFor="isFail">Failing</Label></div>
            </div>
            <div className="sm:col-span-6">
              <Button disabled={upsertMut.isPending || !draft.letter} onClick={() => upsertMut.mutate(draft)}>
                <Plus className="size-4" /> Save
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Current scale</CardTitle></CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Letter</TableHead><TableHead>Grade point</TableHead><TableHead>Range</TableHead><TableHead>Fail?</TableHead><TableHead>Sort</TableHead><TableHead /></TableRow>
              </TableHeader>
              <TableBody>
                {(data ?? []).map((r) => (
                  <TableRow key={r.letter}>
                    <TableCell className="font-mono text-base font-bold">{r.letter}</TableCell>
                    <TableCell>{r.gradePoint ?? "—"}</TableCell>
                    <TableCell>{r.minPercent !== null && r.maxPercent !== null ? `${r.minPercent}–${r.maxPercent}%` : "—"}</TableCell>
                    <TableCell>{r.isFail ? "Yes" : "No"}</TableCell>
                    <TableCell>{r.sortOrder}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => setDraft(r)}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => delMut.mutate(r.letter)}><Trash2 className="size-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
