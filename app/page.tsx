import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export default function HomePage() {
  return (
    <div className={`${inter.className} min-h-screen bg-[#f7f3e8] text-[#1f2733]`}>
      <header className="sticky top-0 z-50 border-b border-[#e2e7f0] bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4 sm:px-10">
          <Link
            href="/"
            className="inline-flex items-center text-[1.85rem] font-semibold tracking-[-0.02em] text-[#1b2a44]"
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
            <a href="#hero" className="transition hover:text-[#1b2a44]">
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
            <Link
              href="/signup"
              className="inline-flex h-12 items-center rounded-xl border border-[#3349ff] px-6 text-[1.05rem] font-semibold text-[#3349ff] transition hover:bg-[#f4f6ff]"
            >
              Get demo
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-[calc(100vh-81px)] w-full max-w-5xl items-center justify-center px-6 py-20 sm:px-10">
        <section id="hero" className="hero-copy-animate max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#e8dfcd] bg-white/90 px-3 py-1 text-xs font-semibold uppercase tracking-[0.1em] text-[#516078]">
            <Sparkles className="h-3.5 w-3.5" />
            Straightforward rostering software
          </div>

          <h1 className="mt-6 text-[2.4rem] font-semibold leading-[1.05] text-[#101827] sm:text-[3.4rem] lg:text-[4rem]">
            Roster your day in seconds
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-[1.06rem] leading-relaxed text-[#465267] sm:text-[1.2rem]">
            Plan people, shifts, and tasks from one clean workspace with less admin overhead.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-[#16263f] px-6 text-sm font-semibold text-white transition hover:bg-[#0f1e34]"
            >
              Start for free
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
