/**
 * Admin / faculty — grade entry sheet.
 * Pick a course offering → edit each student's letter grade inline
 * (dropdown sourced live from grade_scale) → save as draft. Publish
 * requires an explicit confirmation dialog.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Save, Send } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/state/empty-state";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  listGradeableOfferings, getRoster, saveDraftGrade, publishOfferingGrades,
} from "@/lib/grade-entry.functions";

export const Route = createFileRoute("/_authenticated/admin/grades")({ component: GradesPage });

function GradesPage() {
  const qc = useQueryClient();
  const [offeringId, setOfferingId] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const listFn = useServerFn(listGradeableOfferings);
  const rosterFn = useServerFn(getRoster);
  const saveFn = useServerFn(saveDraftGrade);
  const publishFn = useServerFn(publishOfferingGrades);

  const { data: offerings } = useQuery({ queryKey: ["gradeable-offerings"], queryFn: () => listFn() });
  const { data: roster, isLoading: rosterLoading } = useQuery({
    queryKey: ["roster", offeringId],
    queryFn: () => rosterFn({ data: { offeringId } }),
    enabled: !!offeringId,
  });

  const saveMut = useMutation({
    mutationFn: (v: { enrollmentId: string; letterGrade: string }) => saveFn({ data: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["roster", offeringId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const publishMut = useMutation({
    mutationFn: () => publishFn({ data: { offeringId } }),
    onSuccess: (res) => {
      toast.success(`Published ${res.count} grade${res.count === 1 ? "" : "s"}`);
      qc.invalidateQueries({ queryKey: ["roster", offeringId] });
      setConfirmOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Publish failed"),
  });

  const draftCount = roster?.entries.filter((e) => e.letterGrade && !e.publishedAt).length ?? 0;
  const publishedCount = roster?.entries.filter((e) => e.publishedAt).length ?? 0;
  const totalCount = roster?.entries.length ?? 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader crumb="Administration" title="Grade entry" subtitle="Enter draft grades then publish for the whole class." />

      <Card>
        <CardHeader><CardTitle>Choose a course offering</CardTitle></CardHeader>
        <CardContent>
          <Select value={offeringId} onValueChange={setOfferingId}>
            <SelectTrigger className="max-w-xl"><SelectValue placeholder="Pick an offering…" /></SelectTrigger>
            <SelectContent>
              {(offerings ?? []).map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.courseCode} {o.section ? `(§${o.section}) ` : ""}— {o.courseTitle} · {o.semesterName}
                </SelectItem>
              ))}
              {offerings?.length === 0 && <div className="p-3 text-sm text-muted-foreground">You aren't assigned as instructor for any offering.</div>}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {offeringId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Roster</CardTitle>
              <p className="text-sm text-muted-foreground">
                {totalCount} students · {publishedCount} published · {draftCount} drafts
              </p>
            </div>
            <Button
              disabled={draftCount === 0 || publishMut.isPending}
              onClick={() => setConfirmOpen(true)}
            >
              <Send className="size-4" /> Publish results
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {rosterLoading && <div className="space-y-2 p-6"><Skeleton className="h-10" /><Skeleton className="h-10" /><Skeleton className="h-10" /></div>}
            {roster && roster.entries.length === 0 && <div className="p-6"><EmptyState title="No students enrolled" description="This offering has no enrolled students yet." /></div>}
            {roster && roster.entries.length > 0 && (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student ID</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Grade</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {roster.entries.map((e) => (
                      <TableRow key={e.enrollmentId}>
                        <TableCell className="font-mono text-sm">{e.studentId}</TableCell>
                        <TableCell>{e.fullName}</TableCell>
                        <TableCell>
                          <Select
                            value={e.letterGrade ?? ""}
                            disabled={!!e.publishedAt}
                            onValueChange={(v) => saveMut.mutate({ enrollmentId: e.enrollmentId, letterGrade: v })}
                          >
                            <SelectTrigger className="h-8 w-[110px]"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>
                              {roster.scale.map((s) => <SelectItem key={s.letter} value={s.letter}>{s.letter}{s.gradePoint !== null ? ` (${s.gradePoint})` : ""}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          {e.publishedAt ? (
                            <Badge className="bg-emerald-600 text-white hover:bg-emerald-600"><CheckCircle2 className="mr-1 size-3" />Published</Badge>
                          ) : e.letterGrade ? (
                            <Badge variant="secondary"><Save className="mr-1 size-3" />Draft</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not entered</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish grades?</AlertDialogTitle>
            <AlertDialogDescription>
              This will finalize {draftCount} draft grade{draftCount === 1 ? "" : "s"} for this offering, make them visible to students, and recalculate their semester SGPAs. It cannot be casually undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={publishMut.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction disabled={publishMut.isPending} onClick={(e) => { e.preventDefault(); publishMut.mutate(); }}>
              Yes, publish
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
