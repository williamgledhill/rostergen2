import Link from "next/link";
import React from "react";
import { CalendarRange, Check } from "lucide-react";
import RosterPreview from "@/components/marketing/RosterPreview";

/** Shared look for the sign-in, request-access and password-reset screens. */

export const authInputClass =
  "h-11 w-full rounded-[10px] border border-[#d6dbe4] bg-white px-3.5 text-[15px] text-[#111827] outline-none transition placeholder:text-[#9aa1ad] focus:border-[var(--accent)] focus:ring-[3px] focus:ring-[var(--accent-ring)] disabled:bg-[#f5f6f8]";

export const authLabelClass = "mb-1.5 block text-[13px] font-medium text-[#374151]";

export const authPrimaryButtonClass =
  "inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-[var(--accent)] px-5 text-[15px] font-semibold text-white shadow-[0_1px_2px_rgba(16,24,40,0.12)] transition hover:bg-[var(--accent-strong)] focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-[var(--accent-ring)] disabled:cursor-not-allowed disabled:opacity-70";

export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-2.5 whitespace-nowrap text-[15px] font-semibold tracking-[-0.01em] ${className}`}>
      <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-[var(--accent)] text-white">
        <CalendarRange className="h-[17px] w-[17px]" aria-hidden="true" />
      </span>
      Roster Generator
    </Link>
  );
}

export function AuthAlert({ tone, children }: { tone: "error" | "success"; children: React.ReactNode }) {
  const styles =
    tone === "error"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-[10px] border px-3.5 py-3 text-[14px] ${styles}`}>
      {children}
    </div>
  );
}

const HIGHLIGHTS = [
  "Autofill a full day from your task templates",
  "Everyone's hours and availability in one place",
  "Export the finished roster to Excel",
];

export default function AuthLayout({
  title,
  description,
  children,
}: {
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid min-h-screen bg-white lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="flex flex-col px-5 py-6 sm:px-10">
        <BrandMark className="text-[#111827]" />

        <main className="flex flex-1 items-center justify-center py-10">
          <div className="hero-copy-animate w-full max-w-[380px]">
            <h1 className="text-[1.75rem] font-semibold tracking-[-0.03em] text-[#111827]">{title}</h1>
            {description && <p className="mt-2 text-[15px] leading-6 text-[#5b6474]">{description}</p>}
            <div className="mt-7">{children}</div>
          </div>
        </main>

        <p className="text-[12px] text-[#9aa1ad]">© {new Date().getFullYear()} Roster Generator</p>
      </div>

      <aside className="relative hidden overflow-hidden bg-[var(--accent)] lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-12 xl:px-16">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.12]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "44px 44px",
          }}
        />
        <div className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/10 blur-3xl" />

        <div className="relative max-w-[440px] text-white">
          <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-white/70">Daily staff rostering</p>
          <h2 className="mt-3 text-[2rem] font-semibold leading-[1.15] tracking-[-0.03em] text-white">
            Every person, every task, one clear plan for the day.
          </h2>
          <ul className="mt-6 space-y-2.5 text-[15px] text-white/90">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-start gap-2.5">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-white/15">
                  <Check className="h-3 w-3" aria-hidden="true" />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mt-10 max-w-[520px] translate-x-6">
          <RosterPreview compact />
        </div>
      </aside>
    </div>
  );
}
