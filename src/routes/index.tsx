import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  ChevronDown,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  ShieldCheck,
  User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signInWithPassword } from "@/lib/auth.functions";
import { APP_NAME } from "@/lib/constants";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: `Student Sign In — ${APP_NAME}` },
      {
        name: "description",
        content:
          "Sign in to the University of Global Village, Barishal student portal. Courses, results, notices, payments and academic tools in one place.",
      },
      { property: "og:title", content: `Student Sign In — ${APP_NAME}` },
      {
        property: "og:description",
        content:
          "Everything you need for campus life, in one place. Sign in to your UGV student portal.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Landing() {
  return (
    <div className="min-h-screen bg-white text-slate-900">
      <UtilityBar />
      <PrimaryNav />
      <Hero />
      <SiteFooter />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Top utility bar with crest                                                 */
/* -------------------------------------------------------------------------- */

const UTIL_LEFT = ["Semester Plan", "Fees Structure", "Bulletin"];
const UTIL_RIGHT = ["Club", "Our Partners", "Job Corner", "Apply Abroad"];

function UtilityBar() {
  return (
    <div className="border-b border-slate-100 bg-white">
      <div className="mx-auto grid max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-6 px-4 py-4 md:py-5">
        <nav className="hidden items-center gap-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 lg:flex">
          {UTIL_LEFT.map((l) => (
            <a key={l} href="#" className="transition-colors hover:text-navy">
              {l}
            </a>
          ))}
        </nav>

        <a href="#" className="flex items-center gap-3 justify-self-center">
          <Crest />
          <div className="hidden sm:block">
            <div className="relative">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Govt. &amp; UGC Approved
              </span>
            </div>
            <div className="text-lg font-extrabold tracking-tight text-navy sm:text-xl">
              UNIVERSITY OF GLOBAL VILLAGE
            </div>
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500">
              The University of Hi-Tech and Excellence
            </div>
          </div>
        </a>

        <nav className="hidden items-center justify-end gap-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 lg:flex">
          {UTIL_RIGHT.map((l) => (
            <a key={l} href="#" className="transition-colors hover:text-navy">
              {l}
            </a>
          ))}
        </nav>
      </div>
    </div>
  );
}

function Crest() {
  return (
    <div className="relative grid h-14 w-14 shrink-0 place-items-center rounded-full bg-white ring-2 ring-navy/90 shadow-sm">
      <div className="absolute inset-1 rounded-full bg-gradient-to-br from-sky-400 via-blue-600 to-navy" />
      <GraduationCap
        className="relative h-6 w-6 text-white drop-shadow"
        strokeWidth={2.4}
      />
      <span className="absolute -bottom-1 rounded-sm bg-navy px-1 text-[8px] font-bold tracking-widest text-gold">
        UGV
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Primary navy nav                                                           */
/* -------------------------------------------------------------------------- */

const NAV_ITEMS: { label: string; hasMenu?: boolean }[] = [
  { label: "Home" },
  { label: "Academics", hasMenu: true },
  { label: "Faculty & Staff", hasMenu: true },
  { label: "Admissions" },
  { label: "Administration", hasMenu: true },
  { label: "Academic Resources", hasMenu: true },
  { label: "More", hasMenu: true },
];

function PrimaryNav() {
  return (
    <div className="bg-navy text-navy-foreground shadow-lg shadow-navy/20">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4">
        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item, i) => (
            <a
              key={item.label}
              href="#"
              className={`group flex items-center gap-1 px-4 py-4 text-sm font-semibold tracking-wide transition-colors hover:bg-white/5 ${
                i === 0 ? "text-white" : "text-white/85 hover:text-white"
              }`}
            >
              {item.label}
              {item.hasMenu && (
                <ChevronDown className="h-3.5 w-3.5 opacity-70 transition-transform group-hover:translate-y-0.5" />
              )}
            </a>
          ))}
        </nav>

        <div className="flex flex-1 items-center justify-end py-2 md:flex-none md:py-0">
          <a
            href="#signin"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-rose-500 to-rose-600 px-5 py-2.5 text-xs font-bold uppercase tracking-[0.14em] text-white shadow-md shadow-rose-600/30 ring-1 ring-white/10 transition-all hover:shadow-lg hover:shadow-rose-600/40 hover:brightness-110"
          >
            <GraduationCap className="h-4 w-4" strokeWidth={2.5} />
            Student Portal
          </a>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Hero + sign-in                                                             */
/* -------------------------------------------------------------------------- */

function Hero() {
  return (
    <section
      id="signin"
      className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-white to-rose-50/40 px-4 py-10 md:py-16"
    >
      {/* Ambient accents */}
      <div className="pointer-events-none absolute -left-40 top-10 h-96 w-96 rounded-full bg-blue-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-rose-200/40 blur-3xl" />

      <div className="relative mx-auto grid max-w-7xl items-stretch gap-6 lg:grid-cols-2">
        <HeroPanel />
        <SignInCard />
      </div>
    </section>
  );
}

function HeroPanel() {
  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy via-[#0f2a55] to-[#0a1a38] p-8 text-white shadow-xl md:p-12">
      {/* Decorative circles */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/5" />
      <div className="pointer-events-none absolute -left-24 bottom-10 h-72 w-72 rounded-full bg-white/[0.04]" />
      <div className="pointer-events-none absolute right-24 bottom-24 h-24 w-24 rounded-full bg-gold/20 blur-2xl" />

      <div className="relative">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/90 ring-1 ring-white/20 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-gold" />
          Student Portal · Barishal
        </span>

        <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
          Everything you need
          <br />
          for <span className="text-gold">campus life,</span>
          <br />
          in one place.
        </h1>

        <p className="mt-6 max-w-md text-base leading-relaxed text-white/75">
          Courses, results, notices, payments, and academic tools — available
          anytime from your personal dashboard.
        </p>

        <div className="mt-10 grid max-w-md grid-cols-2 gap-4">
          <StatChip label="Portal Access" value="24 / 7" />
          <StatChip label="Single Sign-In" value="1 ID" />
        </div>
      </div>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur">
      <div className="text-2xl font-extrabold tracking-tight text-white">
        {value}
      </div>
      <div className="mt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">
        {label}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Sign-in card                                                               */
/* -------------------------------------------------------------------------- */

function SignInCard() {
  const signIn = useServerFn(signInWithPassword);
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [captcha, setCaptcha] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const puzzle = useMemo(() => {
    const a = 3 + Math.floor(Math.random() * 8);
    const b = 2 + Math.floor(Math.random() * 8);
    return { a, b, answer: a + b };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (Number(captcha) !== puzzle.answer) {
      setErr("Security check failed. Please try the sum again.");
      return;
    }
    setBusy(true);
    try {
      const res = await signIn({ data: { email, password } });
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
    } catch {
      setErr("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative rounded-3xl bg-white p-8 shadow-xl ring-1 ring-slate-200/70 md:p-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-navy">
            Student Sign In
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Enter your credentials to access the portal.
          </p>
        </div>
        <div className="hidden h-11 w-11 place-items-center rounded-full bg-navy/5 text-navy sm:grid">
          <ShieldCheck className="h-5 w-5" />
        </div>
      </div>

      <form onSubmit={submit} className="space-y-5" noValidate>
        <Field
          label="Student ID / Username"
          icon={<User className="h-4 w-4" />}
        >
          <input
            type="text"
            required
            autoComplete="username"
            placeholder="e.g. 12221022"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
        </Field>

        <Field label="Password" icon={<Lock className="h-4 w-4" />}>
          <input
            type={showPw ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowPw((v) => !v)}
            aria-label={showPw ? "Hide password" : "Show password"}
            className="text-slate-400 hover:text-slate-700"
          >
            {showPw ? (
              <EyeOff className="h-4 w-4" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
          </button>
        </Field>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600">
            Security verification
          </label>
          <div className="grid grid-cols-[auto_1fr] items-stretch gap-3">
            <div className="grid min-w-[92px] place-items-center rounded-xl bg-navy px-4 text-base font-bold text-white shadow-inner">
              {puzzle.a} + {puzzle.b} = ?
            </div>
            <input
              type="text"
              inputMode="numeric"
              required
              placeholder="Your answer"
              value={captcha}
              onChange={(e) => setCaptcha(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-navy focus:outline-none focus:ring-2 focus:ring-navy/15"
            />
          </div>
        </div>

        {err && (
          <p
            role="alert"
            className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          >
            {err}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="group relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 px-5 py-3.5 text-sm font-bold uppercase tracking-[0.14em] text-white shadow-md shadow-rose-600/30 transition-all hover:shadow-lg hover:shadow-rose-600/40 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in to Portal"}
        </button>

        <div className="flex items-center justify-between pt-1 text-xs">
          <a href="/auth" className="font-semibold text-navy hover:underline">
            Forgot password?
          </a>
          <span className="text-slate-400">
            Trouble signing in? Contact IT Support
          </span>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-600">
        {label}
      </label>
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-colors focus-within:border-navy focus-within:ring-2 focus-within:ring-navy/15">
        <span className="text-slate-400">{icon}</span>
        {children}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Footer                                                                     */
/* -------------------------------------------------------------------------- */

function SiteFooter() {
  return (
    <footer className="border-t border-slate-100 bg-white">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-slate-500 sm:flex-row">
        <p>
          © {new Date().getFullYear()} University of Global Village, Barishal.
          All rights reserved.
        </p>
        <div className="flex items-center gap-5">
          <a href="#" className="hover:text-navy">
            Privacy
          </a>
          <a href="#" className="hover:text-navy">
            Terms
          </a>
          <a href="#" className="hover:text-navy">
            Support
          </a>
        </div>
      </div>
    </footer>
  );
}
