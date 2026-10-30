"use client";

import Link from "next/link";
import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarRange, LoaderCircle } from "lucide-react";

const MIN_PASSWORD_LENGTH = 12;
const INPUT_CLASS =
  "h-[50px] w-full rounded-[14px] border border-[#d5dcf2] bg-white px-4 text-[15px] text-[#111827] outline-none transition placeholder:text-[#8b93a7] focus:border-[rgba(52,77,232,0.55)] focus:ring-2 focus:ring-[rgba(52,77,232,0.18)] sm:h-[52px]";

type Status = "checking" | "ready" | "invalid" | "done";

export default function ResetPasswordView() {
  const token = useSearchParams().get("token") ?? "";
  const [status, setStatus] = useState<Status>("checking");
  const [account, setAccount] = useState<{ name: string; email: string } | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    fetch(`/api/auth/password-reset?token=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.account) throw new Error(data?.error || "Invalid link");
        setAccount(data.account);
        setStatus("ready");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Invalid link");
        setStatus("invalid");
      });
  }, [token]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (password.trim().length < MIN_PASSWORD_LENGTH) {
      setError(`Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError("The passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Could not reset your password.");
      setStatus("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset your password.");
    } finally {
      setSubmitting(false);
    }
  }

  const heading =
    status === "done" ? "Password updated" : status === "invalid" ? "Link not valid" : "Choose a new password";

  return (
    <div className="flex min-h-screen flex-col bg-[var(--canvas)]">
      <header className="px-4 py-4 sm:px-8 sm:py-6">
        <div className="mx-auto flex w-full max-w-6xl items-center">
          <Link
            href="/"
            className="flex items-center gap-2.5 text-[16px] font-semibold tracking-[-0.01em] text-[#111827]"
          >
            <span className="grid h-8 w-8 place-items-center rounded-[9px] bg-[var(--accent)] text-white">
              <CalendarRange className="h-[17px] w-[17px]" aria-hidden="true" />
            </span>
            Roster Generator
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-4 pb-10 pt-8 sm:px-5 sm:pb-12 sm:pt-6">
        <section className="w-full max-w-[360px] sm:max-w-[380px]">
          <div className="text-center">
            <h1 className="text-[1.9rem] font-semibold tracking-[-0.04em] text-[#111827] sm:text-[2.35rem]">{heading}</h1>
            <p className="mt-3 text-[0.98rem] leading-7 text-[#6b7280]">
              {status === "checking" && "Checking your link…"}
              {status === "ready" && account && `For ${account.name} (${account.email}).`}
              {status === "invalid" && (error || "This reset link is invalid or has expired.")}
              {status === "done" && "You've been signed out everywhere. Sign in with your new password."}
            </p>
          </div>

          {status === "ready" && (
            <form className="mt-7 space-y-4 sm:mt-8" onSubmit={submit}>
              <input
                type="password"
                autoComplete="new-password"
                className={INPUT_CLASS}
                placeholder={`New password (at least ${MIN_PASSWORD_LENGTH} characters)`}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={submitting}
              />
              <input
                type="password"
                autoComplete="new-password"
                className={INPUT_CLASS}
                placeholder="Confirm new password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                disabled={submitting}
              />
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex h-[50px] w-full items-center justify-center gap-2 rounded-[14px] border border-[var(--accent)] bg-[var(--accent)] px-5 text-[1rem] font-semibold text-white transition hover:border-[var(--accent-strong)] hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-70 sm:h-[52px]"
              >
                {submitting ? (
                  <>
                    <LoaderCircle className="h-4 w-4 animate-spin" />
                    Saving
                  </>
                ) : (
                  "Set password"
                )}
              </button>
              {error && (
                <div role="alert" className="rounded-[16px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {error}
                </div>
              )}
            </form>
          )}

          {(status === "done" || status === "invalid") && (
            <a
              href="/signup"
              className="mt-7 inline-flex h-[50px] w-full items-center justify-center rounded-[14px] border border-[var(--accent)] bg-[var(--accent)] px-5 text-[1rem] font-semibold text-white transition hover:bg-[var(--accent-strong)] sm:h-[52px]"
            >
              Go to sign in
            </a>
          )}
        </section>
      </main>
    </div>
  );
}
