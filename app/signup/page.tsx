"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";

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
    <div className="flex min-h-screen flex-col bg-[#fcfbf8]">
      <header className="px-4 py-4 sm:px-8 sm:py-6">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
          <Link
            href="/"
            className="text-lg font-semibold tracking-[-0.02em] text-[#111827] transition hover:text-black"
          >
            Roster Generator
          </Link>

          <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-sm text-[#4b5563]">
            <span className="hidden sm:inline">Don&apos;t have an account?</span>
            <a
              href="mailto:admin@rosterplanner.app?subject=Sign%20up%20for%20Roster%20Generator"
              className="font-medium text-[#111827] underline underline-offset-4 transition hover:text-black"
            >
              Sign up
            </a>
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-10 pt-8 sm:px-5 sm:pb-12 sm:pt-6">
        <section className="w-full max-w-[420px]">
          <div className="text-center">
            <h1 className="text-[2rem] font-semibold tracking-[-0.04em] text-[#111827] sm:text-[2.65rem]">
              Welcome back
            </h1>
            <p className="mt-3 text-[0.98rem] leading-7 text-[#6b7280]">
              Sign in to continue to your roster workspace.
            </p>
          </div>

          <form className="mt-8 space-y-4 sm:mt-10" onSubmit={handleLogin}>
            <div>
              <label htmlFor="email" className="sr-only">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={isDisabled}
                className="h-[52px] w-full rounded-[18px] border border-[#d7dfeb] bg-[#f3f2ef] px-4 text-[15px] text-[#111827] outline-none transition placeholder:text-[#6b7280] focus:border-[rgba(52,77,232,0.45)] focus:bg-white focus:ring-4 focus:ring-[rgba(52,77,232,0.14)] sm:h-14 sm:px-5"
                placeholder="Email"
              />
            </div>

            <div className="relative">
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={isDisabled}
                className="h-[52px] w-full rounded-[18px] border border-[#d7dfeb] bg-[#f3f2ef] px-4 pr-12 text-[15px] text-[#111827] outline-none transition placeholder:text-[#6b7280] focus:border-[rgba(52,77,232,0.45)] focus:bg-white focus:ring-4 focus:ring-[rgba(52,77,232,0.14)] sm:h-14 sm:px-5 sm:pr-14"
                placeholder="Password"
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[#6b7280] transition hover:bg-black/5 hover:text-[#111827]"
              >
                {showPassword ? (
                  <EyeOff className="h-[17px] w-[17px]" />
                ) : (
                  <Eye className="h-[17px] w-[17px]" />
                )}
              </button>
            </div>

            <button
              type="submit"
              disabled={isDisabled}
              className="inline-flex h-[52px] w-full items-center justify-center gap-2 rounded-full border border-[var(--accent)] bg-[var(--accent)] px-5 text-[1rem] font-semibold text-white transition hover:bg-[var(--accent-strong)] hover:border-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-70 sm:h-14"
            >
              {submitting ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  Signing in
                </>
              ) : (
                "Continue"
              )}
            </button>

            {!loading && accounts.length === 0 && (
              <div className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                No accounts are available in this environment.
              </div>
            )}

            {error && (
              <div
                role="alert"
                className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
              >
                {error}
              </div>
            )}
          </form>
        </section>
      </main>

      <footer className="px-4 pb-6 pt-2 sm:px-8 sm:pb-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-center gap-1 text-center text-xs text-[#9aa1ad] sm:flex-row sm:gap-3">
          <span>Powered by Roster Generator</span>
          <span className="hidden sm:inline text-[#c2c8d1]">•</span>
          <a href="#" className="transition hover:text-[#6b7280]">
            Terms of Use
          </a>
        </div>
      </footer>
    </div>
  );
}
