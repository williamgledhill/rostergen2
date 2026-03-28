"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Mail } from "lucide-react";

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
    <div className="min-h-screen bg-white px-4 py-10 sm:px-6">
      <section className="mx-auto w-full max-w-[560px]">
        <div className="text-center">
          <h1 className="text-[2.1rem] font-semibold leading-[1.12] text-[#0f172a]">
            Login to Roster Generator
          </h1>
        </div>

        <form className="mt-10 space-y-6" onSubmit={handleLogin}>
          <div className="space-y-2">
            <label
              htmlFor="email"
              className="block text-sm font-bold uppercase tracking-[0.08em] text-[#0f172a]"
            >
              Email
            </label>
            <div className="relative">
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={loading || submitting}
                className="h-12 w-full rounded-[6px] border border-[#d7dfeb] bg-white px-3 pr-10 text-[15px] text-slate-900 outline-none transition focus:border-[#6074ff] focus:ring-2 focus:ring-[#6074ff]/20"
              />
              <Mail className="pointer-events-none absolute right-3 top-1/2 h-[17px] w-[17px] -translate-y-1/2 text-slate-500" />
            </div>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="block text-sm font-bold uppercase tracking-[0.08em] text-[#0f172a]"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                disabled={loading || submitting}
                className="h-12 w-full rounded-[6px] border border-[#d7dfeb] bg-white px-3 pr-10 text-[15px] text-slate-900 outline-none transition focus:border-[#6074ff] focus:ring-2 focus:ring-[#6074ff]/20"
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
              >
                {showPassword ? (
                  <EyeOff className="h-[17px] w-[17px]" />
                ) : (
                  <Eye className="h-[17px] w-[17px]" />
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || submitting}
            className="h-12 w-full rounded-[6px] border border-[#4f58ef] bg-[#4f58ef] text-[1rem] font-semibold text-white transition hover:bg-[#434bd7] disabled:cursor-not-allowed disabled:opacity-70"
          >
            Continue
          </button>

          {!loading && accounts.length === 0 && (
            <p className="text-sm text-rose-600">
              No accounts are available in this environment.
            </p>
          )}
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </form>
      </section>
    </div>
  );
}
