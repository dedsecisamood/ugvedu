/**
 * Payments — page-facing server fns.
 *
 * Payment lifecycle is webhook-authoritative:
 *   1. UI calls `initiatePayment` → server mints a tran_id and returns a
 *      checkout URL. **No DB write happens here.** The payment row's status
 *      only changes once /api/public/payments/webhook confirms the gateway
 *      response. The UI polls until that lands.
 *   2. UI navigates to the sandbox gateway (`/pay/checkout`) which redirects
 *      back to /payments?tran_id=… after the (simulated) capture.
 *   3. Only when getMyPayments reports the row as PAID/PARTIAL does the UI
 *      leave the pending state. Never mark paid client-side.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PaymentRow = {
  id: string;
  amount_due: number;
  amount_paid: number;
  due_date: string;
  status: "PAID" | "PARTIAL" | "OVERDUE";
  transaction_ref: string | null;
  updated_at: string;
  semester: { id: string; name: string; term: string; year: number } | null;
};

export type MyPaymentsData = {
  student: {
    userId: string;
    fullName: string;
    studentId: string;
    departmentName: string | null;
    programName: string | null;
  } | null;
  payments: PaymentRow[];
  outstanding: number;
  nextDueDate: string | null;
  hasOverdue: boolean;
};

export const getMyPayments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyPaymentsData> => {
    const { supabase, userId } = context;

    const { data: student } = await supabase
      .from("students")
      .select(
        "user_id, student_id, full_name, departments(name), programs(name)",
      )
      .eq("user_id", userId)
      .maybeSingle();

    const { data: rows, error } = await supabase
      .from("payments")
      .select(
        "id, amount_due, amount_paid, due_date, status, transaction_ref, updated_at, semesters(id, name, term, year)",
      )
      .eq("student_user_id", userId)
      .order("due_date", { ascending: false });
    if (error) throw new Error(error.message);

    const today = new Date().toISOString().slice(0, 10);
    let outstanding = 0;
    let nextDueDate: string | null = null;
    let hasOverdue = false;

    const payments: PaymentRow[] = (rows ?? []).map((r) => {
      const due = Number(r.amount_due);
      const paid = Number(r.amount_paid ?? 0);
      const remaining = Math.max(0, due - paid);
      if (r.status !== "PAID") {
        outstanding += remaining;
        if (r.due_date < today) hasOverdue = true;
        if (!nextDueDate || r.due_date < nextDueDate) nextDueDate = r.due_date;
      }
      const sem = r.semesters as { id: string; name: string; term: string; year: number } | null;
      return {
        id: r.id,
        amount_due: due,
        amount_paid: paid,
        due_date: r.due_date,
        status: r.status as PaymentRow["status"],
        transaction_ref: r.transaction_ref ?? null,
        updated_at: r.updated_at,
        semester: sem ? { id: sem.id, name: sem.name, term: sem.term, year: sem.year } : null,
      };
    });

    const studentOut = student
      ? {
          userId: student.user_id,
          fullName: student.full_name,
          studentId: student.student_id,
          departmentName: (student.departments as { name: string } | null)?.name ?? null,
          programName: (student.programs as { name: string } | null)?.name ?? null,
        }
      : null;

    return { student: studentOut, payments, outstanding, nextDueDate, hasOverdue };
  });

/** Mint a sandbox transaction reference and return the hosted-checkout URL.
 *  Does NOT write to `payments` — only the webhook confirms capture. */
export const initiatePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { paymentId: string }) =>
    z.object({ paymentId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("payments")
      .select("id, student_user_id, semester_id, amount_due, amount_paid, status")
      .eq("id", data.paymentId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Payment not found");
    if (row.student_user_id !== userId) throw new Error("Forbidden");
    if (row.status === "PAID") throw new Error("This bill is already fully paid.");

    const remaining = Math.max(0, Number(row.amount_due) - Number(row.amount_paid ?? 0));
    if (remaining <= 0) throw new Error("Nothing due on this bill.");

    // Sandbox tran_id — unique per attempt so retries don't collide with prior events.
    const tranId = `SBX-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`.toUpperCase();

    const params = new URLSearchParams({
      paymentId: row.id,
      tranId,
      amount: remaining.toFixed(2),
      studentUserId: row.student_user_id,
      semesterId: row.semester_id,
    });

    return {
      tranId,
      amount: remaining,
      checkoutUrl: `/pay/checkout?${params.toString()}`,
    };
  });
