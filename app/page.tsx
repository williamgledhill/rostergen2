"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type Editor = { id: string; name: string; isAdmin?: boolean };
type Account = { id: string; name: string; company: string; editors: Editor[] };

export default function HomePage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccount, setSelectedAccount] = useState("");
  const [selectedEditor, setSelectedEditor] = useState("");
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
          if (firstEditor) setSelectedEditor(firstEditor.id);
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
    () => accounts.find((acct) => acct.id === selectedAccount) || accounts[0],
    [accounts, selectedAccount]
  );

  useEffect(() => {
    if (!activeAccount) return;
    if (!activeAccount.editors?.some((e) => e.id === selectedEditor)) {
      setSelectedEditor(activeAccount.editors?.[0]?.id || "");
    }
  }, [activeAccount, selectedEditor]);

  async function handleLogin() {
    setError("");
    if (!activeAccount || !selectedEditor) {
      setError("Pick an editor to continue.");
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
    } catch (err) {
      setError("Could not start a session. Please try again.");
    }
  }

  return (
    <div className="min-h-screen bg-white px-6 py-10">
      <div className="max-w-5xl mx-auto w-full">
        <div className="flex items-center justify-between mb-10">
          <div className="flex flex-col">
            <span className="text-sm uppercase tracking-[0.2em] text-slate-400">roster.app</span>
            <h1 className="text-3xl font-semibold text-slate-900">Welcome</h1>
            <p className="text-slate-600 text-[14px] max-w-lg">
              The current dataset belongs to the Mint account. Choose an editor to continue.
            </p>
          </div>
          <div className="hidden md:flex items-center gap-2 text-sm text-slate-500">
            <span>Need access?</span>
            <Link href="#" className="text-[#675dff] font-medium hover:underline">
              Contact admin
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white border border-[var(--border)] rounded-[12px] shadow-sm p-6 space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Login</h2>
              <p className="text-sm text-slate-600">No username or password required for now.</p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-semibold mb-1">Account</label>
                <select
                  className="input w-full text-[14px]"
                  value={activeAccount?.id || ""}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  disabled={loading || accounts.length === 0}
                >
                  {accounts.map((acct) => (
                    <option key={acct.id} value={acct.id}>
                      {acct.name} ({acct.company})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold mb-1">Editor</label>
                <select
                  className="input w-full text-[14px]"
                  value={selectedEditor}
                  onChange={(e) => setSelectedEditor(e.target.value)}
                  disabled={loading || !activeAccount}
                >
                  {(activeAccount?.editors || []).map((editor) => (
                    <option key={editor.id} value={editor.id}>
                      {editor.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {selectedEditor && activeAccount?.editors?.find((e) => e.id === selectedEditor)?.isAdmin && (
              <p className="text-xs text-slate-500">Admin access enabled for this editor.</p>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button className="btn btn-primary w-full" onClick={handleLogin} disabled={loading || !selectedEditor}>
              Continue to editor
            </button>
          </div>

          <div className="bg-white border border-dashed border-slate-300 rounded-[12px] p-6 space-y-4">
            <div>
              <h2 className="text-xl font-semibold">Sign up</h2>
              <p className="text-sm text-slate-600">Coming soon. This area is intentionally blank.</p>
            </div>
            <div className="space-y-3">
              <div className="h-10 rounded-md border border-slate-200 bg-slate-50" />
              <div className="h-10 rounded-md border border-slate-200 bg-slate-50" />
            </div>
            <button className="btn w-full" disabled>
              Sign up (soon)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
