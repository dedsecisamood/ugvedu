/**
 * Department head — resolve a blocked student's Incomplete.
 *
 * Shows the full semester grade history read-only; each Incomplete row
 * gets a "Resolve" action that opens an inline dropdown of live grade
 * letters and posts to resolve_incomplete_grade(). On success we
 * invalidate the query — if that was the last blocker the row is
 * regenerated and status becomes GENERATED on the student's Results page.
 *
 * A dept head from a different department cannot even open this URL: the
 * detail query 404s at RLS and the resolve RPC returns Forbidden inside SQL.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { useState } from "react";
import { toast } from "sonner";
import { AlertOctagon, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ErrorState } from "@/components/state/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { getBlockedStudentDetail, resolveIncomplete } from "@/lib/faculty.functions";
import { listGradeScale } from "@/lib/admin-config.functions";

const searchSchema = z.object({ semesterId: z.string().uuid() });

export const Route = createFileRoute("/_authenticated/faculty/blocked/$studentUserId")({
  validateSearch: searchSchema,
  component: BlockedDetailPage,
});

function BlockedDetailPage() {
  const { studentUserId } = Route.useParams();
  const { semesterId } = Route.useSearch();
  const qc = useQueryClient();
  const detailFn = useServerFn(getBlockedStudentDetail);
  const scaleFn = useServerFn(listGradeScale);
  const resolveFn = useServerFn(resolveIncomplete);

  const { data: detail, isLoading, error, refetch } = useQuery({
    queryKey: ["blocked-detail", studentUserId, semesterId],
    queryFn: () => detailFn({ data: { studentUserId, semesterId } }),
    retry: false,
  });
  const { data: scale } = useQuery({ queryKey: ["grade-scale"], queryFn: () => scaleFn() });

  const [choice, setChoice] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");

  const mut = useMutation({
    mutationFn: (v: { enrollmentId: string; newLetter: string }) => resolveFn({ data: { ...v, note: note || undefined } }),
    onSuccess: (res) => {
      toast.success(res.newStatus === "GENERATED" ? "Resolved — semester result is now GENERATED." : "Resolved — additional blockers remain.");
      qc.invalidateQueries({ queryKey: ["blocked-detail", studentUserId, semesterId] });
      qc.invalidateQueries({ queryKey: ["blocked-students"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to resolve"),
  });

  if (error) {
    return (
      <div className="mx-auto max-w-4xl">
        <PageHeader crumb="Faculty" title="Blocked student" />
        <ErrorState title="Cannot access this record" description="You may not be the department head for this student, or the record no longer exists." onRetry={() => refetch()} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader crumb="Faculty" title={detail ? detail.student.fullName : "Blocked student"} subtitle={detail ? `${detail.student.studentId} · ${detail.student.departmentCode ?? ""} · ${detail.semester.name}` : "Loading…"} />

      {isLoading || !detail ? (
        <Card><CardContent className="space-y-2 p-6"><Skeleton className="h-8" /><Skeleton className="h-8" /></CardContent></Card>
      ) : (
        <>
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex items-start gap-3 p-4">
              <AlertOctagon className="mt-0.5 size-5 shrink-0 text-destructive" />
              <div><p className="font-medium text-destructive">Result blocked</p><p className="text-sm text-muted-foreground">{detail.reason ?? "This semester's SGPA cannot be finalized until the blockers below are resolved."}</p></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle>Grade history — {detail.semester.name}</CardTitle>
              <Link to="/results" className="text-xs text-muted-foreground underline">View student's results page →</Link>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Course</TableHead><TableHead>Credits</TableHead><TableHead>Grade</TableHead><TableHead>Status</TableHead><TableHead>Resolve</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {detail.grades.map((g) => {
                      const passingOptions = (scale ?? []).filter((s) => !s.isFail && s.letter !== "I");
                      return (
                        <TableRow key={g.enrollmentId} className={g.isIncomplete || g.isFail ? "bg-destructive/5" : ""}>
                          <TableCell><div className="font-medium">{g.courseCode}</div><div className="text-xs text-muted-foreground">{g.courseTitle}</div></TableCell>
                          <TableCell>{g.credits}</TableCell>
                          <TableCell className="font-mono text-base font-bold">{g.letterGrade ?? "—"}</TableCell>
                          <TableCell>
                            {g.isIncomplete && <Badge variant="destructive">Incomplete</Badge>}
                            {g.isFail && !g.isIncomplete && <Badge variant="destructive">Fail</Badge>}
                            {!g.isIncomplete && !g.isFail && g.publishedAt && <Badge className="bg-emerald-600 text-white hover:bg-emerald-600"><CheckCircle2 className="mr-1 size-3" />OK</Badge>}
                            {!g.publishedAt && <span className="text-xs text-muted-foreground">Not published</span>}
                          </TableCell>
                          <TableCell>
                            {g.isIncomplete ? (
                              <div className="flex items-center gap-2">
                                <Select value={choice[g.enrollmentId] ?? ""} onValueChange={(v) => setChoice({ ...choice, [g.enrollmentId]: v })}>
                                  <SelectTrigger className="h-8 w-[110px]"><SelectValue placeholder="Letter" /></SelectTrigger>
                                  <SelectContent>{passingOptions.map((s) => <SelectItem key={s.letter} value={s.letter}>{s.letter}{s.gradePoint !== null ? ` (${s.gradePoint})` : ""}</SelectItem>)}</SelectContent>
                                </Select>
                                <Button size="sm" disabled={!choice[g.enrollmentId] || mut.isPending}
                                  onClick={() => mut.mutate({ enrollmentId: g.enrollmentId, newLetter: choice[g.enrollmentId] })}>
                                  Resolve
                                </Button>
                              </div>
                            ) : <span className="text-xs text-muted-foreground">—</span>}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              <div className="border-t p-3">
                <label className="text-xs font-medium text-muted-foreground" htmlFor="resolve-note">Optional note (attached to audit log)</label>
                <Input id="resolve-note" className="mt-1 max-w-lg" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Makeup exam completed 3 July." />
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
