"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Mail } from "lucide-react";

type Editor = { id: string; name: string; isAdmin?: boolean };
type Account = { id: string; name: string; company: string; editors: Editor[] };
type FlowStep = "email" | "picker";
type QuickLoginOption = {
  accountId: string;
  editorId: string;
  editorName: string;
  accountLabel: string;
  email: string;
};

type VariantKey = "v1" | "v2" | "v3";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VARIANTS: VariantKey[] = ["v1", "v2", "v3"];

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

function variantClasses(variant: VariantKey) {
  if (variant === "v2") {
    return {
      page: "min-h-screen bg-white px-4 py-8 sm:px-6",
      card: "mx-auto w-full max-w-[620px]",
      titleWrap: "text-left",
      title: "text-[2rem] font-semibold leading-[1.1] text-[#0f172a]",
      subtitle: "mt-2 text-sm text-[#64748b]",
      primary: "w-full sm:w-[200px] h-11 rounded-[8px] border border-[#4653ea] bg-[#4653ea] text-[0.98rem] font-semibold text-white transition hover:bg-[#3e4ad6] disabled:cursor-not-allowed disabled:opacity-70",
      secondary: "inline-flex h-11 min-w-[110px] items-center justify-center rounded-[8px] border border-[#c8d1e3] bg-white px-4 text-sm font-semibold text-[#1f2937] transition hover:bg-[#f8fafc]",
      textBtn: "inline-flex items-center gap-1.5 text-sm font-medium text-[#52607a] transition hover:text-[#2f3a52]",
      quickOption: "flex w-full items-center justify-between rounded-[8px] border border-[#d8e0ef] bg-white px-3 py-2 text-left transition hover:border-[#a9b9da] hover:bg-[#f7f9ff] disabled:cursor-not-allowed disabled:opacity-60",
      emailInput: "h-14 w-full rounded-[8px] border border-[#d7dfeb] bg-white px-3 pb-1 pt-5 pr-12 text-[15px] text-slate-900 outline-none transition focus:border-[#6074ff] focus:ring-2 focus:ring-[#6074ff]/20",
    };
  }

  if (variant === "v3") {
    return {
      page: "min-h-screen bg-white px-4 py-8 sm:px-6",
      card: "mx-auto w-full max-w-[560px]",
      titleWrap: "text-center",
      title: "text-[2.1rem] font-bold leading-[1.08] text-[#0f172a]",
      subtitle: "mt-2 text-sm text-[#52607a]",
      primary: "w-full sm:w-[200px] h-11 rounded-[6px] border border-[#111827] bg-[#111827] text-[0.98rem] font-semibold text-white transition hover:bg-[#1f2937] disabled:cursor-not-allowed disabled:opacity-70",
      secondary: "inline-flex h-11 min-w-[110px] items-center justify-center rounded-[6px] border border-[#cdd5e2] bg-white px-4 text-sm font-semibold text-[#1f2937] transition hover:bg-[#f8fafc]",
      textBtn: "inline-flex items-center gap-1.5 text-sm font-medium text-[#41506b] transition hover:text-[#1f2937]",
      quickOption: "flex w-full items-center justify-between rounded-[6px] border border-[#d5dceb] bg-white px-3 py-2 text-left transition hover:border-[#8fa2c7] hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-60",
      emailInput: "h-14 w-full rounded-[6px] border border-[#d2d9e7] bg-white px-3 pb-1 pt-5 pr-12 text-[15px] text-slate-900 outline-none transition focus:border-[#111827] focus:ring-2 focus:ring-[#111827]/10",
    };
  }

  return {
    page: "min-h-screen bg-white px-4 py-8 sm:px-6",
    card: "mx-auto w-full max-w-[560px]",
    titleWrap: "text-center",
    title: "text-[2.2rem] font-semibold leading-[1.12] text-[#0f172a]",
    subtitle: "mt-2 text-sm text-[#64748b]",
    primary: "w-full sm:w-[200px] h-11 rounded-[6px] border border-[#4f58ef] bg-[#4f58ef] text-[0.98rem] font-semibold text-white transition hover:bg-[#434bd7] disabled:cursor-not-allowed disabled:opacity-70",
    secondary: "inline-flex h-11 min-w-[110px] items-center justify-center rounded-[6px] border border-[#c8d1e3] bg-white px-4 text-sm font-semibold text-[#1f2937] transition hover:bg-[#f8fafc]",
    textBtn: "inline-flex items-center gap-1.5 text-sm font-medium text-[#52607a] transition hover:text-[#2f3a52]",
    quickOption: "flex w-full items-center justify-between rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-[#8e9af8] hover:bg-[#f7f8ff] disabled:cursor-not-allowed disabled:opacity-60",
    emailInput: "h-14 w-full rounded-[6px] border border-[#d7dfeb] bg-white px-3 pb-1 pt-5 pr-12 text-[15px] text-slate-900 outline-none transition focus:border-[#6074ff] focus:ring-2 focus:ring-[#6074ff]/20",
  };
}

export default function SignupPage() {
  const router = useRouter();
  const [currentVariant, setCurrentVariant] = useState<VariantKey>("v1");
  const classes = variantClasses(currentVariant);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [selectedEditor, setSelectedEditor] = useState("");
  const [email, setEmail] = useState("");
  const [flowStep, setFlowStep] = useState<FlowStep>("email");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("v") as VariantKey | null;
    if (raw && VARIANTS.includes(raw)) {
      setCurrentVariant(raw);
    }
  }, []);

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
    let active = true;
    fetch("/api/auth/accounts")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!active) return;
        const list = Array.isArray(data) ? data : [];
        setAccounts(list);
        const firstAccount = list[0];
        if (firstAccount) {
          setSelectedAccount(firstAccount.id);
          const firstEditor = firstAccount.editors?.[0];
          if (firstEditor) {
            setSelectedEditor(firstEditor.id);
            setEmail((current) => current || defaultEmailForEditor(firstEditor));
          }
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const activeAccount = useMemo(
    () => accounts.find((account) => account.id === selectedAccount) || accounts[0],
    [accounts, selectedAccount]
  );

  const activeEditor = useMemo(
    () => activeAccount?.editors?.find((editor) => editor.id === selectedEditor) || null,
    [activeAccount, selectedEditor]
  );

  const quickLoginOptions = useMemo<QuickLoginOption[]>(
    () =>
      accounts
        .flatMap((account) =>
          (account.editors || []).map((editor) => ({
            accountId: account.id,
            editorId: editor.id,
            editorName: editor.name,
            accountLabel: `${account.name} (${account.company})`,
            email: defaultEmailForEditor(editor),
          }))
        )
        .slice(0, 5),
    [accounts]
  );

  useEffect(() => {
    if (!activeAccount) return;
    if (!activeAccount.editors?.some((editor) => editor.id === selectedEditor)) {
      setSelectedEditor(activeAccount.editors?.[0]?.id || "");
    }
  }, [activeAccount, selectedEditor]);

  function switchVariant(next: VariantKey) {
    setCurrentVariant(next);
    router.replace(`/signup?v=${next}`);
  }

  function handleBeginFlow(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const trimmed = email.trim();
    if (!trimmed) {
      setError("Enter your email to continue.");
      return;
    }
    if (!EMAIL_REGEX.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }

    setEmail(trimmed);
    setFlowStep("picker");
  }

  function handleApplyQuickOption(option: QuickLoginOption) {
    setError("");
    setEmail(option.email);
    setSelectedAccount(option.accountId);
    setSelectedEditor(option.editorId);
    setFlowStep("picker");
  }

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!activeAccount || !selectedEditor) {
      setError("Select an account and editor to continue.");
      return;
    }

    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: activeAccount.id, editorId: selectedEditor }),
      });

      if (!res.ok) throw new Error("Login failed");
      router.push("/editor");
    } catch {
      setError("Could not start a session. Please try again.");
    }
  }

  return (
    <div className={classes.page}>
      <div className="mx-auto mb-4 flex w-full max-w-[560px] justify-end gap-2">
        {VARIANTS.map((variant) => (
          <button
            key={variant}
            type="button"
            onClick={() => switchVariant(variant)}
            className={`rounded-md border px-3 py-1 text-xs font-semibold ${
              currentVariant === variant
                ? "border-[#4f58ef] bg-[#eef1ff] text-[#3443d6]"
                : "border-[#d3dae8] bg-white text-[#5a6880]"
            }`}
          >
            {variant.toUpperCase()}
          </button>
        ))}
      </div>

      <section className={classes.card}>
        <button
          type="button"
          onClick={() => router.push("/")}
          className={classes.textBtn}
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <div className={`mt-4 ${classes.titleWrap}`}>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#64748b]">Roster Planner</p>
          <h1 className={`mt-3 ${classes.title}`}>Welcome back</h1>
          <p className={classes.subtitle}>Log in to continue</p>
        </div>

        <div className="mt-8">
          {flowStep === "email" ? (
            <form className="space-y-5" onSubmit={handleBeginFlow}>
              <div className="relative">
                <label htmlFor="email" className="pointer-events-none absolute left-3 top-2 text-[11px] font-semibold tracking-[0.02em] text-[#f16f80]">
                  Email*
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  disabled={loading}
                  className={classes.emailInput}
                />
                <Mail className="pointer-events-none absolute right-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-500" />
              </div>

              {quickLoginOptions.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">Quick autofill options</p>
                  <div className="grid gap-2">
                    {quickLoginOptions.map((option) => (
                      <button
                        key={`${option.accountId}:${option.editorId}`}
                        type="button"
                        disabled={loading}
                        onClick={() => handleApplyQuickOption(option)}
                        className={classes.quickOption}
                      >
                        <span className="min-w-0 pr-2">
                          <span className="block truncate text-[13px] font-semibold text-slate-800">{option.editorName}</span>
                          <span className="block truncate text-[11px] text-slate-500">{option.accountLabel}</span>
                        </span>
                        <span className="truncate text-[11px] font-medium text-[#4d58f1]">{option.email}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-center sm:justify-start">
                <button type="submit" disabled={loading} className={classes.primary}>
                  Continue
                </button>
              </div>
            </form>
          ) : (
            <form className="space-y-4" onSubmit={handleLogin}>
              <div className="rounded-[10px] border border-slate-200 bg-white px-3 py-2">
                <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">Email</p>
                <p className="truncate text-sm font-medium text-slate-700">{email}</p>
              </div>

              <div className="space-y-1">
                <label htmlFor="account" className="text-sm font-semibold text-slate-700">
                  Account
                </label>
                <select
                  id="account"
                  className="input h-11 w-full text-sm"
                  value={activeAccount?.id || ""}
                  onChange={(event) => setSelectedAccount(event.target.value)}
                  disabled={loading || accounts.length === 0}
                >
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.company})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="editor" className="text-sm font-semibold text-slate-700">
                  Editor
                </label>
                <select
                  id="editor"
                  className="input h-11 w-full text-sm"
                  value={selectedEditor}
                  onChange={(event) => setSelectedEditor(event.target.value)}
                  disabled={loading || !activeAccount}
                >
                  {(activeAccount?.editors || []).map((editor) => (
                    <option key={editor.id} value={editor.id}>
                      {editor.name}
                    </option>
                  ))}
                </select>
              </div>

              {activeEditor?.isAdmin && (
                <p className="text-xs text-slate-500">Admin access is enabled for this editor.</p>
              )}

              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setFlowStep("email");
                  }}
                  className={classes.secondary}
                >
                  Back
                </button>

                <button type="submit" disabled={loading || !selectedEditor} className={`flex h-11 flex-1 items-center justify-center ${classes.secondary}`}>
                  Log in
                </button>
              </div>
            </form>
          )}

          {!loading && accounts.length === 0 && (
            <p className="text-sm text-rose-600">No accounts are available in this environment.</p>
          )}

          {error && <p className="text-sm text-rose-600">{error}</p>}
        </div>
      </section>
    </div>
  );
}
