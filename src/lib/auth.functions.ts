/**
 * Authentication server functions.
 *
 * All logic that must NOT be tampered with by the client lives here:
 *  - Rate-limited sign-in (5 failed attempts / 15 min → lockout)
 *  - Password reset request (single-use hashed token, 30 min expiry)
 *  - Password reset completion
 *
 * Passwords are never handled by our code in plaintext beyond forwarding them
 * to Supabase Auth (GoTrue), which stores bcrypt hashes. We never log passwords.
 */
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "crypto";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;
const LOCKOUT_MINUTES = 15;
const RESET_TOKEN_TTL_MINUTES = 30;

// Generic error surfaced to the client — never reveal whether the email exists.
const INVALID_CREDENTIALS = "Invalid email or password.";
const LOCKED_OUT = `Too many failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.`;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

// -----------------------------------------------------------------------------
// signInWithPassword — rate-limited
// -----------------------------------------------------------------------------
const STUDENT_EMAIL_DOMAIN = "student.ugv.edu.bd";

function normalizePortalIdentifier(value: string): string {
  const raw = value.trim().toLowerCase();
  if (raw.includes("@")) return raw;
  return `${raw}@${STUDENT_EMAIL_DOMAIN}`;
}

const signInSchema = z.object({
  email: z
    .string()
    .trim()
    .min(3)
    .max(255)
    .refine(
      (v) =>
        v.includes("@")
          ? z.string().email().safeParse(v).success
          : /^[0-9A-Za-z._-]{3,30}$/.test(v),
      "Enter a valid student ID or email address.",
    )
    .transform(normalizePortalIdentifier),
  password: z.string().min(1).max(200),
});

export const signInWithPassword = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => signInSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = new Date();

    // 1. Check lockout / attempt window.
    const { data: rl } = await supabaseAdmin
      .from("auth_rate_limits")
      .select("*")
      .eq("email", data.email)
      .maybeSingle();

    if (rl?.locked_until && new Date(rl.locked_until) > now) {
      return { ok: false as const, error: LOCKED_OUT };
    }

    // 2. Attempt sign-in via an anon-key client (no session persistence).
    const anon = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );

    const { data: result, error } = await anon.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });

    if (error || !result.session) {
      await recordFailedAttempt(supabaseAdmin, data.email, rl, now);
      return { ok: false as const, error: INVALID_CREDENTIALS };
    }

    // 3. Success — clear rate-limit record.
    if (rl) {
      await supabaseAdmin.from("auth_rate_limits").delete().eq("email", data.email);
    }

    return {
      ok: true as const,
      session: {
        access_token: result.session.access_token,
        refresh_token: result.session.refresh_token,
      },
    };
  });

type AdminClient = Awaited<typeof import("@/integrations/supabase/client.server")>["supabaseAdmin"];

async function recordFailedAttempt(
  admin: AdminClient,
  email: string,
  rl: { attempt_count: number; first_attempt_at: string } | null,
  now: Date,
) {
  const windowStart = new Date(now.getTime() - WINDOW_MINUTES * 60_000);
  let attemptCount = 1;
  let firstAttemptAt = now.toISOString();

  if (rl && new Date(rl.first_attempt_at) > windowStart) {
    attemptCount = rl.attempt_count + 1;
    firstAttemptAt = rl.first_attempt_at;
  }

  const lockedUntil =
    attemptCount >= MAX_ATTEMPTS ? new Date(now.getTime() + LOCKOUT_MINUTES * 60_000).toISOString() : null;

  await admin
    .from("auth_rate_limits")
    .upsert(
      {
        email,
        attempt_count: attemptCount,
        first_attempt_at: firstAttemptAt,
        locked_until: lockedUntil,
      },
      { onConflict: "email" },
    );
}

// -----------------------------------------------------------------------------
// requestPasswordReset — always returns success (no email enumeration)
// -----------------------------------------------------------------------------
const resetRequestSchema = z.object({
  email: z.string().email().max(255).transform((v) => v.trim().toLowerCase()),
});

export const requestPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => resetRequestSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Look up user by email via Auth Admin API. Do NOT reveal existence to caller.
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const user = list?.users.find((u) => u.email?.toLowerCase() === data.email);

    if (user) {
      const rawToken = randomBytes(32).toString("base64url");
      const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MINUTES * 60_000).toISOString();
      await supabaseAdmin.from("password_reset_tokens").insert({
        user_id: user.id,
        token_hash: sha256(rawToken),
        expires_at: expiresAt,
      });

      // TODO: send email via edge function / provider.
      // For now we log the reset link server-side so QA can grab it.
      console.info(
        `[password-reset] link for ${data.email}: /reset-password?token=${rawToken}`,
      );
    }

    return { ok: true as const };
  });

// -----------------------------------------------------------------------------
// resetPassword — consume a single-use token
// -----------------------------------------------------------------------------
const resetCompleteSchema = z.object({
  token: z.string().min(20).max(200),
  newPassword: z.string().min(8).max(200),
});

export const resetPassword = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => resetCompleteSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const tokenHash = sha256(data.token);
    const now = new Date().toISOString();

    const { data: row } = await supabaseAdmin
      .from("password_reset_tokens")
      .select("*")
      .eq("token_hash", tokenHash)
      .maybeSingle();

    if (!row || row.used_at || new Date(row.expires_at) < new Date()) {
      return { ok: false as const, error: "This reset link is invalid or has expired." };
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(row.user_id, {
      password: data.newPassword,
    });
    if (error) {
      return { ok: false as const, error: "Could not update password. Please try again." };
    }

    await supabaseAdmin.from("password_reset_tokens").update({ used_at: now }).eq("id", row.id);
    // Clear any lockout for this account.
    const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
    if (userRes?.user?.email) {
      await supabaseAdmin
        .from("auth_rate_limits")
        .delete()
        .eq("email", userRes.user.email.toLowerCase());
    }

    return { ok: true as const };
  });
