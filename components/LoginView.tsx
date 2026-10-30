"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Eye, EyeOff, LoaderCircle, MailCheck } from "lucide-react";
import AuthLayout, {
  AuthAlert,
  authInputClass,
  authLabelClass,
  authPrimaryButtonClass,
} from "@/components/AuthLayout";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 12;

type Mode = "signin" | "request";

function ModeTabs({ mode, onChange, disabled }: { mode: Mode; onChange: (mode: Mode) => void; disabled: boolean }) {
  const tabs: { value: Mode; label: string }[] = [
    { value: "signin", label: "Sign in" },
    { value: "request", label: "Request access" },
  ];
  return (
    <div role="tablist" aria-label="Account" className="mb-6 grid grid-cols-2 rounded-[11px] bg-[#f1f3f6] p-1">
      {tabs.map((tab) => {
        const selected = tab.value === mode;
        return (
          <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={disabled}
            onClick={() => onChange(tab.value)}
            className={`h-9 rounded-[8px] text-[14px] font-medium transition ${
              selected ? "bg-white text-[#111827] shadow-[0_1px_3px_rgba(16,24,40,0.12)]" : "text-[#5b6474] hover:text-[#111827]"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function PasswordInput({
  id,
  value,
  onChange,
  autoComplete,
  disabled,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: string;
  disabled: boolean;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className={`${authInputClass} pr-11`}
      />
      <button
        type="button"
        aria-label={visible ? "Hide password" : "Show password"}
        onClick={() => setVisible((current) => !current)}
        className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-[#6b7280] transition hover:bg-black/5 hover:text-[#111827]"
      >
        {visible ? <EyeOff className="h-[17px] w-[17px]" /> : <Eye className="h-[17px] w-[17px]" />}
      </button>
    </div>
  );
}

export default function LoginView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [mode, setMode] = useState<Mode>(searchParams.get("mode") === "request" ? "request" : "signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [twoFactorName, setTwoFactorName] = useState("");
  const [error, setError] = useState("");
  const [requestSent, setRequestSent] = useState(false);
  const redirectTarget = (() => {
    const next = searchParams.get("next");
    return next && next.startsWith("/") && !next.startsWith("//") ? next : "/rosters";
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

  function switchMode(next: Mode) {
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

  async function handleTwoFactor() {
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
  }

  async function handleSignIn() {
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
      if (res.status === 401) throw new Error("That email and password don't match an account.");
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (isRequest) await handleRequest();
    else if (requiresTwoFactor) await handleTwoFactor();
    else await handleSignIn();
  }

  if (requiresTwoFactor && !isRequest) {
    return (
      <AuthLayout
        title="Two-step verification"
        description={`Enter the 6-digit code from the authenticator app for ${twoFactorName || "your account"}. A recovery code also works.`}
      >
        <form className="space-y-4" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="code" className={authLabelClass}>
              Verification code
            </label>
            <input
              id="code"
              type="text"
              autoComplete="one-time-code"
              inputMode="numeric"
              autoFocus
              value={code}
              onChange={(event) => setCode(event.target.value)}
              disabled={isDisabled}
              className={`${authInputClass} text-center text-[18px] tracking-[0.3em] placeholder:tracking-normal`}
              placeholder="123456"
            />
          </div>
          {error && <AuthAlert tone="error">{error}</AuthAlert>}
          <button type="submit" disabled={isDisabled} className={authPrimaryButtonClass}>
            {submitting && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {submitting ? "Verifying" : "Verify and sign in"}
          </button>
          <button
            type="button"
            onClick={() => switchMode("signin")}
            className="inline-flex w-full items-center justify-center gap-1.5 text-[14px] font-medium text-[#5b6474] transition hover:text-[#111827]"
          >
            <ArrowLeft className="h-4 w-4" />
            Use a different account
          </button>
        </form>
      </AuthLayout>
    );
  }

  if (isRequest && requestSent) {
    return (
      <AuthLayout title="Request sent">
        <div className="space-y-5">
          <div className="flex gap-3 rounded-[12px] border border-[#e2e6ec] bg-[#f8f9fb] p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[var(--success-soft)] text-[var(--success)]">
              <MailCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <p className="text-[14px] leading-6 text-[#374151]">
              An administrator will review your request. Once it&apos;s approved, sign in with{" "}
              <span className="font-medium text-[#111827]">{email.trim().toLowerCase()}</span> and the password you chose.
            </p>
          </div>
          <button type="button" onClick={() => switchMode("signin")} className={authPrimaryButtonClass}>
            Back to sign in
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={isRequest ? "Request access" : "Welcome back"}
      description={
        isRequest
          ? "Tell us who you are. An administrator approves new accounts before they can sign in."
          : "Sign in to plan and edit your rosters."
      }
    >
      <ModeTabs mode={mode} onChange={switchMode} disabled={submitting} />

      <form className="space-y-4" onSubmit={handleSubmit} noValidate>
        {isRequest && (
          <div>
            <label htmlFor="name" className={authLabelClass}>
              Full name
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              disabled={isDisabled}
              className={authInputClass}
              placeholder="Alex Smith"
            />
          </div>
        )}

        <div>
          <label htmlFor="email" className={authLabelClass}>
            {isRequest ? "Work email" : "Email"}
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={isDisabled}
            className={authInputClass}
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label htmlFor="password" className={authLabelClass}>
            Password
          </label>
          <PasswordInput
            id="password"
            value={password}
            onChange={setPassword}
            autoComplete={isRequest ? "new-password" : "current-password"}
            disabled={isDisabled}
            placeholder={isRequest ? `At least ${MIN_PASSWORD_LENGTH} characters` : undefined}
          />
          {!isRequest && (
            <p className="mt-1.5 text-[13px] text-[#6b7280]">Forgot it? Ask an administrator for a reset link.</p>
          )}
        </div>

        {error && <AuthAlert tone="error">{error}</AuthAlert>}

        <button type="submit" disabled={isDisabled} className={authPrimaryButtonClass}>
          {(submitting || loading) && <LoaderCircle className="h-4 w-4 animate-spin" />}
          {submitting ? (isRequest ? "Sending request" : "Signing in") : isRequest ? "Send request" : "Sign in"}
        </button>
      </form>
    </AuthLayout>
  );
}
