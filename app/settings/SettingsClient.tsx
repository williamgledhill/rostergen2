"use client";

import React, { useMemo, useState } from "react";
import { buildDraftStorageKey, formatAutosaveStatusText, getAutosaveStatusClassName } from "@/lib/clientDrafts";
import { AppSettings, DEFAULT_SETTINGS, DAY_KEYS } from "@/lib/settingsDefaults";
import { usePersistedAutosave } from "@/lib/usePersistedAutosave";
import { invalidateWorkspaceResource, settingsDataKey, writeCachedResource } from "@/lib/workspaceData";

const DAY_LABELS: Record<string, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "EDITOR";
  totpEnabled: boolean;
  mustChangePassword: boolean;
};

type MfaStatus = {
  enabled: boolean;
  setupPending: boolean;
  setupExpiresAt: string | null;
};

export default function SettingsClient({
  initialSettings,
  initialSessionUser,
  initialMfaStatus,
}: {
  initialSettings: AppSettings;
  initialSessionUser: SessionUser | null;
  initialMfaStatus: MfaStatus;
}) {
  const [sessionUser, setSessionUser] = useState<SessionUser | null>(initialSessionUser);
  const [mfaStatus, setMfaStatus] = useState<MfaStatus>(initialMfaStatus);
  const [mfaSecret, setMfaSecret] = useState("");
  const [mfaUri, setMfaUri] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaMessage, setMfaMessage] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [disablePassword, setDisablePassword] = useState("");
  const [disableCode, setDisableCode] = useState("");
  const {
    value: settings,
    setValue: setSettings,
    saveState,
    saveNow,
  } = usePersistedAutosave<AppSettings>({
    storageKey: buildDraftStorageKey("settings", "app"),
    initialValue: initialSettings,
    getSignature: (value) => JSON.stringify(value),
    canSave: sessionUser?.role === "ADMIN",
    canSaveValue: (value) => DAY_KEYS.every((day) => value.hoursByDay[day].start < value.hoursByDay[day].end),
    save: async (value, { keepalive }) => {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
        keepalive,
      });
      if (!res.ok) throw new Error("Failed to save settings");
      const data = await res.json();
      if (sessionUser) {
        writeCachedResource(settingsDataKey(sessionUser), { settings: data, mfaStatus });
      }
      invalidateWorkspaceResource("rosters");
      invalidateWorkspaceResource("editor");
      return {
        value: data,
        savedAt: new Date().toISOString(),
      };
    },
  });
  const invalidDays = useMemo(() => {
    return DAY_KEYS.filter((day) => settings.hoursByDay[day].start >= settings.hoursByDay[day].end);
  }, [settings]);
  const isAdmin = sessionUser?.role === "ADMIN";

  function updateDay(day: string, field: "start" | "end", value: string) {
    setSettings((prev) => ({
      ...prev,
      hoursByDay: {
        ...prev.hoursByDay,
        [day]: { ...prev.hoursByDay[day as keyof typeof prev.hoursByDay], [field]: value },
      },
    }));
  }

  function updateUpcomingDays(value: string) {
    const numeric = Math.floor(Number(value));
    setSettings((prev) => ({
      ...prev,
      upcomingDays: Number.isFinite(numeric)
        ? Math.min(90, Math.max(1, numeric))
        : DEFAULT_SETTINGS.upcomingDays,
    }));
  }

  const saveStatusText = formatAutosaveStatusText(saveState);
  const saveStatusClassName = getAutosaveStatusClassName(saveState);

  async function beginMfaSetup() {
    try {
      setMfaBusy(true);
      setMfaMessage("");
      setRecoveryCodes([]);
      const res = await fetch("/api/auth/mfa/setup", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to start MFA setup");
      setMfaSecret(data.secret || "");
      setMfaUri(data.otpauthUri || "");
      setMfaStatus((prev) => ({
        ...prev,
        setupPending: true,
        setupExpiresAt: data.expiresAt || null,
      }));
    } catch (err: any) {
      setMfaMessage(err?.message || "Failed to start two-factor setup.");
    } finally {
      setMfaBusy(false);
    }
  }

  async function verifyMfaSetup() {
    if (!mfaCode.trim()) {
      setMfaMessage("Enter the code from your authenticator app.");
      return;
    }

    try {
      setMfaBusy(true);
      setMfaMessage("");
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: mfaCode.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to verify MFA");
      setRecoveryCodes(Array.isArray(data?.recoveryCodes) ? data.recoveryCodes : []);
      setMfaSecret("");
      setMfaUri("");
      setMfaCode("");
      setMfaStatus({ enabled: true, setupPending: false, setupExpiresAt: null });
      setSessionUser((prev) => (prev ? { ...prev, totpEnabled: true } : prev));
      setMfaMessage("Two-factor authentication is now enabled.");
    } catch (err: any) {
      setMfaMessage(err?.message || "Failed to verify the code.");
    } finally {
      setMfaBusy(false);
    }
  }

  async function turnOffMfa() {
    if (!disablePassword.trim() || !disableCode.trim()) {
      setMfaMessage("Enter your password and a current authenticator or recovery code.");
      return;
    }

    try {
      setMfaBusy(true);
      setMfaMessage("");
      const res = await fetch("/api/auth/mfa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          password: disablePassword,
          code: disableCode.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to disable MFA");
      setDisablePassword("");
      setDisableCode("");
      setRecoveryCodes([]);
      setMfaSecret("");
      setMfaUri("");
      setMfaCode("");
      setMfaStatus({ enabled: false, setupPending: false, setupExpiresAt: null });
      setSessionUser((prev) => (prev ? { ...prev, totpEnabled: false } : prev));
      setMfaMessage("Two-factor authentication has been disabled.");
    } catch (err: any) {
      setMfaMessage(err?.message || "Failed to disable two-factor authentication.");
    } finally {
      setMfaBusy(false);
    }
  }

  return (
    <div className="workspace-page">
      <div className="flex w-full flex-col items-start space-y-7">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-description mt-1.5">Security and roster defaults.</p>
          <p className={`mt-1 text-[12px] font-medium ${saveStatusClassName}`}>{saveStatusText}</p>
        </div>

        <div id="security" className="surface-panel">
          <div className="space-y-1 border-b border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-4">
            <h2 className="text-lg font-bold text-[var(--ink)]">Two-Factor Authentication</h2>
            <p className="text-sm font-medium text-[var(--muted-strong)]">
              Protects the current account with an authenticator app and recovery codes.
            </p>
          </div>
          <div className="space-y-4 px-5 py-5 text-sm">
            <div className="rounded-[8px] border border-[var(--border)] bg-[var(--surface-subtle)] px-4 py-4">
              <div className="font-bold text-[var(--ink)]">{sessionUser?.name || "Current user"}</div>
              <div className="font-medium text-[var(--muted-strong)]">{sessionUser?.email || "Loading..."}</div>
              <div className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-[var(--muted)]">
                {mfaStatus.enabled ? "2FA enabled" : mfaStatus.setupPending ? "Setup pending" : "2FA not enabled"}
              </div>
            </div>

            {!mfaStatus.enabled && (
              <div className="space-y-3">
                {!mfaStatus.setupPending && (
                  <button
                    className="btn btn-primary h-9 px-4"
                    style={{ borderRadius: "6px" }}
                    disabled={mfaBusy}
                    onClick={beginMfaSetup}
                  >
                    <span className="text-[14px] font-medium text-white">
                      {mfaBusy ? "Starting..." : "Set up authenticator app"}
                    </span>
                  </button>
                )}

                {mfaStatus.setupPending && (
                  <div className="space-y-3 rounded-md border border-[var(--border)] px-4 py-4">
                    <div>
                      <div className="text-sm font-semibold text-slate-800">Step 1</div>
                      <p className="mt-1 text-slate-600">Add this secret to your authenticator app.</p>
                    </div>
                    <div className="rounded-md bg-slate-50 px-3 py-3 font-mono text-sm break-all text-slate-800">
                      {mfaSecret || "Secret not loaded"}
                    </div>
                    {mfaUri && <div className="text-xs text-slate-500 break-all">otpauth URI: {mfaUri}</div>}
                    <div>
                      <div className="text-sm font-semibold text-slate-800">Step 2</div>
                      <p className="mt-1 text-slate-600">
                        Enter the 6-digit code from your authenticator app to finish setup.
                      </p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <input
                        type="text"
                        value={mfaCode}
                        onChange={(event) => setMfaCode(event.target.value)}
                        className="input w-full sm:w-[220px]"
                        placeholder="123456"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                      />
                      <button
                        className="btn btn-primary h-9 px-4"
                        style={{ borderRadius: "6px" }}
                        disabled={mfaBusy}
                        onClick={verifyMfaSetup}
                      >
                        <span className="text-[14px] font-medium text-white">
                          {mfaBusy ? "Verifying..." : "Enable 2FA"}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {mfaStatus.enabled && (
              <div className="space-y-3 rounded-md border border-[var(--border)] px-4 py-4">
                <p className="text-slate-600">
                  Two-factor authentication is active. To disable it, confirm your password and enter a current authenticator code or an unused recovery code.
                </p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="password"
                    className="input"
                    placeholder="Current password"
                    value={disablePassword}
                    onChange={(event) => setDisablePassword(event.target.value)}
                  />
                  <input
                    type="text"
                    className="input"
                    placeholder="Authenticator or recovery code"
                    value={disableCode}
                    onChange={(event) => setDisableCode(event.target.value)}
                  />
                </div>
                <button
                  className="btn h-9 px-4"
                  style={{ borderRadius: "6px", borderColor: "#f3b7b7", color: "#b91c1c" }}
                  disabled={mfaBusy}
                  onClick={turnOffMfa}
                >
                  Disable 2FA
                </button>
              </div>
            )}

            {recoveryCodes.length > 0 && (
              <div className="rounded-md border border-amber-300 bg-amber-50 px-4 py-4">
                <div className="font-semibold text-amber-900">Recovery codes</div>
                <p className="mt-1 text-sm text-amber-900">Store these now. They are shown only once.</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {recoveryCodes.map((recoveryCode) => (
                    <div key={recoveryCode} className="rounded bg-white px-3 py-2 font-mono text-sm text-slate-800">
                      {recoveryCode}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {mfaMessage && (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 text-slate-700">
                {mfaMessage}
              </div>
            )}
          </div>
        </div>

        <div className="surface-panel">
          <div className="space-y-3 border-b border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-4">
            <h2 className="text-lg font-bold text-[var(--ink)]">Default Hours</h2>
            <p className="text-sm font-medium text-[var(--muted-strong)]">Used when creating or opening a roster day.</p>
            <div className="flex items-center gap-3 pt-1">
              <label className="text-sm font-semibold" htmlFor="upcoming-days">Upcoming roster days</label>
              <input
                id="upcoming-days"
                type="number"
                min={1}
                max={90}
                className="input text-[14px] w-[120px]"
                value={settings.upcomingDays}
                onChange={(e) => updateUpcomingDays(e.target.value)}
                aria-label="Upcoming roster days"
                disabled={!isAdmin}
              />
              <span className="text-xs text-slate-500">Auto-generates blank upcoming rows from today.</span>
            </div>
          </div>
          <div className="divide-y divide-[var(--border)]">
            <div className="grid grid-cols-[160px,1fr,1fr] gap-3 bg-white px-5 py-3 text-[12px] font-bold text-[var(--muted-strong)]">
              <span>Day</span>
              <span>From</span>
              <span>To</span>
            </div>
            {DAY_KEYS.map((day) => (
              <div key={day} className="grid grid-cols-[160px,1fr,1fr] items-center gap-3 px-5 py-3">
                <span className="text-sm font-semibold text-[var(--ink)]">{DAY_LABELS[day]}</span>
                <input
                  type="time"
                  className="input text-[14px] w-[140px]"
                  value={settings.hoursByDay[day].start}
                  step={900}
                  onChange={(e) => updateDay(day, "start", e.target.value)}
                  aria-label={`${DAY_LABELS[day]} start time`}
                  disabled={!isAdmin}
                />
                <input
                  type="time"
                  className="input text-[14px] w-[140px]"
                  value={settings.hoursByDay[day].end}
                  step={900}
                  onChange={(e) => updateDay(day, "end", e.target.value)}
                  aria-label={`${DAY_LABELS[day]} end time`}
                  disabled={!isAdmin}
                />
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            {invalidDays.length > 0 ? (
              <span className="text-xs text-red-600">End time must be after start time.</span>
            ) : !isAdmin ? (
              <span className="text-xs text-slate-500">Only administrators can change roster defaults.</span>
            ) : (
              <span className="text-xs text-slate-500">Changes apply to new or opened rosters.</span>
            )}
            <button
              className="btn btn-primary h-9"
              style={{ borderRadius: "6px", paddingInline: "12px" }}
              onClick={() => void saveNow({ mode: "manual" })}
              disabled={!isAdmin || saveState.state === "saving" || invalidDays.length > 0}
            >
              <span className="text-[14px] font-medium text-white">{saveState.state === "saving" ? "Saving..." : "Save"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
