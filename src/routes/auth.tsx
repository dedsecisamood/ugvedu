import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { signInWithPassword, requestPasswordReset } from "@/lib/auth.functions";
import { APP_NAME } from "@/lib/constants";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
  head: () => ({
    meta: [
      { title: `Sign in — ${APP_NAME}` },
      { name: "description", content: "Sign in to the UGV Barishal student portal." },
    ],
  }),
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-gold">
            University of Global Village
          </p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
            Student Portal
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Barishal</p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
          {mode === "signin" ? (
            <SignInForm onForgot={() => setMode("forgot")} />
          ) : (
            <ForgotForm onBack={() => setMode("signin")} />
          )}
        </div>
      </div>
    </div>
  );
}

function SignInForm({ onForgot }: { onForgot: () => void }) {
  const signIn = useServerFn(signInWithPassword);
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await signIn({ data: { email: email.trim(), password } });
      if (!res.ok) {
        setErr(res.error);
        return;
      }
      const { error } = await supabase.auth.setSession(res.session);
      if (error) {
        setErr("Could not establish session.");
        return;
      }
      navigate({ to: "/overview" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Sign in</h2>

      <label className="block">
        <span className="text-sm font-medium text-foreground">Student ID / Email</span>
        <input
          type="text"
          required
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="12521076 or name@ugv.edu.bd"
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-foreground">Password</span>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </label>

      {err && (
        <p role="alert" className="text-sm text-destructive">
          {err}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-navy px-4 py-2 text-sm font-medium text-navy-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>

      <div className="flex justify-between text-xs">
        <button type="button" onClick={onForgot} className="text-primary hover:underline">
          Forgot password?
        </button>
        <Link to="/" className="text-muted-foreground hover:underline">
          Back to home
        </Link>
      </div>
    </form>
  );
}

function ForgotForm({ onBack }: { onBack: () => void }) {
  const request = useServerFn(requestPasswordReset);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await request({ data: { email } });
      setSent(true);
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="space-y-4 text-sm">
        <h2 className="text-lg font-semibold text-foreground">Check your email</h2>
        <p className="text-muted-foreground">
          If an account exists for <span className="font-medium">{email}</span>, we've sent
          instructions to reset your password. The link expires in 30 minutes.
        </p>
        <button onClick={onBack} className="text-primary hover:underline">
          ← Back to sign in
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">Reset password</h2>
      <p className="text-sm text-muted-foreground">
        Enter your email and we'll send you a reset link.
      </p>
      <label className="block">
        <span className="text-sm font-medium text-foreground">Email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </label>
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-navy px-4 py-2 text-sm font-medium text-navy-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {busy ? "Sending…" : "Send reset link"}
      </button>
      <button type="button" onClick={onBack} className="text-xs text-primary hover:underline">
        ← Back to sign in
      </button>
    </form>
  );
}
// touch 1783077062
