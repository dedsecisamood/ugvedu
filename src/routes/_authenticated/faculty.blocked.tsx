/**
 * Department head — list of blocked students (RLS-scoped to their dept;
 * admin sees everyone). Sorted by most-recent calculation.
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertOctagon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/state/empty-state";
import { Badge } from "@/components/ui/badge";
import { listBlockedStudents } from "@/lib/faculty.functions";

export const Route = createFileRoute("/_authenticated/faculty/blocked")({ component: BlockedListPage });

function BlockedListPage() {
  const fn = useServerFn(listBlockedStudents);
  const { data, isLoading } = useQuery({ queryKey: ["blocked-students"], queryFn: () => fn() });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader crumb="Faculty" title="Blocked results" subtitle="Students in your department whose semester result is blocked by an F or Incomplete." />
      <Card>
        <CardContent className="p-0">
          {isLoading && <div className="space-y-2 p-6"><Skeleton className="h-8" /><Skeleton className="h-8" /></div>}
          {data && data.length === 0 && <div className="p-6"><EmptyState title="No blocked students" description="Everyone's results are clean." /></div>}
          {data && data.length > 0 && (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Student ID</TableHead><TableHead>Name</TableHead><TableHead>Semester</TableHead><TableHead>Reason</TableHead><TableHead>Calculated</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {data.map((r) => (
                    <TableRow key={`${r.studentUserId}:${r.semesterId}`}>
                      <TableCell className="font-mono text-sm">{r.studentId}</TableCell>
                      <TableCell>{r.fullName}</TableCell>
                      <TableCell>{r.semesterName}</TableCell>
                      <TableCell><div className="flex items-start gap-2"><AlertOctagon className="mt-0.5 size-4 shrink-0 text-destructive" /><span className="text-sm">{r.blockedReason ?? "Blocked"}</span></div></TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{new Date(r.calculatedAt).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        <Link to="/faculty/blocked/$studentUserId" params={{ studentUserId: r.studentUserId }} search={{ semesterId: r.semesterId }} className="text-sm text-primary underline underline-offset-2">Open</Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="border-t p-3"><Badge variant="secondary">{data.length} case{data.length === 1 ? "" : "s"}</Badge></div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
