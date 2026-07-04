import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  ChevronDown,
  Clock3,
  Eye,
  EyeOff,
  GraduationCap,
  Lock,
  Menu,
  ShieldCheck,
  User,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { signInWithPassword } from "@/lib/auth.functions";
import { APP_NAME } from "@/lib/constants";
import ugvLogo from "@/assets/ugv-logo.png.asset.json";

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
      <div className="mx-auto grid max-w-7xl grid-cols-[auto_1fr_auto] items-center gap-4 px-4 py-3 md:grid-cols-[1fr_auto_1fr] md:py-5">
        <nav className="hidden items-center gap-6 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500 lg:flex">
          {UTIL_LEFT.map((l) => (
            <a key={l} href="#" className="transition-colors hover:text-navy">
              {l}
            </a>
          ))}
        </nav>

        <a
          href="/"
          className="flex items-center gap-3 md:justify-self-center"
          aria-label="University of Global Village"
        >
          <img
            src={ugvLogo.url}
            alt="University of Global Village crest"
            className="h-12 w-auto shrink-0 md:h-16"
            width={64}
            height={82}
          />
          <div className="min-w-0">
            <div className="hidden sm:block">
              <span className="rounded-sm bg-navy px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-white">
                Govt. &amp; UGC Approved
              </span>
            </div>
            <div className="mt-1 truncate text-sm font-extrabold tracking-tight text-navy sm:text-lg md:text-xl">
              UNIVERSITY OF GLOBAL VILLAGE
            </div>
            <div className="hidden text-[10px] font-medium uppercase tracking-[0.18em] text-slate-500 sm:block">
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
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-navy text-navy-foreground shadow-lg shadow-navy/20">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle menu"
          className="grid h-10 w-10 place-items-center rounded-md text-white/90 hover:bg-white/10 md:hidden"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV_ITEMS.map((item, i) => (
            <a
              key={item.label}
              href="#"
              className={`group flex items-center gap-1 px-3 py-4 text-sm font-semibold tracking-wide transition-colors hover:bg-white/5 lg:px-4 ${
                i === 0 ? "text-white" : "text-white/85 hover:text-white"
              }`}
            >
              {item.label}
              {item.hasMenu && (
                <ChevronDown className="h-3.5 w-3.5 opacity-70" />
              )}
            </a>
          ))}
        </nav>

        <a
          href="#signin"
          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-rose-500 to-rose-600 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-white shadow-md shadow-rose-600/30 ring-1 ring-white/10 transition-all hover:brightness-110 sm:px-5 sm:py-2.5 sm:text-xs"
        >
          <GraduationCap className="h-4 w-4" strokeWidth={2.5} />
          Student Portal
        </a>
      </div>

      {open && (
        <nav className="border-t border-white/10 bg-navy px-2 pb-3 md:hidden">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.label}
              href="#"
              className="block rounded-md px-3 py-2.5 text-sm font-semibold text-white/90 hover:bg-white/10"
            >
              {item.label}
            </a>
          ))}
        </nav>
      )}
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
      className="relative overflow-hidden bg-gradient-to-br from-slate-50 via-white to-rose-50/40 px-4 py-8 md:py-14"
    >
      <div className="pointer-events-none absolute -left-40 top-10 h-96 w-96 rounded-full bg-blue-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-rose-200/40 blur-3xl" />

      {/* Sign-in first on mobile so the form is visible immediately */}
      <div className="relative mx-auto grid max-w-7xl items-stretch gap-6 lg:grid-cols-[1.05fr_1fr]">
        <div className="order-2 lg:order-1">
          <HeroPanel />
        </div>
        <div className="order-1 lg:order-2">
          <SignInCard />
        </div>
      </div>
    </section>
  );
}

function HeroPanel() {
  return (
    <div className="relative h-full overflow-hidden rounded-3xl bg-gradient-to-br from-navy via-[#0f2a55] to-[#0a1a38] p-6 text-white shadow-xl sm:p-10 md:p-12">
      <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/5" />
      <div className="pointer-events-none absolute -left-24 bottom-10 h-72 w-72 rounded-full bg-white/[0.04]" />
      <div className="pointer-events-none absolute right-24 bottom-24 h-24 w-24 rounded-full bg-gold/20 blur-2xl" />

      <div className="relative">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/90 ring-1 ring-white/20 backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-gold" />
          Student Portal · Barishal
        </span>

        <h1 className="mt-5 text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl">
          Everything you need
          <br />
          for <span className="text-gold">campus life,</span>
          <br />
          in one place.
        </h1>

        <p className="mt-5 max-w-md text-sm leading-relaxed text-white/75 sm:text-base">
          Courses, results, notices, payments, and academic tools — available
          anytime from your personal dashboard.
        </p>

        <div className="mt-8 inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gold/20 text-gold">
            <Clock3 className="h-4 w-4" />
          </div>
          <div>
            <div className="text-lg font-extrabold tracking-tight text-white">
              24 / 7 Portal Access
            </div>
            <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/70">
              Sign in anytime from any device
            </div>
          </div>
        </div>
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
      // Accept either a full email OR a numeric student ID.
      // Bare student IDs (e.g. 12521076) are mapped to their institutional email.
      const raw = email.trim();
      const loginEmail = raw.includes("@")
        ? raw
        : `${raw}@student.ugv.edu.bd`;
      const res = await signIn({ data: { email: loginEmail, password } });
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
    <div className="relative rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200/70 sm:p-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight text-navy sm:text-2xl">
            Student Sign In
          </h2>
          <p className="mt-1 text-xs text-slate-500 sm:text-sm">
            Enter your credentials to access the portal.
          </p>
        </div>
        <div className="hidden h-11 w-11 shrink-0 place-items-center rounded-full bg-navy/5 text-navy sm:grid">
          <ShieldCheck className="h-5 w-5" />
        </div>
      </div>

      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field
          label="Student ID / Username"
          icon={<User className="h-4 w-4" />}
          htmlFor="student-id"
        >
          <input
            id="student-id"
            type="text"
            required
            autoComplete="username"
            placeholder="e.g. 12221022"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
        </Field>

        <Field
          label="Password"
          icon={<Lock className="h-4 w-4" />}
          htmlFor="student-password"
          suffix={
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
          }
        >
          <input
            id="student-password"
            type={showPw ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-transparent text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
          />
        </Field>

        <div>
          <label
            htmlFor="captcha"
            className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-600"
          >
            Security verification
          </label>
          <div className="grid grid-cols-[auto_1fr] items-stretch gap-3">
            <div
              aria-hidden="true"
              className="grid min-w-[92px] place-items-center rounded-xl bg-navy px-4 text-base font-bold text-white shadow-inner"
            >
              {puzzle.a} + {puzzle.b} = ?
            </div>
            <input
              id="captcha"
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
          className="w-full rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 px-5 py-3 text-sm font-bold uppercase tracking-[0.14em] text-white shadow-md shadow-rose-600/30 transition-all hover:shadow-lg hover:shadow-rose-600/40 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {busy ? "Signing in…" : "Sign in to Portal"}
        </button>

        <details className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs text-slate-600">
          <summary className="cursor-pointer font-semibold text-navy">
            Demo credentials
          </summary>
          <div className="mt-2 space-y-1">
            <div>
              <span className="font-medium">Student ID:</span> 12521076
            </div>
            <div>
              <span className="font-medium">Password:</span> DemoPass123!
            </div>
            <p className="pt-1 text-[11px] text-slate-500">
              You can also sign in with a full email such as
              head.cse@ugv.edu.bd or admin@ugv.edu.bd.
            </p>
          </div>
        </details>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
          <a href="/auth" className="font-semibold text-navy hover:underline">
            Forgot password?
          </a>
          <span className="text-slate-400">Trouble? Contact IT Support</span>
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  icon,
  htmlFor,
  suffix,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  htmlFor: string;
  suffix?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-slate-600"
      >
        {label}
      </label>
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-colors focus-within:border-navy focus-within:ring-2 focus-within:ring-navy/15">
        <span className="text-slate-400">{icon}</span>
        {children}
        {suffix}
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
