import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  CheckCheck,
  ClipboardList,
  Download,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { DM_Sans, Poppins, Space_Grotesk } from "next/font/google";

const dmSans = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
});

const features = [
  {
    title: "Plan once, reuse every month",
    detail:
      "Save repeating shifts and templates so your next roster starts 80% done.",
    icon: CalendarClock,
  },
  {
    title: "Keep everyone in sync",
    detail:
      "Task, people, and day views stay connected so handovers are clear and fast.",
    icon: ClipboardList,
  },
  {
    title: "Export when you need it",
    detail:
      "Download clean roster outputs for operations, reporting, or compliance checks.",
    icon: Download,
  },
  {
    title: "Built-in access controls",
    detail:
      "Editor and admin permissions keep updates safe without slowing your team down.",
    icon: ShieldCheck,
  },
];

const workflow = [
  {
    title: "Choose a month",
    detail: "Start from a blank board or use your saved template.",
  },
  {
    title: "Assign people and tasks",
    detail: "Drop tasks into shifts and quickly rebalance your coverage.",
  },
  {
    title: "Publish and iterate",
    detail: "Update in minutes as availability changes across the month.",
  },
];

export default function HomePage() {
  return (
    <div className={`${dmSans.className} min-h-screen bg-[#f7f3e8] text-[#1f2733]`}>
      <header className="sticky top-0 z-50 border-b border-[#e2e7f0] bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 sm:px-10">
          <Link
            href="/"
            className={`${poppins.className} inline-flex items-center text-[1.85rem] font-semibold tracking-[-0.02em] text-[#1b2a44]`}
          >
            Roster Generator
          </Link>

          <nav className="hidden items-center gap-8 text-[1.05rem] font-medium text-[#31435f] lg:flex">
            <a href="#features" className="transition hover:text-[#1b2a44]">
              Features
            </a>
            <a href="#benefits" className="transition hover:text-[#1b2a44]">
              Benefits
            </a>
            <a href="#integrations" className="transition hover:text-[#1b2a44]">
              Integrations
            </a>
          </nav>

          <div className="flex items-center gap-2.5 sm:gap-4">
            <Link
              href="/signup"
              className="inline-flex h-10 items-center px-2 text-[1.05rem] font-semibold text-[#3349ff] transition hover:text-[#2037f7]"
            >
              Login
            </Link>
            <a
              href="#demo"
              className="inline-flex h-12 items-center rounded-xl border border-[#3349ff] px-6 text-[1.05rem] font-semibold text-[#3349ff] transition hover:bg-[#f4f6ff]"
            >
              Get demo
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-6 pb-20 sm:px-10">
        <section className="grid gap-12 rounded-[30px] bg-[linear-gradient(140deg,#fffdf8_0%,#fff5d9_60%,#f5efe0_100%)] px-7 py-10 shadow-[0_30px_70px_rgba(39,34,23,0.1)] lg:grid-cols-[1.1fr_0.9fr] lg:gap-10 lg:px-12 lg:py-14">
          <div className="hero-copy-animate">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#e8dfcd] bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-[#516078]">
              <Sparkles className="h-3.5 w-3.5" />
              Straightforward rostering software
            </div>

            <h1
              className={`${spaceGrotesk.className} mt-5 text-[2.2rem] font-semibold leading-[1.06] text-[#101827] sm:text-[3rem] lg:text-[3.35rem]`}
            >
              Build accurate staff rosters in minutes.
            </h1>

            <p className="mt-5 max-w-xl text-[1.05rem] leading-relaxed text-[#465267] sm:text-lg">
              Roster Planner gives operations teams one clear place to schedule people, shifts, and tasks without spreadsheet overhead.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href="/signup"
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[#16263f] px-6 text-sm font-semibold text-white transition hover:bg-[#0f1e34]"
              >
                Start for free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#features"
                className="inline-flex h-11 items-center rounded-full border border-[#d0c8b7] px-6 text-sm font-semibold text-[#253043] transition hover:border-[#bcb19d] hover:bg-white"
              >
                See features
              </a>
            </div>

            <div className="mt-9 grid gap-3 text-sm text-[#3b4658] sm:grid-cols-3">
              <div className="rounded-2xl border border-[#ebe1ce] bg-white/80 px-4 py-3">
                <p className="text-xl font-bold text-[#111827]">5 min</p>
                <p className="mt-1 text-xs uppercase tracking-[0.08em]">Average setup time</p>
              </div>
              <div className="rounded-2xl border border-[#ebe1ce] bg-white/80 px-4 py-3">
                <p className="text-xl font-bold text-[#111827]">1 place</p>
                <p className="mt-1 text-xs uppercase tracking-[0.08em]">People, shifts, tasks</p>
              </div>
              <div className="rounded-2xl border border-[#ebe1ce] bg-white/80 px-4 py-3">
                <p className="text-xl font-bold text-[#111827]">0 clutter</p>
                <p className="mt-1 text-xs uppercase tracking-[0.08em]">Clear daily view</p>
              </div>
            </div>
          </div>

          <div className="relative overflow-hidden rounded-[24px] border border-[#eadfca] bg-[#14243d] px-5 py-6 text-white sm:px-7 sm:py-7">
            <div className="absolute -right-16 -top-20 h-40 w-40 rounded-full bg-[#f6c665]/25 blur-3xl" />
            <div className="absolute -left-10 bottom-0 h-44 w-44 rounded-full bg-[#61b5a0]/20 blur-3xl" />

            <div className="relative space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-white/20 bg-white/10 px-4 py-2">
                <p className="text-sm font-semibold">March 2026 Roster</p>
                <span className="rounded-full bg-white/20 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.08em]">
                  Live
                </span>
              </div>

              <div className="grid gap-2">
                <div className="row-slide-animate rounded-xl border border-[#2e4b6f] bg-[#1d3252] p-3">
                  <p className="text-xs uppercase tracking-[0.1em] text-[#a8bfd9]">Morning</p>
                  <p className="mt-1 text-sm font-semibold">Front Desk, Gallery Prep, Tours</p>
                </div>
                <div className="row-slide-animate rounded-xl border border-[#2e4b6f] bg-[#1d3252] p-3" style={{ animationDelay: "320ms" }}>
                  <p className="text-xs uppercase tracking-[0.1em] text-[#a8bfd9]">Midday</p>
                  <p className="mt-1 text-sm font-semibold">Cashier Rotation, Break Coverage</p>
                </div>
                <div className="row-slide-animate rounded-xl border border-[#2e4b6f] bg-[#1d3252] p-3" style={{ animationDelay: "430ms" }}>
                  <p className="text-xs uppercase tracking-[0.1em] text-[#a8bfd9]">Afternoon</p>
                  <p className="mt-1 text-sm font-semibold">Tours, Cleaning, Close Checklist</p>
                </div>
              </div>

              <div className="rounded-xl border border-[#385b84] bg-[#1a2f4e] px-4 py-3">
                <p className="flex items-center gap-2 text-sm font-medium text-[#d2deec]">
                  <CheckCheck className="h-4 w-4 text-[#8ce3bd]" />
                  No shift conflicts detected
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="mt-16">
          <h2 className={`${spaceGrotesk.className} text-3xl font-semibold text-[#101827]`}>
            Everything you need, nothing you do not
          </h2>
          <p className="mt-3 max-w-2xl text-[#4c596e]">
            Built for teams that want clean scheduling workflows, clear ownership, and faster monthly planning.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {features.map(({ title, detail, icon: Icon }, index) => (
              <article
                key={title}
                className="feature-card-animate rounded-2xl border border-[#e6dcc9] bg-[#fffdf8] p-5"
                style={{ animationDelay: `${120 + index * 90}ms` }}
              >
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[#f8f0de] text-[#253043]">
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className={`${spaceGrotesk.className} mt-4 text-xl font-semibold text-[#132033]`}>
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#4c596e]">{detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="benefits" className="mt-16 rounded-3xl border border-[#e4dac7] bg-white px-6 py-8 sm:px-8 sm:py-10">
          <h2 className={`${spaceGrotesk.className} text-3xl font-semibold text-[#101827]`}>
            Simple workflow from draft to publish
          </h2>

          <div className="mt-7 grid gap-5 md:grid-cols-3">
            {workflow.map((step, index) => (
              <article key={step.title} className="rounded-2xl border border-[#ece3d2] bg-[#fffdfa] p-5">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[#6f7d95]">
                  Step {index + 1}
                </p>
                <h3 className={`${spaceGrotesk.className} mt-3 text-xl font-semibold text-[#132033]`}>
                  {step.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#4c596e]">{step.detail}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="integrations" className="mt-16 rounded-3xl border border-[#e4dac7] bg-[#fffdfa] px-6 py-8 sm:px-8 sm:py-10">
          <h2 className={`${spaceGrotesk.className} text-3xl font-semibold text-[#101827]`}>
            Integrations that fit your stack
          </h2>
          <p className="mt-3 max-w-2xl text-[#4c596e]">
            Connect roster data with tools your operations team already uses.
          </p>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {["Next.js", "Prisma", "PostgreSQL", "CSV Export"].map((item) => (
              <div key={item} className="rounded-xl border border-[#e6dcc9] bg-white px-4 py-3 text-sm font-semibold text-[#27374f]">
                {item}
              </div>
            ))}
          </div>
        </section>

        <section id="pricing" className="mt-16 grid gap-4 rounded-3xl bg-[#13233a] px-6 py-8 text-white sm:px-8 sm:py-10 md:grid-cols-2 md:gap-6">
          <div>
            <h2 className={`${spaceGrotesk.className} text-3xl font-semibold`}>
              Pricing that stays predictable
            </h2>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-[#c7d6e9]">
              Start free and move to a paid plan only when your team needs advanced admin controls and higher usage limits.
            </p>
          </div>

          <div className="grid gap-3">
            <div className="rounded-2xl border border-white/20 bg-white/10 px-5 py-4">
              <p className="text-sm font-semibold uppercase tracking-[0.1em] text-[#bed0e7]">Starter</p>
              <p className="mt-2 text-2xl font-bold">$0</p>
              <p className="mt-1 text-sm text-[#d8e3f1]">Up to 3 editors, monthly roster planning included</p>
            </div>
            <div className="rounded-2xl border border-[#f7d486] bg-[#f6c665] px-5 py-4 text-[#1d2430]">
              <p className="text-sm font-semibold uppercase tracking-[0.1em]">Operations Pro</p>
              <p className="mt-2 text-2xl font-bold">$29 / month</p>
              <p className="mt-1 text-sm">Unlimited editors, advanced admin controls, priority support</p>
            </div>
          </div>
        </section>

        <section id="demo" className="mt-16 rounded-3xl border border-[#e4dac7] bg-white px-6 py-9 text-center sm:px-8 sm:py-11">
          <h2 className={`${spaceGrotesk.className} text-3xl font-semibold text-[#101827]`}>
            Ready to simplify your next roster?
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#4c596e] sm:text-base">
            Create an account and publish your first schedule in one sitting.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-[#16263f] px-6 text-sm font-semibold text-white transition hover:bg-[#0f1e34]"
            >
              Open Roster Planner
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#e5dcc8] px-6 py-6 text-center text-xs font-medium uppercase tracking-[0.1em] text-[#5f6c82] sm:px-10">
        Roster Planner
      </footer>

    </div>
  );
}
