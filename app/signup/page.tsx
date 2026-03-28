"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck2,
  ClipboardCheck,
  FolderOpen,
  Mail,
  MessageSquare,
  ShieldCheck,
  UserCircle2,
} from "lucide-react";
import { Poppins } from "next/font/google";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
  const [selectedAccount, setSelectedAccount] = useState("");
  const [selectedEditor, setSelectedEditor] = useState("");
  const [email, setEmail] = useState("");
  const [flowStep, setFlowStep] = useState<FlowStep>("email");
  const [loading, setLoading] = useState(true);
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
    <div className={`${poppins.className} min-h-screen bg-[#f2f2f4]`}>
      <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
        <section className="relative isolate overflow-hidden bg-[linear-gradient(180deg,#3839e9_0%,#2a2ca9_58%,#1f227f_100%)] text-white">
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute -left-28 top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute right-[-110px] top-1/3 h-80 w-80 rounded-full bg-[#7685ff]/20 blur-3xl" />
            <div className="absolute bottom-[-140px] left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-[#a2b0ff]/15 blur-3xl" />
          </div>

          <div className="relative mx-auto flex h-full w-full max-w-[720px] flex-col px-8 py-10 sm:px-12 sm:py-12">
            <div className="flex items-center gap-3 text-white">
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/14 shadow-lg ring-1 ring-white/35 backdrop-blur-sm">
                <ClipboardCheck className="h-7 w-7" strokeWidth={2.2} />
              </div>
              <span className="text-[2.6rem] font-semibold tracking-tight">Roster Planner</span>
            </div>

            <div className="relative mx-auto flex w-full max-w-[460px] flex-1 items-center justify-center">
              <div className="absolute left-[50%] top-[53%] h-36 w-72 -translate-x-1/2 -translate-y-1/2 rounded-[22px] border border-white/15 bg-[#3947cf]/45 stack-shadow" />
              <div className="absolute left-[50%] top-[47%] h-36 w-72 -translate-x-1/2 -translate-y-1/2 rounded-[22px] border border-white/15 bg-[#7788ff]/45 stack-shadow" />
              <div className="absolute left-[50%] top-[41%] h-36 w-72 -translate-x-1/2 -translate-y-1/2 rounded-[22px] border border-white/20 bg-[#9aa8ff]/45 stack-shadow" />

              <div className="rise-in absolute left-[50%] top-[29%] flex h-44 w-56 -translate-x-1/2 -translate-y-1/2 flex-col rounded-[28px] border border-white/25 bg-[#4d58f1]/80 p-5 shadow-2xl backdrop-blur-sm">
                <div className="flex items-center justify-between text-white/90">
                  <UserCircle2 className="h-8 w-8" />
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div className="mt-6 h-3 w-24 rounded-full bg-white/35" />
                <div className="mt-3 h-3 w-16 rounded-full bg-white/30" />
                <div className="mt-5 flex h-12 items-center justify-center rounded-xl bg-white/80 text-[#3d49d4] shadow">
                  <ClipboardCheck className="h-8 w-8" />
                </div>
              </div>

              <div className="float-slow absolute left-10 top-28 grid h-11 w-11 place-items-center rounded-xl bg-[#f95b72] text-white shadow-lg">
                <CalendarCheck2 className="h-5 w-5" />
              </div>
              <div className="float-fast absolute right-9 top-24 grid h-11 w-11 place-items-center rounded-xl bg-[#8f84ff] text-white shadow-lg">
                <MessageSquare className="h-5 w-5" />
              </div>
              <div className="float-slow absolute right-14 top-[52%] grid h-11 w-11 place-items-center rounded-xl bg-[#ff8f2f] text-white shadow-lg">
                <FolderOpen className="h-5 w-5" />
              </div>
            </div>

            <div className="pb-5 text-center">
              <h2 className="text-[2.85rem] font-semibold tracking-tight">Run smoother shifts.</h2>
              <p className="mx-auto mt-3 max-w-[550px] text-lg text-white/90">
                Built to save planning time and keep every handover clear.
              </p>
            </div>
          </div>
        </section>

        <section className="flex items-center justify-center px-6 py-12 sm:px-10">
          <div className="w-full max-w-[390px]">
            <h1 className="text-[3rem] font-semibold leading-[1.12] tracking-tight text-[#0f172a]">Log in to Roster Planner</h1>

            <div className="mt-10 space-y-5">
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
                      className="h-14 w-full rounded-[4px] border border-[#e6e6e6] border-b-[#ea6a7b] bg-[#e9e9ea] px-3 pb-1 pt-5 pr-12 text-[15px] text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] outline-none transition focus:border-[#6074ff] focus:ring-2 focus:ring-[#6074ff]/20"
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
                            className="flex w-full items-center justify-between rounded-[8px] border border-slate-200 bg-white px-3 py-2 text-left transition hover:border-[#8e9af8] hover:bg-[#f7f8ff] disabled:cursor-not-allowed disabled:opacity-60"
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

                  <button
                    type="submit"
                    disabled={loading}
                    className="mx-auto flex h-11 w-[182px] items-center justify-center gap-2 rounded-[4px] border border-[#4f58ef] bg-[#4f58ef] px-4 text-[1.05rem] font-semibold text-white shadow-[0_6px_14px_rgba(71,84,232,0.32)] transition hover:bg-[#434cdf] disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <ArrowRight className="h-[18px] w-[18px]" />
                    Let&apos;s Go
                  </button>
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
                      className="btn h-11 min-w-[110px]"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </button>

                    <button
                      type="submit"
                      disabled={loading || !selectedEditor}
                      className="flex h-11 flex-1 items-center justify-center gap-2 rounded-[4px] border border-[#4f58ef] bg-[#4f58ef] px-4 text-sm font-semibold text-white shadow-[0_6px_14px_rgba(71,84,232,0.32)] transition hover:bg-[#434cdf] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      Continue to editor
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </form>
              )}

              {!loading && accounts.length === 0 && (
                <p className="text-sm text-rose-600">No accounts are available in this environment.</p>
              )}

              {error && <p className="text-sm text-rose-600">{error}</p>}
            </div>
          </div>
        </section>
      </div>

      <style jsx>{`
        .stack-shadow {
          box-shadow: 0 18px 32px rgba(12, 21, 88, 0.33);
        }

        .rise-in {
          animation: riseIn 650ms cubic-bezier(0.22, 1, 0.36, 1);
        }

        .float-slow {
          animation: floatSlow 6.8s ease-in-out infinite;
        }

        .float-fast {
          animation: floatFast 4.6s ease-in-out infinite;
        }

        @keyframes riseIn {
          from {
            opacity: 0;
            transform: translate(-50%, -46%);
          }
          to {
            opacity: 1;
            transform: translate(-50%, -50%);
          }
        }

        @keyframes floatSlow {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        @keyframes floatFast {
          0%,
          100% {
            transform: translateY(-3px);
          }
          50% {
            transform: translateY(9px);
          }
        }

        @media (max-width: 1023px) {
          section:first-child {
            min-height: 46vh;
          }
        }
      `}</style>
    </div>
  );
}
