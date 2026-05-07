import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export default function HomePage() {
  return (
    <div className={`${inter.className} min-h-screen bg-[var(--app-bg)] text-[var(--ink)]`}>
      <header className="sticky top-0 z-50 border-b border-[var(--border)] bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-10 sm:py-4">
          <Link
            href="/"
            className="inline-flex items-center gap-3 font-serif text-[1.2rem] font-bold uppercase leading-none text-[var(--ink)] sm:text-[1.35rem]"
          >
            <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--accent)] text-[20px] text-white">RG</span>
            <span>
              Roster
              <br />
              Generator
            </span>
          </Link>

          <nav className="hidden items-center gap-8 text-[1rem] font-semibold text-[var(--muted-strong)] lg:flex">
            <a href="#hero" className="transition hover:text-[var(--accent)]">
              Features
            </a>
            <a href="#hero" className="transition hover:text-[var(--accent)]">
              Benefits
            </a>
            <a href="#demo" className="transition hover:text-[var(--accent)]">
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
              className="inline-flex h-10 items-center rounded-[10px] bg-[var(--accent)] px-4 text-[0.95rem] font-semibold text-white shadow-[0_6px_14px_rgba(51,34,139,0.16)] transition hover:bg-[var(--accent-strong)] sm:px-5 sm:text-sm"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-10">
        <section id="hero" className="hero-copy-animate mx-auto max-w-3xl py-20 text-center sm:py-24">
          <h1 className="font-serif text-[2rem] font-semibold leading-[1.05] text-[var(--ink)] sm:text-[3.4rem] lg:text-[4rem]">
            Create rosters in seconds
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-[1.06rem] leading-relaxed text-[var(--muted-strong)] sm:text-[1.2rem]">
            Plan people, shifts, and tasks from one clean workspace with less admin overhead.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-[var(--accent)] px-5 text-sm font-semibold text-white shadow-[0_6px_14px_rgba(51,34,139,0.16)] transition hover:bg-[var(--accent-strong)]"
            >
              Get started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section id="demo" className="mx-auto max-w-6xl">
          <div className="surface-panel p-3 sm:p-5">
            <img
              src="/demo-panel-static.png"
              alt="Roster editor software demo"
              className="relative w-full rounded-[10px] border border-[var(--border)]"
            />
          </div>
        </section>
      </main>
    </div>
  );
}
