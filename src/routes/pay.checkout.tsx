/**
 * Sandbox hosted-checkout page.
 *
 * A real gateway (SSLCommerz, Stripe, etc.) would host this outside our
 * origin, capture the card, then POST an IPN to /api/public/payments/webhook
 * and redirect the user back with `?tran_id=…`. We simulate all three steps
 * so the redirect-out / webhook / redirect-back flow can be exercised
 * end-to-end without a merchant account.
 *
 * Crucially, this page does NOT flip the payment status itself. It only
 * posts to the webhook (server) — the payments page then polls until the
 * server reflects PAID/PARTIAL. See src/lib/payments.functions.ts.
 */
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { APP_NAME } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldCheck } from "lucide-react";

const searchSchema = z.object({
  paymentId: z.string().uuid(),
  tranId: z.string().min(1),
  amount: z.coerce.number().positive(),
  studentUserId: z.string().uuid(),
  semesterId: z.string().uuid(),
});

export const Route = createFileRoute("/pay/checkout")({
  validateSearch: searchSchema,
  component: SandboxCheckout,
  head: () => ({ meta: [{ title: `Sandbox Checkout — ${APP_NAME}` }] }),
});

function SandboxCheckout() {
  const search = useSearch({ from: "/pay/checkout" });
  const navigate = useNavigate();
  const [busy, setBusy] = useState<"none" | "pay" | "cancel">("none");
  const [err, setErr] = useState<string | null>(null);

  async function submit(outcome: "VALID" | "FAILED" | "CANCELLED") {
    setBusy(outcome === "VALID" ? "pay" : "cancel");
    setErr(null);
    try {
      // Simulate the gateway's server-to-server webhook (IPN).
      const res = await fetch("/api/public/payments/webhook", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          tran_id: search.tranId,
          amount: search.amount,
          status: outcome,
          student_user_id: search.studentUserId,
          semester_id: search.semesterId,
        }),
      });
      if (!res.ok) throw new Error(`Gateway responded ${res.status}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Gateway simulation failed");
      setBusy("none");
      return;
    }
    // Redirect-back with the tran_id — the payments page then polls until
    // the webhook-recorded status becomes visible to RLS.
    navigate({
      to: "/payments",
      search: { tran_id: search.tranId, gateway_status: outcome.toLowerCase() },
    });
  }

  return (
    <div className="min-h-dvh bg-muted/30 py-12">
      <div className="mx-auto max-w-md px-4">
        <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="size-4" />
          <span>Sandbox Payment Gateway · Test mode</span>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Confirm payment</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <dt className="text-muted-foreground">Amount</dt>
              <dd className="text-right font-semibold">৳ {search.amount.toFixed(2)}</dd>
              <dt className="text-muted-foreground">Reference</dt>
              <dd className="text-right font-mono text-xs">{search.tranId}</dd>
            </dl>
            {err && <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{err}</div>}
            <div className="space-y-2">
              <Button
                className="w-full"
                onClick={() => submit("VALID")}
                disabled={busy !== "none"}
              >
                {busy === "pay" && <Loader2 className="size-4 animate-spin" />}
                Pay ৳ {search.amount.toFixed(2)}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => submit("FAILED")}
                disabled={busy !== "none"}
              >
                Simulate failure
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                onClick={() => submit("CANCELLED")}
                disabled={busy !== "none"}
              >
                Cancel
              </Button>
            </div>
            <p className="text-center text-xs text-muted-foreground">
              This is a simulated gateway. No real card is charged.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
