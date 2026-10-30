"use client";

import React, { useEffect, useState } from "react";
import { Copy, LoaderCircle, ShieldCheck } from "lucide-react";
import AuthLayout, { AuthAlert, authInputClass, authLabelClass, authPrimaryButtonClass } from "@/components/AuthLayout";

type Setup = { secret: string; otpauthUri: string; qrCodeDataUrl: string };

async function postJson(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Request failed");
  return data;
}

/**
 * Shown straight after sign-in to anyone without two-factor authentication.
 * The rest of the app stays locked until it's set up.
 */
export default function TwoFactorSetupView({ name, next }: { name: string; next: string }) {
  const [setup, setSetup] = useState<Setup | null>(null);
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    postJson("/api/auth/mfa/setup")
      .then((data) => setSetup({ secret: data.secret, otpauthUri: data.otpauthUri, qrCodeDataUrl: data.qrCodeDataUrl }))
      .catch((err) => setError(err instanceof Error ? err.message : "Could not start setup."));
  }, []);

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Enter the 6-digit code your authenticator app shows.");
      return;
    }
    setBusy(true);
    try {
      const data = await postJson("/api/auth/mfa/verify", { code: code.trim() });
      setRecoveryCodes(Array.isArray(data?.recoveryCodes) ? data.recoveryCodes : []);
    } catch (err) {
      setError(err instanceof Error && err.message !== "Invalid verification code" ? err.message : "That code didn't match. Check the time on your phone and try the newest code.");
    } finally {
      setBusy(false);
    }
  }

  async function signOut() {
    await fetch("/api/auth/session", { method: "DELETE" }).catch(() => undefined);
    window.location.href = "/signup";
  }

  if (recoveryCodes.length > 0) {
    return (
      <AuthLayout
        title="Save your recovery codes"
        description="If you lose your phone, each of these codes lets you sign in once. They won't be shown again."
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 rounded-[12px] border border-[#e2e6ec] bg-[#f8f9fb] p-4">
            {recoveryCodes.map((recoveryCode) => (
              <code key={recoveryCode} className="rounded-[6px] bg-white px-2.5 py-1.5 text-center font-mono text-[13px]">
                {recoveryCode}
              </code>
            ))}
          </div>
          <button
            type="button"
            className="inline-flex w-full items-center justify-center gap-2 rounded-[10px] border border-[#d6dbe4] bg-white px-4 py-2.5 text-[14px] font-medium text-[#111827] transition hover:bg-[#f8f9fb]"
            onClick={() => {
              void navigator.clipboard?.writeText(recoveryCodes.join("\n"));
              setCopied(true);
            }}
          >
            <Copy className="h-4 w-4" aria-hidden="true" />
            {copied ? "Copied" : "Copy codes"}
          </button>
          <p className="text-[13px] text-[#5b6474]">Keep them somewhere safe, like a password manager.</p>
          <button type="button" className={authPrimaryButtonClass} onClick={() => (window.location.href = next)}>
            I&apos;ve saved them, continue
          </button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Set up two-factor authentication"
      description={`Hi ${name}. Every account needs an authenticator app as a second step when signing in. This takes about a minute.`}
    >
      {!setup && !error && (
        <p className="flex items-center gap-2 text-[14px] text-[#5b6474]">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          Preparing your code…
        </p>
      )}

      {setup && (
        <form className="space-y-5" onSubmit={verify} noValidate>
          <div>
            <p className="text-[14px] font-medium text-[#111827]">1. Scan this with your authenticator app</p>
            <p className="mt-1 text-[13px] text-[#5b6474]">
              Google Authenticator, Microsoft Authenticator or 1Password. It will appear as Roster Generator.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={setup.qrCodeDataUrl}
                alt="QR code for adding Roster Generator to an authenticator app"
                width={168}
                height={168}
                className="rounded-[10px] border border-[#e2e6ec] bg-white p-1"
              />
              <a
                href={setup.otpauthUri}
                className="inline-flex items-center rounded-[10px] border border-[#d6dbe4] px-3 py-2 text-[13px] font-medium text-[#111827] md:hidden"
              >
                Open in authenticator app
              </a>
            </div>
            <details className="mt-3 text-[13px] text-[#5b6474]">
              <summary className="cursor-pointer font-medium text-[var(--accent)]">Can&apos;t scan it?</summary>
              <p className="mt-2">Add an account named Roster Generator and enter this key:</p>
              <code className="mt-1.5 block break-all rounded-[8px] bg-[#f1f3f6] px-3 py-2 font-mono text-[13px] tracking-wider text-[#111827]">
                {setup.secret.match(/.{1,4}/g)?.join(" ")}
              </code>
            </details>
          </div>

          <div>
            <label htmlFor="setup-code" className={authLabelClass}>
              2. Enter the 6-digit code it shows
            </label>
            <input
              id="setup-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
              disabled={busy}
              className={`${authInputClass} text-center text-[18px] tracking-[0.3em] placeholder:tracking-normal`}
              placeholder="123456"
            />
          </div>

          {error && <AuthAlert tone="error">{error}</AuthAlert>}

          <button type="submit" disabled={busy} className={authPrimaryButtonClass}>
            {busy ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" aria-hidden="true" />}
            {busy ? "Checking" : "Turn on two-factor"}
          </button>
        </form>
      )}

      {!setup && error && <AuthAlert tone="error">{error}</AuthAlert>}

      <button
        type="button"
        onClick={() => void signOut()}
        className="mt-5 w-full text-center text-[14px] font-medium text-[#5b6474] transition hover:text-[#111827]"
      >
        Sign out
      </button>
    </AuthLayout>
  );
}
