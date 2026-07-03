/**
 * Client-side PDF receipt generator. Runs in the browser so we don't need
 * a server render pass. Called only for PAID/PARTIAL rows with a
 * transaction reference — see payments page.
 */
import { jsPDF } from "jspdf";

export type ReceiptInput = {
  studentName: string;
  studentId: string;
  departmentName: string | null;
  programName: string | null;
  semesterName: string;
  amountDue: number;
  amountPaid: number;
  paidOn: string;
  transactionRef: string;
  paymentId: string;
  institution: string;
};

export function downloadReceiptPdf(r: ReceiptInput) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const w = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(r.institution, w / 2, 60, { align: "center" });
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.text("Official Payment Receipt", w / 2, 80, { align: "center" });

  doc.setDrawColor(200);
  doc.line(48, 96, w - 48, 96);

  let y = 130;
  const line = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, 60, y);
    doc.setFont("helvetica", "normal");
    doc.text(value, 220, y);
    y += 22;
  };

  line("Receipt No.", r.paymentId.slice(0, 8).toUpperCase());
  line("Transaction Ref.", r.transactionRef);
  line("Paid on", new Date(r.paidOn).toLocaleString());
  y += 8;
  line("Student", r.studentName);
  line("Student ID", r.studentId);
  if (r.departmentName) line("Department", r.departmentName);
  if (r.programName) line("Program", r.programName);
  line("Semester", r.semesterName);
  y += 8;
  line("Amount due", `BDT ${r.amountDue.toFixed(2)}`);
  line("Amount paid", `BDT ${r.amountPaid.toFixed(2)}`);
  line(
    "Balance",
    `BDT ${Math.max(0, r.amountDue - r.amountPaid).toFixed(2)}`,
  );

  doc.setDrawColor(200);
  doc.line(48, y + 8, w - 48, y + 8);
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text(
    "This is a system-generated receipt and does not require a signature.",
    w / 2,
    y + 30,
    { align: "center" },
  );

  doc.save(`receipt-${r.paymentId.slice(0, 8)}.pdf`);
}
