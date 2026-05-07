"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, LoaderCircle } from "lucide-react";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [twoFactorName, setTwoFactorName] = useState("");
  const [error, setError] = useState("");
  const redirectTarget = (() => {
    const next = searchParams.get("next");
    return next && next.startsWith("/") ? next : "/rosters";
  })();

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : { session: null }))
      .then((data) => {
        if (data?.session) {
          router.replace(redirectTarget);
          return;
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [redirectTarget, router]);

  const isDisabled = loading || submitting;

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (requiresTwoFactor) {
      const normalizedCode = code.trim();
      if (!normalizedCode) {
        setError("Enter your verification code.");
        return;
      }

      try {
        setSubmitting(true);
        const res = await fetch("/api/auth/session/verify-2fa", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ code: normalizedCode }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Verification failed");
        router.push(redirectTarget);
      } catch (err: any) {
        setError(err?.message || "Could not verify the code.");
      } finally {
        setSubmitting(false);
      }
      return;
    }

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

    try {
      setSubmitting(true);
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Login failed");

      if (data?.requiresTwoFactor) {
        setRequiresTwoFactor(true);
        setTwoFactorName(data?.user?.name || normalizedEmail);
        setCode("");
        return;
      }

      router.push(redirectTarget);
    } catch (err: any) {
      setError(err?.message || "Could not start a session. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-[var(--app-bg)]">
      <header className="px-4 py-4 sm:px-8 sm:py-6">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-3 font-serif text-lg font-bold uppercase leading-none text-[var(--ink)] transition hover:text-[var(--accent)]"
          >
            <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--accent)] text-[20px] text-white">RG</span>
            <span>
              Roster
              <br />
              Generator
            </span>
          </Link>

          <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-sm text-[var(--muted-strong)]">
            <span className="hidden sm:inline">Need access?</span>
            <a
              href="mailto:admin@rosterplanner.app?subject=Access%20request%20for%20Roster%20Generator"
              className="font-medium text-[var(--ink)] underline underline-offset-4 transition hover:text-[var(--accent)]"
            >
              Contact admin
            </a>
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-10 pt-8 sm:px-5 sm:pb-12 sm:pt-6">
        <section className="w-full max-w-[360px] sm:max-w-[380px]">
          <div className="text-center">
            <h1 className="font-serif text-[1.9rem] font-semibold text-[var(--ink)] sm:text-[2.35rem]">
              {requiresTwoFactor ? "Verify sign in" : "Welcome back"}
            </h1>
            <p className="mt-3 text-[0.98rem] leading-7 text-[var(--muted-strong)]">
              {requiresTwoFactor
                ? `Enter the authenticator code for ${twoFactorName || "your account"}. Recovery codes also work.`
                : "Sign in to continue to your roster workspace."}
            </p>
          </div>

          <form className="mt-7 space-y-4 sm:mt-8" onSubmit={handleLogin}>
            {!requiresTwoFactor && (
              <>
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
                    className="h-[50px] w-full rounded-[12px] border border-[var(--border)] bg-[var(--surface)] px-4 text-[15px] text-[var(--ink)] outline-none transition placeholder:text-[#8b837a] focus:border-[rgba(57,36,147,0.55)] focus:ring-2 focus:ring-[rgba(57,36,147,0.16)] sm:h-[52px]"
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
                    className="h-[50px] w-full rounded-[12px] border border-[var(--border)] bg-[var(--surface)] px-4 pr-12 text-[15px] text-[var(--ink)] outline-none transition placeholder:text-[#8b837a] focus:border-[rgba(57,36,147,0.55)] focus:ring-2 focus:ring-[rgba(57,36,147,0.16)] sm:h-[52px]"
                    placeholder="Password"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[var(--muted-strong)] transition hover:bg-black/5 hover:text-[var(--ink)]"
                  >
                    {showPassword ? (
                      <EyeOff className="h-[17px] w-[17px]" />
                    ) : (
                      <Eye className="h-[17px] w-[17px]" />
                    )}
                  </button>
                </div>
              </>
            )}

            {requiresTwoFactor && (
              <div>
                <label htmlFor="code" className="sr-only">
                  Verification code
                </label>
                <input
                  id="code"
                  type="text"
                  autoComplete="one-time-code"
                  inputMode="numeric"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  disabled={isDisabled}
                  className="h-[50px] w-full rounded-[12px] border border-[var(--border)] bg-[var(--surface)] px-4 text-[15px] tracking-[0.28em] text-[var(--ink)] outline-none transition placeholder:tracking-normal placeholder:text-[#8b837a] focus:border-[rgba(57,36,147,0.55)] focus:ring-2 focus:ring-[rgba(57,36,147,0.16)] sm:h-[52px]"
                  placeholder="123456 or recovery code"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isDisabled}
              className="inline-flex h-[50px] w-full items-center justify-center gap-2 rounded-[12px] border border-[var(--accent)] bg-[var(--accent)] px-5 text-[1rem] font-semibold text-white shadow-[0_8px_18px_rgba(57,36,147,0.18)] transition hover:border-[var(--accent-strong)] hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-70 sm:h-[52px]"
            >
              {submitting ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  {requiresTwoFactor ? "Verifying" : "Signing in"}
                </>
              ) : requiresTwoFactor ? (
                "Verify"
              ) : (
                "Continue"
              )}
            </button>

            {requiresTwoFactor && (
              <button
                type="button"
                className="w-full text-sm text-[#4b5563] underline underline-offset-4 transition hover:text-[#111827]"
                onClick={() => {
                  setRequiresTwoFactor(false);
                  setCode("");
                  setError("");
                }}
              >
                Back to password sign in
              </button>
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
          <span className="hidden text-[#c2c8d1] sm:inline">|</span>
          <a href="#" className="transition hover:text-[#6b7280]">
            Terms of Use
          </a>
        </div>
      </footer>
    </div>
  );
}
