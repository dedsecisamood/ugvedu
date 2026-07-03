/**
 * Admin — audit log viewer. Filters by action prefix, entity type, actor
 * user, and date range. Newest first, capped at 200 rows per fetch.
 */
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { listAuditLog } from "@/lib/admin-config.functions";

export const Route = createFileRoute("/_authenticated/admin/audit")({ component: AuditPage });

function AuditPage() {
  const fn = useServerFn(listAuditLog);
  const [filters, setFilters] = useState({ action: "", entityType: "", userId: "", from: "", to: "" });
  const [applied, setApplied] = useState(filters);
  const { data, isLoading } = useQuery({
    queryKey: ["audit-log", applied],
    queryFn: () => fn({ data: {
      action: applied.action || undefined,
      entityType: applied.entityType || undefined,
      userId: applied.userId || undefined,
      from: applied.from ? new Date(applied.from).toISOString() : undefined,
      to: applied.to ? new Date(applied.to).toISOString() : undefined,
      limit: 200,
    } }),
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader crumb="Administration" title="Audit log" subtitle="Every state-changing action, newest first." />
      <Card>
        <CardContent className="pt-6">
          <div className="grid gap-3 sm:grid-cols-5">
            <div><Label>Action</Label><Input value={filters.action} onChange={(e) => setFilters({ ...filters, action: e.target.value })} placeholder="e.g. grades.publish" /></div>
            <div><Label>Entity type</Label><Input value={filters.entityType} onChange={(e) => setFilters({ ...filters, entityType: e.target.value })} placeholder="user, student, …" /></div>
            <div><Label>Actor user ID</Label><Input value={filters.userId} onChange={(e) => setFilters({ ...filters, userId: e.target.value })} /></div>
            <div><Label>From</Label><Input type="datetime-local" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} /></div>
            <div><Label>To</Label><Input type="datetime-local" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} /></div>
            <div className="sm:col-span-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setFilters({ action: "", entityType: "", userId: "", from: "", to: "" }); setApplied({ action: "", entityType: "", userId: "", from: "", to: "" }); }}>Clear</Button>
              <Button onClick={() => setApplied(filters)}>Apply</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-6"><Skeleton className="h-8" /><Skeleton className="h-8" /><Skeleton className="h-8" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Actor</TableHead><TableHead>Action</TableHead><TableHead>Entity</TableHead><TableHead>Details</TableHead></TableRow></TableHeader>
                <TableBody>
                  {(data ?? []).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="whitespace-nowrap text-xs">{new Date(r.createdAt).toLocaleString()}</TableCell>
                      <TableCell><div className="text-sm">{r.actor?.fullName ?? "—"}</div><div className="text-xs text-muted-foreground">{r.actor?.email ?? r.userId ?? "system"}</div></TableCell>
                      <TableCell><Badge variant="secondary" className="font-mono">{r.action}</Badge></TableCell>
                      <TableCell className="whitespace-nowrap text-xs"><div>{r.entityType}</div><div className="font-mono text-muted-foreground">{r.entityId.slice(0, 8)}</div></TableCell>
                      <TableCell><pre className="max-w-md overflow-x-auto whitespace-pre-wrap break-words text-xs text-muted-foreground">{JSON.stringify(r.changes, null, 0)}</pre></TableCell>
                    </TableRow>
                  ))}
                  {data?.length === 0 && <TableRow><TableCell colSpan={5} className="p-6 text-center text-sm text-muted-foreground">No log entries match.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
