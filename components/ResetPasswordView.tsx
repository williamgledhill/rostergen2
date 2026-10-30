"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import AuthLayout, { AuthAlert, authInputClass, authLabelClass, authPrimaryButtonClass } from "@/components/AuthLayout";

const MIN_PASSWORD_LENGTH = 12;

type Status = "checking" | "ready" | "invalid" | "done";

export default function ResetPasswordView() {
  const token = useSearchParams().get("token") ?? "";
  const [status, setStatus] = useState<Status>("checking");
  const [account, setAccount] = useState<{ name: string; email: string; invitation?: boolean } | null>(null);
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

  const invitation = Boolean(account?.invitation);
  const title =
    status === "done"
      ? invitation
        ? "You're all set"
        : "Password updated"
      : status === "invalid"
      ? "This link doesn't work"
      : invitation
      ? "Set up your account"
      : "Choose a new password";
  const description =
    status === "checking"
      ? "Checking your link…"
      : status === "ready" && account
      ? invitation
        ? `Welcome, ${account.name}. Choose a password for ${account.email} to finish setting up your account.`
        : `Setting a new password for ${account.name} (${account.email}).`
      : status === "invalid"
      ? error || "This reset link is invalid or has expired."
      : status === "done"
      ? invitation
        ? `Your account is ready. Sign in with ${account?.email ?? "your email"} and the password you just chose.`
        : "You've been signed out on every device. Sign in with your new password."
      : undefined;

  return (
    <AuthLayout title={title} description={description}>
      {status === "ready" && (
        <form className="space-y-4" onSubmit={submit} noValidate>
          <div>
            <label htmlFor="new-password" className={authLabelClass}>
              {invitation ? "Password" : "New password"}
            </label>
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              className={authInputClass}
              placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              disabled={submitting}
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className={authLabelClass}>
              {invitation ? "Confirm password" : "Confirm new password"}
            </label>
            <input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              className={authInputClass}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              disabled={submitting}
            />
          </div>
          {error && <AuthAlert tone="error">{error}</AuthAlert>}
          <button type="submit" disabled={submitting} className={authPrimaryButtonClass}>
            {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {submitting ? "Saving" : invitation ? "Create account" : "Set new password"}
          </button>
        </form>
      )}

      {status === "invalid" && (
        <p className="mb-5 text-[14px] text-[#5b6474]">Links work once. Invitations expire after 7 days and password resets after 24 hours. Ask an administrator for a new one.</p>
      )}

      {(status === "done" || status === "invalid") && (
        <a href="/signup" className={authPrimaryButtonClass}>
          Go to sign in
        </a>
      )}
    </AuthLayout>
  );
}
