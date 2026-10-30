"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Check, Copy, Save, ShieldCheck, X } from "lucide-react";
import { useFeedback } from "@/components/ui/Feedback";
import PageHeader from "@/components/ui/PageHeader";
import SaveStatus from "@/components/ui/SaveStatus";
import type { AccountRequest, AuthUser } from "@/lib/auth";
import { buildDraftStorageKey } from "@/lib/clientDrafts";
import { AppSettings, DAY_KEYS, DAY_LABELS, DEFAULT_SETTINGS, type DayKey } from "@/lib/settingsDefaults";
import { usePersistedAutosave } from "@/lib/usePersistedAutosave";
import { invalidateWorkspaceResource, settingsDataKey, writeCachedResource, type MfaStatus } from "@/lib/workspaceData";

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

function SecuritySection({ user, initialStatus }: { user: AuthUser; initialStatus: MfaStatus }) {
  const { notify } = useFeedback();
  const [status, setStatus] = useState(initialStatus);
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const beginSetup = () =>
    run(async () => {
      setRecoveryCodes([]);
      const data = await postJson("/api/auth/mfa/setup");
      setSecret(data.secret || "");
      setStatus((prev) => ({ ...prev, setupPending: true, setupExpiresAt: data.expiresAt || null }));
    });

  const verifySetup = (event: React.FormEvent) => {
    event.preventDefault();
    return run(async () => {
      if (!code.trim()) throw new Error("Enter the 6-digit code from your authenticator app.");
      const data = await postJson("/api/auth/mfa/verify", { code: code.trim() });
      setRecoveryCodes(Array.isArray(data?.recoveryCodes) ? data.recoveryCodes : []);
      setSecret("");
      setCode("");
      setStatus({ enabled: true, setupPending: false, setupExpiresAt: null });
      notify({ tone: "success", title: "Two-factor authentication is on" });
    });
  };

  const disable = (event: React.FormEvent) => {
    event.preventDefault();
    return run(async () => {
      if (!disablePassword || !disableCode.trim()) {
        throw new Error("Enter your password and a current authenticator or recovery code.");
      }
      await postJson("/api/auth/mfa/disable", { password: disablePassword, code: disableCode.trim() });
      setDisablePassword("");
      setDisableCode("");
      setRecoveryCodes([]);
      setStatus({ enabled: false, setupPending: false, setupExpiresAt: null });
      notify({ tone: "success", title: "Two-factor authentication is off" });
    });
  };

  return (
    <section id="security" className="card scroll-mt-20">
      <div className="card-header">
        <div>
          <h2 className="card-title">Two-factor authentication</h2>
          <p className="card-description">
            Signed in as {user.name} ({user.email}). Protect this account with an authenticator app.
          </p>
        </div>
        {status.enabled ? (
          <span className="badge badge-success">
            <ShieldCheck className="h-3.5 w-3.5" />
            On
          </span>
        ) : (
          <span className="badge">Off</span>
        )}
      </div>

      <div className="space-y-4 p-5 text-[14px]">
        {!status.enabled && !status.setupPending && (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={beginSetup}>
            {busy ? "Starting…" : "Set up authenticator app"}
          </button>
        )}

        {!status.enabled && status.setupPending && (
          <form className="space-y-4" onSubmit={verifySetup}>
            <div>
              <p className="font-medium">1. Add this key to your authenticator app</p>
              {secret ? (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <code className="rounded-[var(--radius-md)] bg-[var(--surface-muted)] px-3 py-2 font-mono text-[14px] tracking-wider">
                    {secret.match(/.{1,4}/g)?.join(" ")}
                  </code>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      void navigator.clipboard?.writeText(secret);
                      notify({ tone: "success", title: "Key copied" });
                    }}
                  >
                    <Copy />
                    Copy
                  </button>
                </div>
              ) : (
                <p className="mt-1 text-[var(--text-muted)]">
                  Setup was started earlier.{" "}
                  <button type="button" className="font-medium text-[var(--accent)] hover:underline" onClick={beginSetup}>
                    Show a new key
                  </button>
                </p>
              )}
            </div>
            <div>
              <label className="font-medium" htmlFor="mfa-code">
                2. Enter the 6-digit code it shows
              </label>
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  id="mfa-code"
                  className="input w-[160px] tracking-[0.2em]"
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="123456"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {busy ? "Checking…" : "Turn on"}
                </button>
              </div>
            </div>
          </form>
        )}

        {status.enabled && (
          <form className="space-y-3" onSubmit={disable}>
            <p className="text-[var(--text-muted)]">
              To turn it off, confirm your password and enter a current authenticator code or an unused recovery code.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                type="password"
                className="input"
                placeholder="Current password"
                autoComplete="current-password"
                value={disablePassword}
                onChange={(event) => setDisablePassword(event.target.value)}
              />
              <input
                className="input"
                placeholder="Authenticator or recovery code"
                autoComplete="one-time-code"
                value={disableCode}
                onChange={(event) => setDisableCode(event.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-danger" disabled={busy}>
              Turn off two-factor
            </button>
          </form>
        )}

        {recoveryCodes.length > 0 && (
          <div className="rounded-[var(--radius-md)] border border-amber-300 bg-[var(--warning-soft)] p-4">
            <p className="font-medium text-amber-900">Save your recovery codes</p>
            <p className="mt-0.5 text-[13px] text-amber-900">
              Each code works once if you lose your phone. They won&apos;t be shown again.
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {recoveryCodes.map((recoveryCode) => (
                <code key={recoveryCode} className="rounded bg-white px-3 py-1.5 font-mono text-[13px]">
                  {recoveryCode}
                </code>
              ))}
            </div>
          </div>
        )}

        {error && (
          <p className="text-[13px] text-[var(--danger)]" role="alert">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}

function AccountRequestsSection() {
  const { notify } = useFeedback();
  const [requests, setRequests] = useState<AccountRequest[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/users/requests")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Could not load account requests.");
        setRequests(Array.isArray(data?.requests) ? data.requests : []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load account requests."));
  }, []);

  async function decide(request: AccountRequest, approve: boolean) {
    setBusyId(request.id);
    setError("");
    try {
      const res = await fetch(`/api/users/requests/${encodeURIComponent(request.id)}`, {
        method: approve ? "POST" : "DELETE",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Request failed");
      setRequests((prev) => (prev ?? []).filter((item) => item.id !== request.id));
      notify({ tone: "success", title: approve ? `${request.name} can now sign in` : "Request rejected" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section id="account-requests" className="card scroll-mt-20">
      <div className="card-header">
        <div>
          <h2 className="card-title">Account requests</h2>
          <p className="card-description">
            People who asked for access from the sign-in page. Approved accounts can edit rosters.
          </p>
        </div>
        {requests && requests.length > 0 && <span className="badge">{requests.length}</span>}
      </div>

      {requests === null && !error && <p className="p-5 text-[14px] text-[var(--text-muted)]">Loading…</p>}
      {requests && requests.length === 0 && (
        <p className="p-5 text-[14px] text-[var(--text-muted)]">No requests waiting.</p>
      )}
      {requests && requests.length > 0 && (
        <ul className="divide-y divide-[var(--border)]">
          {requests.map((request) => (
            <li key={request.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 text-[14px]">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{request.name}</p>
                <p className="truncate text-[13px] text-[var(--text-muted)]">
                  {request.email} · requested {new Date(request.createdAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-sm btn-primary"
                  disabled={busyId !== null}
                  onClick={() => void decide(request, true)}
                >
                  <Check />
                  Approve
                </button>
                <button
                  type="button"
                  className="btn btn-sm"
                  disabled={busyId !== null}
                  onClick={() => void decide(request, false)}
                >
                  <X />
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="px-5 pb-4 text-[13px] text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

export default function SettingsClient({
  initialSettings,
  initialSessionUser,
  initialMfaStatus,
}: {
  initialSettings: AppSettings;
  initialSessionUser: AuthUser;
  initialMfaStatus: MfaStatus;
}) {
  const isAdmin = initialSessionUser.role === "ADMIN";
  const { value: settings, setValue: setSettings, saveState, saveNow } = usePersistedAutosave<AppSettings>({
    storageKey: buildDraftStorageKey("settings", "app"),
    initialValue: initialSettings,
    getSignature: (value) => JSON.stringify(value),
    canSave: isAdmin,
    canSaveValue: (value) => DAY_KEYS.every((day) => value.hoursByDay[day].start < value.hoursByDay[day].end),
    save: async (value, { keepalive }) => {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
        keepalive,
      });
      if (!res.ok) throw new Error("Failed to save settings");
      const data = (await res.json()) as AppSettings;
      writeCachedResource(settingsDataKey(), { settings: data, mfaStatus: initialMfaStatus });
      invalidateWorkspaceResource("rosters");
      invalidateWorkspaceResource("editor");
      return { value: data, savedAt: new Date().toISOString() };
    },
  });
  const invalidDays = useMemo(
    () => new Set(DAY_KEYS.filter((day) => settings.hoursByDay[day].start >= settings.hoursByDay[day].end)),
    [settings]
  );

  function updateDay(day: DayKey, field: "start" | "end", value: string) {
    setSettings((prev) => ({
      ...prev,
      hoursByDay: { ...prev.hoursByDay, [day]: { ...prev.hoursByDay[day], [field]: value } },
    }));
  }

  function updateUpcomingDays(value: string) {
    const numeric = Math.floor(Number(value));
    setSettings((prev) => ({
      ...prev,
      upcomingDays: Number.isFinite(numeric) ? Math.min(90, Math.max(1, numeric)) : DEFAULT_SETTINGS.upcomingDays,
    }));
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        title="Settings"
        description={isAdmin ? "Roster defaults, account requests and security." : "Roster defaults and account security."}
        meta={isAdmin ? <SaveStatus state={saveState} /> : undefined}
        actions={
          isAdmin && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void saveNow({ mode: "manual" })}
              disabled={saveState.state === "saving" || invalidDays.size > 0}
            >
              <Save />
              Save
            </button>
          )
        }
      />

      <div className="space-y-6">
        <section className="card">
          <div className="card-header">
            <div>
              <h2 className="card-title">Roster defaults</h2>
              <p className="card-description">
                {isAdmin ? "Used for new rosters and days that haven't been changed." : "Only administrators can change these."}
              </p>
            </div>
          </div>
          <div className="border-b border-[var(--border)] p-5">
            <label className="field-label" htmlFor="upcoming-days">
              Days shown on the Rosters page
            </label>
            <input
              id="upcoming-days"
              type="number"
              min={1}
              max={90}
              className="input w-[100px]"
              value={settings.upcomingDays}
              onChange={(e) => updateUpcomingDays(e.target.value)}
              disabled={!isAdmin}
            />
          </div>
          <div className="px-5 pb-2 pt-4">
            <p className="field-label">Opening hours</p>
          </div>
          <ul className="divide-y divide-[var(--border)] border-t border-[var(--border)]">
            {DAY_KEYS.map((day) => (
              <li key={day} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-2.5">
                <span className="w-28 text-[14px]">{DAY_LABELS[day]}</span>
                <div className="flex items-center gap-2">
                  <input
                    type="time"
                    className="input h-8 w-[120px] text-[13px]"
                    value={settings.hoursByDay[day].start}
                    step={900}
                    onChange={(e) => updateDay(day, "start", e.target.value)}
                    aria-label={`${DAY_LABELS[day]} opening time`}
                    disabled={!isAdmin}
                  />
                  <span className="text-[13px] text-[var(--text-muted)]">to</span>
                  <input
                    type="time"
                    className="input h-8 w-[120px] text-[13px]"
                    value={settings.hoursByDay[day].end}
                    step={900}
                    onChange={(e) => updateDay(day, "end", e.target.value)}
                    aria-label={`${DAY_LABELS[day]} closing time`}
                    disabled={!isAdmin}
                  />
                </div>
                {invalidDays.has(day) && (
                  <span className="text-[13px] text-[var(--danger)]">Closing time must be after opening time.</span>
                )}
              </li>
            ))}
          </ul>
        </section>

        {isAdmin && <AccountRequestsSection />}

        <SecuritySection user={initialSessionUser} initialStatus={initialMfaStatus} />
      </div>
    </div>
  );
}
