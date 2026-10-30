import Link from "next/link";
import {
  ArrowRight,
  FileSpreadsheet,
  LayoutTemplate,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
  Users,
} from "lucide-react";
import { BrandMark } from "@/components/AuthLayout";
import RosterPreview from "@/components/marketing/RosterPreview";

const FEATURES = [
  {
    icon: Sparkles,
    title: "Autofill the day",
    body: "Place every task across your team in one click, respecting working hours, breaks and the times each task runs.",
  },
  {
    icon: LayoutTemplate,
    title: "Reusable task templates",
    body: "Define front desk, tours, programs and breaks once, including the days and times they apply, then reuse them every day.",
  },
  {
    icon: Users,
    title: "People and availability",
    body: "Keep each person's regular hours, alternating week patterns and day-to-day changes in one place.",
  },
  {
    icon: UserRoundCheck,
    title: "School tour imports",
    body: "Import booked school tours from a spreadsheet and drop them straight into the right day's roster.",
  },
  {
    icon: FileSpreadsheet,
    title: "Export to Excel",
    body: "Download a finished roster as a formatted Excel file, ready to print or share with the team.",
  },
  {
    icon: ShieldCheck,
    title: "Secure by default",
    body: "Admin-approved accounts, two-factor sign-in, single-use password reset links and a full account activity log.",
  },
];

const STEPS = [
  { title: "Set up your team", body: "Add people with their usual hours, and the tasks your day needs." },
  { title: "Autofill a day", body: "Pick a date and let the roster fill itself from your templates." },
  { title: "Adjust and share", body: "Drag to fine-tune anything, then export the roster for the team." },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-[#111827]">
      <header className="sticky top-0 z-50 border-b border-[#eceef2] bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
          <BrandMark className="text-[#111827]" />

          <nav className="hidden items-center gap-8 text-[14px] font-medium text-[#5b6474] md:flex" aria-label="Sections">
            <a href="#features" className="transition hover:text-[#111827]">
              Features
            </a>
            <a href="#how-it-works" className="transition hover:text-[#111827]">
              How it works
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/signup"
              className="inline-flex h-9 items-center whitespace-nowrap rounded-[9px] px-3 text-[14px] font-semibold text-[#111827] transition hover:bg-[#f1f3f6]"
            >
              Sign in
            </Link>
            <Link
              href="/signup?mode=request"
              className="hidden h-9 items-center whitespace-nowrap rounded-[9px] bg-[var(--accent)] px-3.5 text-[14px] font-semibold text-white transition hover:bg-[var(--accent-strong)] sm:inline-flex"
            >
              Request access
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-[560px] bg-[radial-gradient(60%_60%_at_70%_20%,var(--accent-soft)_0%,rgba(255,255,255,0)_70%)]"
            aria-hidden="true"
          />
          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:pt-24">
            <div className="hero-copy-animate">
              <p className="inline-flex items-center gap-2 rounded-full border border-[#dfe3ea] bg-white px-3 py-1 text-[13px] font-medium text-[#5b6474]">
                <Sparkles className="h-3.5 w-3.5 text-[var(--accent)]" aria-hidden="true" />
                Daily staff rostering
              </p>
              <h1 className="mt-5 text-[2.5rem] font-semibold leading-[1.05] tracking-[-0.035em] sm:text-[3.4rem]">
                Build tomorrow&apos;s roster in minutes, not hours.
              </h1>
              <p className="mt-5 max-w-[520px] text-[17px] leading-7 text-[#5b6474]">
                Roster Generator plans who does what, and when, across your whole team. Autofill the day from your
                task templates, adjust anything by hand, and share the finished plan.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href="/signup"
                  className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-[var(--accent)] px-5 text-[15px] font-semibold text-white shadow-[0_1px_2px_rgba(16,24,40,0.12)] transition hover:bg-[var(--accent-strong)]"
                >
                  Sign in
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/signup?mode=request"
                  className="inline-flex h-11 items-center rounded-[10px] border border-[#d6dbe4] bg-white px-5 text-[15px] font-semibold text-[#111827] transition hover:bg-[#f8f9fb]"
                >
                  Request access
                </Link>
              </div>
            </div>

            <div className="lg:pl-4">
              <RosterPreview />
            </div>
          </div>
        </section>

        <section id="features" className="scroll-mt-16 border-t border-[#eceef2] bg-[#f8f9fb] py-20">
          <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
            <div className="max-w-[560px]">
              <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">Features</p>
              <h2 className="mt-2 text-[2rem] font-semibold leading-tight tracking-[-0.03em]">
                Everything a busy team needs to run the day
              </h2>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, body }) => (
                <div key={title} className="rounded-[14px] border border-[#e2e6ec] bg-white p-6">
                  <span className="grid h-10 w-10 place-items-center rounded-[10px] bg-[var(--accent-soft)] text-[var(--accent)]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 text-[16px] font-semibold">{title}</h3>
                  <p className="mt-1.5 text-[14.5px] leading-6 text-[#5b6474]">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="scroll-mt-16 py-20">
          <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
            <div className="max-w-[560px]">
              <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--accent)]">How it works</p>
              <h2 className="mt-2 text-[2rem] font-semibold leading-tight tracking-[-0.03em]">From blank day to finished roster</h2>
            </div>
            <ol className="mt-10 grid gap-6 md:grid-cols-3">
              {STEPS.map((step, index) => (
                <li key={step.title} className="relative border-t-2 border-[#e2e6ec] pt-5">
                  <span className="absolute -top-[2px] left-0 h-[2px] w-12 bg-[var(--accent)]" aria-hidden="true" />
                  <p className="text-[13px] font-semibold tabular-nums text-[var(--accent)]">Step {index + 1}</p>
                  <h3 className="mt-1 text-[17px] font-semibold">{step.title}</h3>
                  <p className="mt-1.5 text-[14.5px] leading-6 text-[#5b6474]">{step.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="px-5 pb-20 sm:px-8">
          <div className="mx-auto flex w-full max-w-6xl flex-col items-start justify-between gap-6 rounded-[18px] bg-[var(--accent)] px-8 py-10 text-white sm:flex-row sm:items-center sm:px-12">
            <div>
              <h2 className="text-[1.6rem] font-semibold tracking-[-0.02em] text-white">Ready to plan your next day?</h2>
              <p className="mt-1.5 text-[15px] text-white/80">Sign in, or request an account from your administrator.</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/signup"
                className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-white px-5 text-[15px] font-semibold text-[var(--accent)] transition hover:bg-white/90"
              >
                Sign in
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/signup?mode=request"
                className="inline-flex h-11 items-center rounded-[10px] border border-white/40 px-5 text-[15px] font-semibold text-white transition hover:bg-white/10"
              >
                Request access
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#eceef2]">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-3 px-5 py-6 text-[13px] text-[#8a93a3] sm:flex-row sm:px-8">
          <BrandMark className="text-[#374151]" />
          <span>© {new Date().getFullYear()} Roster Generator</span>
        </div>
      </footer>
    </div>
  );
}
