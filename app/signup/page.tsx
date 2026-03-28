"use client";

import Image from "next/image";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from "lucide-react";

type Editor = { id: string; name: string; isAdmin?: boolean };
type Account = { id: string; name: string; company: string; editors: Editor[] };

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_EMAIL = "admin@rosterplanner.app";
const DEFAULT_PASSWORD = "password123";

function toSlugToken(value: string) {
  const normalized = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/(^\.+|\.+$)/g, "");
  return normalized || "editor";
}

function defaultEmailForEditor(editor: Editor) {
  return `${toSlugToken(editor.id || editor.name)}@rosterplanner.app`;
}

export default function SignupPage() {
  const router = useRouter();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [email, setEmail] = useState(DEFAULT_EMAIL);
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : { session: null }))
      .then((data) => {
        if (data?.session) {
          router.replace("/editor");
        }
      })
      .catch(() => null);
  }, [router]);

  useEffect(() => {
    fetch("/api/auth/accounts")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setAccounts(list);
      })
      .finally(() => setLoading(false));
  }, []);

  const isDisabled = loading || submitting;
  const accountCount = accounts.length;

  function resolveSessionTarget(normalizedEmail: string) {
    const options = accounts.flatMap((account) =>
      (account.editors || []).map((editor) => ({
        accountId: account.id,
        editorId: editor.id,
        isAdmin: Boolean(editor.isAdmin),
        email: defaultEmailForEditor(editor).toLowerCase(),
      }))
    );

    if (options.length === 0) return null;

    const exact = options.find((option) => option.email === normalizedEmail);
    if (exact) return exact;

    const admin = options.find((option) => option.isAdmin);
    return admin || options[0];
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setError("Enter your email.");
      return;
    }
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (!password.trim()) {
      setError("Enter your password.");
      return;
    }

    const target = resolveSessionTarget(normalizedEmail);
    if (!target) {
      setError("No accounts are available in this environment.");
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: target.accountId, editorId: target.editorId }),
      });

      if (!res.ok) throw new Error("Login failed");
      router.push("/editor");
    } catch {
      setError("Could not start a session. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#f4efe4_0%,#eff4fb_48%,#f7f9fc_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top_left,rgba(246,198,101,0.18),transparent_55%),radial-gradient(circle_at_top_right,rgba(61,83,227,0.16),transparent_44%)]" />
      <div className="pointer-events-none absolute -left-16 top-24 h-64 w-64 rounded-full bg-[#f6c665]/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-20 bottom-12 h-72 w-72 rounded-full bg-[#8ea0ff]/20 blur-3xl" />

      <section className="relative mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-6xl items-center">
        <div className="grid w-full overflow-hidden rounded-[30px] border border-white/70 bg-white/82 shadow-[0_28px_100px_rgba(21,34,58,0.18)] backdrop-blur xl:grid-cols-[1.08fr_0.92fr]">
          <div className="relative flex flex-col justify-between overflow-hidden bg-[linear-gradient(160deg,#13243c_0%,#172e4f_55%,#1d3761_100%)] px-6 py-7 text-white sm:px-10 sm:py-10">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.14),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(246,198,101,0.16),transparent_30%)]" />

            <div className="relative">
              <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-3 py-2 backdrop-blur">
                <div className="rounded-2xl bg-white/95 p-2 shadow-[0_12px_32px_rgba(6,15,30,0.16)]">
                  <Image
                    src="/logos/roster-generator-icon.svg"
                    alt="Roster Generator logo"
                    width={34}
                    height={34}
                    priority
                  />
                </div>
                <div>
                  <p className="text-[0.7rem] font-semibold uppercase tracking-[0.28em] text-white/70">
                    Workspace Access
                  </p>
                  <p className="text-base font-semibold tracking-[-0.02em] text-white">
                    Roster Generator
                  </p>
                </div>
              </div>

              <div className="mt-12 max-w-xl">
                <p className="text-sm font-semibold uppercase tracking-[0.26em] text-[#f6c665]">
                  Secure Sign In
                </p>
                <h1 className="mt-4 max-w-lg text-[2.3rem] font-semibold leading-[1.02] tracking-[-0.04em] text-white sm:text-[3.25rem]">
                  Manage rosters from one polished operations workspace.
                </h1>
                <p className="mt-5 max-w-md text-[1rem] leading-7 text-slate-200">
                  Access scheduling, people, and monthly roster publishing from a cleaner admin
                  workspace built for repeatable planning.
                </p>
              </div>
            </div>

            <div className="relative mt-10 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
              {[
                {
                  icon: ShieldCheck,
                  title: "Protected access",
                  body: "Session checks stay in place before users reach the editor workspace.",
                },
                {
                  icon: CalendarClock,
                  title: "Monthly planning",
                  body: "Open rosters quickly and keep recurring schedules organised in one system.",
                },
                {
                  icon: Building2,
                  title: "Team-ready setup",
                  body: "Accounts and editor profiles are already wired into the login flow.",
                },
              ].map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="rounded-[22px] border border-white/12 bg-white/8 p-4 backdrop-blur-sm"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/12">
                    <Icon className="h-5 w-5 text-[#f6d788]" />
                  </div>
                  <h2 className="mt-4 text-base font-semibold text-white">{title}</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-300">{body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center bg-[linear-gradient(180deg,rgba(255,255,255,0.9)_0%,#fbfcfe_100%)] px-5 py-6 sm:px-8 sm:py-8 lg:px-12 xl:px-14">
            <div className="mx-auto w-full max-w-[460px]">
              <div className="rounded-full border border-[#d7dff0] bg-white px-3 py-1 text-[0.72rem] font-semibold uppercase tracking-[0.22em] text-[#43516c] shadow-[0_10px_30px_rgba(15,23,42,0.05)] w-fit">
                Admin Login
              </div>

              <div className="mt-6">
                <h2 className="text-[2rem] font-semibold leading-tight tracking-[-0.03em] text-[#101827] sm:text-[2.35rem]">
                  Sign in to your workspace
                </h2>
                <p className="mt-3 text-[0.98rem] leading-7 text-[#526078]">
                  Use your workspace email to continue into the roster editor. Demo credentials
                  are prefilled in this environment.
                </p>
              </div>

              <form className="mt-8 space-y-5" onSubmit={handleLogin}>
                <div className="space-y-2">
                  <label
                    htmlFor="email"
                    className="block text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-[#43516c]"
                  >
                    Email
                  </label>
                  <div className="group flex h-14 items-center rounded-[20px] border border-[#d7dfeb] bg-[#f8fafc] px-4 transition focus-within:border-[#5165eb] focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(81,101,235,0.12)]">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-[#5f6d84] shadow-[inset_0_0_0_1px_rgba(215,223,235,0.9)]">
                      <Mail className="h-[17px] w-[17px]" />
                    </div>
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      disabled={isDisabled}
                      className="h-full w-full bg-transparent px-3 text-[15px] text-[#101827] outline-none placeholder:text-[#7b879b]"
                      placeholder="name@company.com"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label
                    htmlFor="password"
                    className="block text-[0.78rem] font-semibold uppercase tracking-[0.18em] text-[#43516c]"
                  >
                    Password
                  </label>
                  <div className="group flex h-14 items-center rounded-[20px] border border-[#d7dfeb] bg-[#f8fafc] px-4 transition focus-within:border-[#5165eb] focus-within:bg-white focus-within:shadow-[0_0_0_4px_rgba(81,101,235,0.12)]">
                    <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white text-[#5f6d84] shadow-[inset_0_0_0_1px_rgba(215,223,235,0.9)]">
                      <LockKeyhole className="h-[17px] w-[17px]" />
                    </div>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="current-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      disabled={isDisabled}
                      className="h-full w-full bg-transparent px-3 text-[15px] text-[#101827] outline-none placeholder:text-[#7b879b]"
                      placeholder="Enter password"
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      onClick={() => setShowPassword((current) => !current)}
                      className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-[#5f6d84] transition hover:bg-white hover:text-[#16263f]"
                    >
                      {showPassword ? (
                        <EyeOff className="h-[18px] w-[18px]" />
                      ) : (
                        <Eye className="h-[18px] w-[18px]" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="rounded-[22px] border border-[#e2e8f5] bg-white p-4 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#16263f]">Workspace availability</p>
                      <p className="mt-1 text-sm leading-6 text-[#5b667b]">
                        {loading
                          ? "Loading available accounts for this environment."
                          : accountCount > 0
                            ? `${accountCount} account${accountCount === 1 ? "" : "s"} ready for sign-in.`
                            : "No accounts are currently configured for this environment."}
                      </p>
                    </div>
                    <div className="rounded-full bg-[#eef2ff] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[#3f55df]">
                      Local
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isDisabled}
                  className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-[20px] border border-[#4259ea] bg-[linear-gradient(135deg,#4f66f0_0%,#4259ea_100%)] px-5 text-[1rem] font-semibold text-white shadow-[0_18px_45px_rgba(66,89,234,0.26)] transition hover:-translate-y-0.5 hover:shadow-[0_22px_55px_rgba(66,89,234,0.3)] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {submitting ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Signing in
                    </>
                  ) : (
                    <>
                      Continue to editor
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>

                {!loading && accounts.length === 0 && (
                  <div className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    No accounts are available in this environment.
                  </div>
                )}

                {error && (
                  <div
                    role="alert"
                    className="rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                  >
                    {error}
                  </div>
                )}
              </form>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
