/**
 * TOTP-based Two-Factor Authentication (scaffold).
 *
 * Flow:
 *  1. enrollTotp()          → creates a pending secret + returns otpauth URL + QR
 *  2. verifyTotpEnrollment()→ user confirms with a code, we flip enabled=true
 *                             and emit backup codes (returned once)
 *  3. verifyTotpChallenge() → used at login time (not yet wired into UI)
 *  4. disableTotp()         → user-initiated, requires a valid code
 *
 * The plaintext TOTP secret is only exposed to the enrolling user during step 1
 * (never returned again). RLS blocks other users from reading the row.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { randomBytes } from "crypto";
import { z } from "zod";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";

const ISSUER = "UGV Barishal";

function makeTotp(secret: string, label: string) {
  return new OTPAuth.TOTP({
    issuer: ISSUER,
    label,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(secret),
  });
}

function generateBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () =>
    randomBytes(5).toString("hex").toUpperCase().replace(/(.{5})/, "$1-").slice(0, 11),
  );
}

// -----------------------------------------------------------------------------
// enrollTotp
// -----------------------------------------------------------------------------
export const enrollTotp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;

    const { data: existing } = await supabaseAdmin
      .from("mfa_totp_secrets")
      .select("enabled")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing?.enabled) {
      return { ok: false as const, error: "TOTP is already enabled for this account." };
    }

    // Look up user email for the QR label.
    const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(userId);
    const label = userRes?.user?.email ?? userId;

    const secret = new OTPAuth.Secret({ size: 20 }).base32;
    const totp = makeTotp(secret, label);
    const otpauthUrl = totp.toString();
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { margin: 1, width: 240 });

    await supabaseAdmin.from("mfa_totp_secrets").upsert(
      {
        user_id: userId,
        secret,
        enabled: false,
        verified_at: null,
        backup_codes: [],
      },
      { onConflict: "user_id" },
    );

    return {
      ok: true as const,
      secret,           // shown once to the user for manual entry
      otpauthUrl,
      qrDataUrl,
    };
  });

// -----------------------------------------------------------------------------
// verifyTotpEnrollment
// -----------------------------------------------------------------------------
const codeSchema = z.object({ code: z.string().regex(/^\d{6}$/) });

export const verifyTotpEnrollment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => codeSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;

    const { data: row } = await supabaseAdmin
      .from("mfa_totp_secrets")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!row || row.enabled) {
      return { ok: false as const, error: "No pending TOTP enrollment." };
    }

    const totp = makeTotp(row.secret, userId);
    const delta = totp.validate({ token: data.code, window: 1 });
    if (delta === null) {
      return { ok: false as const, error: "Invalid code." };
    }

    const backupCodes = generateBackupCodes();
    await supabaseAdmin
      .from("mfa_totp_secrets")
      .update({
        enabled: true,
        verified_at: new Date().toISOString(),
        backup_codes: backupCodes,
      })
      .eq("user_id", userId);

    return { ok: true as const, backupCodes };
  });

// -----------------------------------------------------------------------------
// verifyTotpChallenge — used during login (once MFA is wired into UI)
// -----------------------------------------------------------------------------
const challengeSchema = z.object({
  userId: z.string().uuid(),
  code: z.string().min(6).max(11),
});

export const verifyTotpChallenge = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => challengeSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("mfa_totp_secrets")
      .select("*")
      .eq("user_id", data.userId)
      .maybeSingle();

    if (!row?.enabled) return { ok: false as const, error: "MFA not enabled." };

    // Backup code path
    if (/^[0-9A-F]{5}-[0-9A-F]{5}$/.test(data.code)) {
      if (!row.backup_codes.includes(data.code)) {
        return { ok: false as const, error: "Invalid backup code." };
      }
      const remaining = row.backup_codes.filter((c) => c !== data.code);
      await supabaseAdmin
        .from("mfa_totp_secrets")
        .update({ backup_codes: remaining })
        .eq("user_id", data.userId);
      return { ok: true as const };
    }

    const totp = makeTotp(row.secret, data.userId);
    const delta = totp.validate({ token: data.code, window: 1 });
    return delta === null
      ? { ok: false as const, error: "Invalid code." }
      : { ok: true as const };
  });

// -----------------------------------------------------------------------------
// disableTotp
// -----------------------------------------------------------------------------
export const disableTotp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => codeSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { userId } = context;

    const { data: row } = await supabaseAdmin
      .from("mfa_totp_secrets")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!row?.enabled) return { ok: false as const, error: "MFA is not enabled." };

    const totp = makeTotp(row.secret, userId);
    if (totp.validate({ token: data.code, window: 1 }) === null) {
      return { ok: false as const, error: "Invalid code." };
    }

    await supabaseAdmin.from("mfa_totp_secrets").delete().eq("user_id", userId);
    return { ok: true as const };
  });
