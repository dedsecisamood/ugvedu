/**
 * My Payments — student view.
 *
 * Pay flow (never marks paid client-side):
 *   1. Click Pay Now → `initiatePayment` returns a checkoutUrl + tranId.
 *   2. Redirect out to the sandbox gateway.
 *   3. Gateway posts the webhook and redirects back with ?tran_id=...
 *   4. Page polls `getMyPayments` every 2s until the row for that tran_id
 *      resolves to PAID/PARTIAL (or webhook records a failure). Status
 *      pill in the pending banner is driven by the server, not local hope.
 */
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Clock, Download, Loader2, Wallet } from "lucide-react";
import { APP_NAME } from "@/lib/constants";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/layout/stat-card";
import { EmptyState } from "@/components/state/empty-state";
import { ErrorState } from "@/components/state/error-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getMyPayments,
  initiatePayment,
  type PaymentRow,
} from "@/lib/payments.functions";
import { downloadReceiptPdf } from "@/lib/payment-receipt";

const searchSchema = z.object({
  tran_id: z.string().optional(),
  gateway_status: z.enum(["valid", "failed", "cancelled"]).optional(),
});

export const Route = createFileRoute("/_authenticated/payments")({
  validateSearch: searchSchema,
  component: PaymentsPage,
  head: () => ({ meta: [{ title: `My Payments — ${APP_NAME}` }] }),
});

function fmtBDT(n: number) {
  return `৳ ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function fmtDate(s: string | null) {
  return s ? new Date(s).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" }) : "—";
}

function StatusBadge({ status }: { status: PaymentRow["status"] }) {
  if (status === "PAID") return <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">Paid</Badge>;
  if (status === "PARTIAL") return <Badge className="bg-amber-500 text-white hover:bg-amber-500">Partial</Badge>;
  return <Badge variant="destructive">Overdue</Badge>;
}

function PaymentsPage() {
  const search = useSearch({ from: "/_authenticated/payments" });
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchPayments = useServerFn(getMyPayments);
  const initiate = useServerFn(initiatePayment);

  // Poll while a tran_id is being confirmed by the webhook.
  const pendingTranId = search.tran_id ?? null;
  const gatewayStatus = search.gateway_status ?? null;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["my-payments"],
    queryFn: () => fetchPayments(),
    refetchInterval: pendingTranId ? 2000 : false,
  });

  // Detect when the pending tran_id has been picked up by the webhook.
  const matchedRow = useMemo(
    () => (pendingTranId ? data?.payments.find((p) => p.transaction_ref === pendingTranId) ?? null : null),
    [pendingTranId, data],
  );

  useEffect(() => {
    if (!pendingTranId) return;
    if (gatewayStatus === "cancelled") {
      toast.info("Payment cancelled");
      navigate({ to: "/payments", search: {}, replace: true });
      return;
    }
    if (gatewayStatus === "failed") {
      // Give the webhook a beat, then bail.
      const t = setTimeout(() => {
        toast.error("Payment failed at the gateway");
        navigate({ to: "/payments", search: {}, replace: true });
      }, 2500);
      return () => clearTimeout(t);
    }
    if (matchedRow && (matchedRow.status === "PAID" || matchedRow.status === "PARTIAL")) {
      toast.success(matchedRow.status === "PAID" ? "Payment confirmed" : "Partial payment recorded");
      navigate({ to: "/payments", search: {}, replace: true });
    }
  }, [pendingTranId, gatewayStatus, matchedRow, navigate]);

  const payMutation = useMutation({
    mutationFn: (paymentId: string) => initiate({ data: { paymentId } }),
    onSuccess: (res) => {
      // Redirect out to the (sandbox) gateway. Same-origin here, but the
      // flow mirrors a real redirect-out.
      window.location.href = res.checkoutUrl;
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not start payment"),
  });

  const [downloading, setDownloading] = useState<string | null>(null);
  function handleDownload(row: PaymentRow) {
    if (!data?.student || !row.semester || !row.transaction_ref) return;
    setDownloading(row.id);
    try {
      downloadReceiptPdf({
        studentName: data.student.fullName,
        studentId: data.student.studentId,
        departmentName: data.student.departmentName,
        programName: data.student.programName,
        semesterName: row.semester.name,
        amountDue: row.amount_due,
        amountPaid: row.amount_paid,
        paidOn: row.updated_at,
        transactionRef: row.transaction_ref,
        paymentId: row.id,
        institution: APP_NAME,
      });
    } finally {
      setDownloading(null);
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl">
        <PageHeader crumb="My Payments" title="My Payments" subtitle="Fees and payment history." />
        <ErrorState onRetry={() => refetch()} />
      </div>
    );
  }

  const outstanding = data?.outstanding ?? 0;
  const nextDue = data?.nextDueDate ?? null;
  const overdue = data?.hasOverdue ?? false;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <PageHeader crumb="Finance" title="My Payments" subtitle="Fees, dues, and payment history." />

      {pendingTranId && !matchedRow && gatewayStatus !== "cancelled" && (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardContent className="flex items-center gap-3 p-4">
            <Loader2 className="size-5 animate-spin text-amber-600" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Waiting for the gateway to confirm your payment…</p>
              <p className="text-xs text-muted-foreground">Reference: <span className="font-mono">{pendingTranId}</span></p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["my-payments"] })}>
              Refresh
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Outstanding balance"
          value={isLoading ? "—" : fmtBDT(outstanding)}
          hint={outstanding > 0 ? "Total across all unpaid bills" : "You're all caught up"}
          icon={<Wallet className="size-5" />}
          accent={overdue ? "gold" : "navy"}
          loading={isLoading}
        />
        <StatCard
          label="Next due date"
          value={isLoading ? "—" : fmtDate(nextDue)}
          hint={overdue ? "One or more bills are overdue" : "Upcoming bill"}
          icon={<Clock className="size-5" />}
          loading={isLoading}
        />
        <StatCard
          label="Status"
          value={isLoading ? "—" : overdue ? "Overdue" : outstanding > 0 ? "Due" : "Clear"}
          hint={overdue ? "Please clear overdue dues" : "No action required"}
          icon={overdue ? <AlertTriangle className="size-5 text-destructive" /> : <CheckCircle2 className="size-5 text-emerald-600" />}
          loading={isLoading}
        />
      </div>

      {overdue && (
        <div role="alert" className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" />
          <div>
            <p className="font-medium text-destructive">You have overdue payments</p>
            <p className="text-muted-foreground">Clear your dues to avoid holds on registration, results, and certificate services.</p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Payment history</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-6">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !data?.payments.length ? (
            <div className="p-6">
              <EmptyState title="No payments yet" description="Fee entries for your semesters will appear here." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Due date</TableHead>
                    <TableHead>Semester</TableHead>
                    <TableHead className="text-right">Amount due</TableHead>
                    <TableHead className="text-right">Amount paid</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.payments.map((row) => {
                    const remaining = Math.max(0, row.amount_due - row.amount_paid);
                    const isPaying = payMutation.isPending && payMutation.variables === row.id;
                    return (
                      <TableRow key={row.id}>
                        <TableCell className="whitespace-nowrap">{fmtDate(row.due_date)}</TableCell>
                        <TableCell className="whitespace-nowrap">{row.semester?.name ?? "—"}</TableCell>
                        <TableCell className="whitespace-nowrap text-right tabular-nums">{fmtBDT(row.amount_due)}</TableCell>
                        <TableCell className="whitespace-nowrap text-right tabular-nums">{fmtBDT(row.amount_paid)}</TableCell>
                        <TableCell><StatusBadge status={row.status} /></TableCell>
                        <TableCell className="max-w-[160px] truncate font-mono text-xs text-muted-foreground">
                          {row.transaction_ref ?? "—"}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-right">
                          {row.status === "PAID" ? (
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={!row.transaction_ref || downloading === row.id}
                              onClick={() => handleDownload(row)}
                            >
                              <Download className="size-4" /> Receipt
                            </Button>
                          ) : (
                            <div className="flex items-center justify-end gap-2">
                              {row.status === "PARTIAL" && (
                                <span className="text-xs text-muted-foreground">Balance {fmtBDT(remaining)}</span>
                              )}
                              <Button
                                size="sm"
                                disabled={isPaying}
                                onClick={() => payMutation.mutate(row.id)}
                              >
                                {isPaying && <Loader2 className="size-4 animate-spin" />}
                                Pay now
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
