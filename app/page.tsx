import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Inter } from "next/font/google";
import LandingSoftwareDemo from "@/components/LandingSoftwareDemo";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export default function HomePage() {
  return (
    <div className={`${inter.className} min-h-screen bg-white text-[#1f2733]`}>
      <header className="sticky top-0 z-50 border-b border-[#e2e7f0] bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-10 sm:py-4">
          <Link
            href="/"
            className="inline-flex items-center text-[1.25rem] font-semibold tracking-[-0.02em] text-[#1b2a44] sm:text-[1.85rem]"
          >
            Roster Generator
          </Link>

          <nav className="hidden items-center gap-8 text-[1.05rem] font-medium text-[#31435f] lg:flex">
            <a href="#hero" className="transition hover:text-[#1b2a44]">
              Features
            </a>
            <a href="#hero" className="transition hover:text-[#1b2a44]">
              Benefits
            </a>
            <a href="#demo" className="transition hover:text-[#1b2a44]">
              Integrations
            </a>
          </nav>

          <div className="flex items-center gap-2.5 sm:gap-4">
            <Link
              href="/signup"
              className="hidden h-10 items-center px-2 text-[0.98rem] font-semibold text-[var(--accent)] transition hover:text-[var(--accent-strong)] sm:inline-flex"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-10 items-center rounded-full bg-[var(--accent)] px-4 text-[0.95rem] font-semibold text-white transition hover:bg-[var(--accent-strong)] sm:h-11 sm:px-6 sm:text-sm"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-10">
        <section id="hero" className="hero-copy-animate mx-auto max-w-3xl py-20 text-center sm:py-24">
          <h1 className="text-[2rem] font-semibold leading-[1.05] text-[#101827] sm:text-[3.4rem] lg:text-[4rem]">
            Create rosters in seconds
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-[1.06rem] leading-relaxed text-[#465267] sm:text-[1.2rem]">
            Plan people, shifts, and tasks from one clean workspace with less admin overhead.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--accent)] px-6 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
            >
              Get started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section id="demo" className="mx-auto max-w-6xl">
          <div className="relative rounded-[26px] border border-[#d7dfef] bg-[linear-gradient(180deg,#f6f9ff_0%,#eef3fc_100%)] p-3 shadow-[0_22px_60px_rgba(27,42,68,0.12)] sm:p-5">
            <div className="pointer-events-none absolute -left-16 top-10 h-36 w-36 rounded-full bg-[var(--accent-soft)] blur-3xl" />
            <div className="pointer-events-none absolute -right-14 bottom-8 h-40 w-40 rounded-full bg-[#d9e2ff] blur-3xl" />

            <div className="relative">
              <LandingSoftwareDemo />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
