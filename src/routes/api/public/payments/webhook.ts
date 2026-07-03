/**
 * POST /api/public/payments/webhook — SSLCommerz-style callback.
 *
 * Idempotency: transaction_ref is the key. We insert into
 * payment_webhook_events; a duplicate delivery hits the UNIQUE constraint
 * and short-circuits without double-crediting the payment.
 *
 * Signature verification is intentionally a stub — swap the check for the
 * real HMAC / IPN validation when the merchant account is provisioned.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";
import { z } from "zod";

const bodySchema = z.object({
  tran_id: z.string().min(1).max(100),
  val_id: z.string().max(100).optional(),
  amount: z.coerce.number().nonnegative(),
  status: z.enum(["VALID", "VALIDATED", "FAILED", "CANCELLED"]),
  student_user_id: z.string().uuid(),
  semester_id: z.string().uuid(),
});

function verify(rawBody: string, signature: string | null): boolean {
  const secret = process.env.SSLCZ_WEBHOOK_SECRET;
  if (!secret) return true; // dev mode — accept
  if (!signature) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(signature); const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        if (!verify(raw, request.headers.get("x-webhook-signature"))) {
          return new Response("Invalid signature", { status: 401 });
        }
        let json: unknown;
        try { json = JSON.parse(raw); } catch { return new Response("Bad JSON", { status: 400 }); }
        const parsed = bodySchema.safeParse(json);
        if (!parsed.success) return Response.json({ error: "Invalid body", issues: parsed.error.issues }, { status: 400 });
        const p = parsed.data;

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Idempotency gate — unique on transaction_ref.
        const { error: dupErr } = await supabaseAdmin
          .from("payment_webhook_events")
          .insert({ transaction_ref: p.tran_id, status: p.status, payload: p });
        if (dupErr) {
          // 23505 = unique_violation → treat as already processed (idempotent).
          if ((dupErr as { code?: string }).code === "23505") {
            return Response.json({ ok: true, replayed: true });
          }
          return Response.json({ error: dupErr.message }, { status: 500 });
        }

        if (p.status === "VALID" || p.status === "VALIDATED") {
          // Find matching payment row (unique on tran_id if set, else student+semester).
          const { data: existing } = await supabaseAdmin
            .from("payments")
            .select("id, amount_due, amount_paid")
            .eq("student_user_id", p.student_user_id)
            .eq("semester_id", p.semester_id)
            .maybeSingle();

          if (existing) {
            const newPaid = Number(existing.amount_paid ?? 0) + p.amount;
            const status = newPaid >= Number(existing.amount_due) ? "PAID" : "PARTIAL";
            await supabaseAdmin.from("payments").update({
              amount_paid: newPaid, status, transaction_ref: p.tran_id,
            }).eq("id", existing.id);
          } else {
            await supabaseAdmin.from("payments").insert({
              student_user_id: p.student_user_id, semester_id: p.semester_id,
              amount_due: p.amount, amount_paid: p.amount, status: "PAID",
              transaction_ref: p.tran_id, due_date: new Date().toISOString().slice(0, 10),
            });
          }
        }

        return Response.json({ ok: true });
      },
    },
  },
});
