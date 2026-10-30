"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarRange, Eye, EyeOff, LoaderCircle } from "lucide-react";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 12;

export default function LoginView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<"signin" | "request">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [twoFactorName, setTwoFactorName] = useState("");
  const [error, setError] = useState("");
  const [requestSent, setRequestSent] = useState(false);
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
  const isRequest = mode === "request";

  function switchMode(next: "signin" | "request") {
    setMode(next);
    setError("");
    setRequestSent(false);
    setRequiresTwoFactor(false);
    setCode("");
    setPassword("");
  }

  async function handleRequest() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!name.trim()) {
      setError("Enter your name.");
      return;
    }
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }
    if (password.trim().length < MIN_PASSWORD_LENGTH) {
      setError(`Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    try {
      setSubmitting(true);
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: normalizedEmail, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Request failed");
      setRequestSent(true);
      setPassword("");
    } catch (err: any) {
      setError(err?.message || "Could not send your request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (isRequest) {
      await handleRequest();
      return;
    }

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
    <div className="flex min-h-screen flex-col bg-[var(--canvas)]">
      <header className="px-4 py-4 sm:px-8 sm:py-6">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-[16px] font-semibold tracking-[-0.01em] text-[#111827]"
          >
            <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-[var(--accent)] text-white">
              <CalendarRange className="h-[17px] w-[17px]" aria-hidden="true" />
            </span>
            Roster Generator
          </Link>

          <div className="flex flex-wrap items-center justify-end gap-x-2 gap-y-1 text-sm text-[#4b5563]">
            <span className="hidden sm:inline">{isRequest ? "Already have an account?" : "Need access?"}</span>
            <button
              type="button"
              onClick={() => switchMode(isRequest ? "signin" : "request")}
              className="font-medium text-[#111827] underline underline-offset-4 transition hover:text-black"
            >
              {isRequest ? "Sign in" : "Request access"}
            </button>
          </div>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-10 pt-8 sm:px-5 sm:pb-12 sm:pt-6">
        <section className="w-full max-w-[360px] sm:max-w-[380px]">
          <div className="text-center">
            <h1 className="text-[1.9rem] font-semibold tracking-[-0.04em] text-[#111827] sm:text-[2.35rem]">
              {isRequest ? "Request access" : requiresTwoFactor ? "Verify sign in" : "Welcome back"}
            </h1>
            <p className="mt-3 text-[0.98rem] leading-7 text-[#6b7280]">
              {isRequest
                ? "An administrator will review your request before you can sign in."
                : requiresTwoFactor
                ? `Enter the authenticator code for ${twoFactorName || "your account"}. Recovery codes also work.`
                : "Sign in to continue to your roster workspace."}
            </p>
          </div>

          {isRequest && requestSent ? (
            <div className="mt-7 space-y-4 sm:mt-8">
              <div
                role="status"
                className="rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              >
                Request sent. You can sign in once an administrator approves it.
              </div>
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className="w-full text-sm text-[#4b5563] underline underline-offset-4 transition hover:text-[#111827]"
              >
                Back to sign in
              </button>
            </div>
          ) : (
          <form className="mt-7 space-y-4 sm:mt-8" onSubmit={handleLogin}>
            {isRequest && (
              <div>
                <label htmlFor="name" className="sr-only">
                  Name
                </label>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  disabled={isDisabled}
                  className="h-[50px] w-full rounded-[14px] border border-[#d5dcf2] bg-white px-4 text-[15px] text-[#111827] outline-none transition placeholder:text-[#8b93a7] focus:border-[rgba(52,77,232,0.55)] focus:ring-2 focus:ring-[rgba(52,77,232,0.18)] sm:h-[52px]"
                  placeholder="Full name"
                />
              </div>
            )}

            {(isRequest || !requiresTwoFactor) && (
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
                    className="h-[50px] w-full rounded-[14px] border border-[#d5dcf2] bg-white px-4 text-[15px] text-[#111827] outline-none transition placeholder:text-[#8b93a7] focus:border-[rgba(52,77,232,0.55)] focus:ring-2 focus:ring-[rgba(52,77,232,0.18)] sm:h-[52px]"
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
                    autoComplete={isRequest ? "new-password" : "current-password"}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    disabled={isDisabled}
                    className="h-[50px] w-full rounded-[14px] border border-[#d5dcf2] bg-white px-4 pr-12 text-[15px] text-[#111827] outline-none transition placeholder:text-[#8b93a7] focus:border-[rgba(52,77,232,0.55)] focus:ring-2 focus:ring-[rgba(52,77,232,0.18)] sm:h-[52px]"
                    placeholder={isRequest ? `Password (at least ${MIN_PASSWORD_LENGTH} characters)` : "Password"}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[#6b7280] transition hover:bg-black/5 hover:text-[#111827]"
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

            {!isRequest && requiresTwoFactor && (
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
                  className="h-[50px] w-full rounded-[14px] border border-[#d5dcf2] bg-white px-4 text-[15px] tracking-[0.28em] text-[#111827] outline-none transition placeholder:tracking-normal placeholder:text-[#8b93a7] focus:border-[rgba(52,77,232,0.55)] focus:ring-2 focus:ring-[rgba(52,77,232,0.18)] sm:h-[52px]"
                  placeholder="123456 or recovery code"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isDisabled}
              className="inline-flex h-[50px] w-full items-center justify-center gap-2 rounded-[14px] border border-[var(--accent)] bg-[var(--accent)] px-5 text-[1rem] font-semibold text-white transition hover:border-[var(--accent-strong)] hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-70 sm:h-[52px]"
            >
              {submitting ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  {isRequest ? "Sending" : requiresTwoFactor ? "Verifying" : "Signing in"}
                </>
              ) : isRequest ? (
                "Send request"
              ) : requiresTwoFactor ? (
                "Verify"
              ) : (
                "Continue"
              )}
            </button>

            {!isRequest && requiresTwoFactor && (
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
          )}
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
