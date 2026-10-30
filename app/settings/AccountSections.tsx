"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Check, Copy, KeyRound, LogOut, Mail, ShieldOff, UserCheck, UserPlus, UserX, X } from "lucide-react";
import PasswordRequirements from "@/components/PasswordRequirements";
import { useFeedback } from "@/components/ui/Feedback";
import { meetsPasswordPolicy, PASSWORD_POLICY_MESSAGE } from "@/lib/passwordRules";
import type { AccountRequest, AuthUser } from "@/lib/auth";
import type { AuditEntry, ManagedUser } from "@/lib/userAdmin";

async function requestJson(url: string, init?: { method?: string; body?: unknown }) {
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Request failed");
  return data;
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : "Something went wrong.";
}

function formatDateTime(value: string | null) {
  if (!value) return "Never";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** Changing users elsewhere in Settings refreshes the list and the log. */
const ACCOUNTS_CHANGED_EVENT = "rosterplanner:accounts-changed";
const announceAccountsChanged = () => window.dispatchEvent(new Event(ACCOUNTS_CHANGED_EVENT));

function useAccountsResource<T>(url: string, pick: (data: any) => T) {
  const [value, setValue] = useState<T | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    requestJson(url)
      .then((data) => {
        setValue(pick(data));
        setError("");
      })
      .catch((err) => setError(errorMessage(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  useEffect(() => {
    load();
    window.addEventListener(ACCOUNTS_CHANGED_EVENT, load);
    return () => window.removeEventListener(ACCOUNTS_CHANGED_EVENT, load);
  }, [load]);

  return { value, setValue, error, setError };
}

export function AccountRequestsSection() {
  const { notify } = useFeedback();
  const { value: requests, setValue: setRequests, error, setError } = useAccountsResource<AccountRequest[]>(
    "/api/users/requests",
    (data) => (Array.isArray(data?.requests) ? data.requests : [])
  );
  const [busyId, setBusyId] = useState<string | null>(null);

  async function decide(request: AccountRequest, approve: boolean) {
    setBusyId(request.id);
    setError("");
    try {
      await requestJson(`/api/users/requests/${encodeURIComponent(request.id)}`, {
        method: approve ? "POST" : "DELETE",
      });
      setRequests((prev) => (prev ?? []).filter((item) => item.id !== request.id));
      announceAccountsChanged();
      notify({ tone: "success", title: approve ? `${request.name} can now sign in` : "Request rejected" });
    } catch (err) {
      setError(errorMessage(err));
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
        {requests && requests.length > 0 && <span className="badge badge-warning">{requests.length}</span>}
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

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function AddUserForm({
  onCreated,
  onCancel,
}: {
  onCreated: (link: { name: string; url: string; expiresAt: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ManagedUser["role"]>("EDITOR");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Enter their name.");
      return;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      const data = await requestJson("/api/users", {
        method: "POST",
        body: { name: name.trim(), email: email.trim(), role },
      });
      onCreated({ name: name.trim(), url: data.inviteUrl, expiresAt: data.expiresAt });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-3 border-b border-[var(--border)] bg-[var(--surface-subtle)] p-5 text-[14px]" onSubmit={submit}>
      <p className="font-medium">Add a user</p>
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_150px]">
        <div>
          <label className="field-label" htmlFor="invite-name">
            Name
          </label>
          <input
            id="invite-name"
            className="input"
            autoComplete="off"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </div>
        <div>
          <label className="field-label" htmlFor="invite-email">
            Email
          </label>
          <input
            id="invite-email"
            type="email"
            className="input"
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div>
          <label className="field-label" htmlFor="invite-role">
            Role
          </label>
          <select id="invite-role" className="input" value={role} onChange={(event) => setRole(event.target.value as ManagedUser["role"])}>
            <option value="EDITOR">Editor</option>
            <option value="ADMIN">Administrator</option>
          </select>
        </div>
      </div>
      <p className="text-[13px] text-[var(--text-muted)]">
        You&apos;ll get an invitation link to send them. They choose their own password when they open it.
      </p>
      {error && (
        <p className="text-[13px] text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Adding…" : "Add user and create link"}
        </button>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function UsersSection({ currentUser }: { currentUser: AuthUser }) {
  const { notify, confirm } = useFeedback();
  const { value: users, error, setError } = useAccountsResource<ManagedUser[]>("/api/users", (data) =>
    Array.isArray(data?.users) ? data.users : []
  );
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<{
    name: string;
    url: string;
    expiresAt: string;
    invitation: boolean;
  } | null>(null);
  const [adding, setAdding] = useState(false);

  async function act(user: ManagedUser, action: () => Promise<void>) {
    setBusyId(user.id);
    setError("");
    try {
      await action();
      announceAccountsChanged();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  const userUrl = (user: ManagedUser, suffix = "") => `/api/users/${encodeURIComponent(user.id)}${suffix}`;

  const changeRole = (user: ManagedUser, role: ManagedUser["role"]) =>
    act(user, async () => {
      await requestJson(userUrl(user), { method: "PATCH", body: { role } });
      notify({ tone: "success", title: `${user.name} is now ${role === "ADMIN" ? "an administrator" : "an editor"}` });
    });

  const toggleActive = async (user: ManagedUser) => {
    if (user.isActive) {
      const confirmed = await confirm({
        title: `Deactivate ${user.name}?`,
        message: "They'll be signed out straight away and won't be able to sign in until you reactivate them.",
        confirmLabel: "Deactivate",
        tone: "danger",
      });
      if (!confirmed) return;
    }
    await act(user, async () => {
      await requestJson(userUrl(user), { method: "PATCH", body: { isActive: !user.isActive } });
      notify({ tone: "success", title: user.isActive ? `${user.name} deactivated` : `${user.name} reactivated` });
    });
  };

  const issueReset = async (user: ManagedUser) => {
    const invited = !user.lastLoginAt;
    const confirmed = await confirm({
      title: invited ? `Create a new invitation link for ${user.name}?` : `Create a password reset link for ${user.name}?`,
      message: invited
        ? "You'll get a new link to send them. It works for 7 days, and any earlier link stops working."
        : "You'll get a single-use link to send them. It works for 24 hours, and any earlier link stops working. Their current password keeps working until they use it.",
      confirmLabel: "Create link",
    });
    if (!confirmed) return;
    await act(user, async () => {
      const data = await requestJson(userUrl(user, "/password-reset"), { method: "POST" });
      setAdding(false);
      setResetLink({ name: user.name, url: data.resetUrl, expiresAt: data.expiresAt, invitation: Boolean(data.invitation) });
    });
  };

  const resetTwoFactor = async (user: ManagedUser) => {
    const confirmed = await confirm({
      title: `Turn off two-factor for ${user.name}?`,
      message: "Use this when they've lost their authenticator. They'll be signed out and can set it up again in Settings.",
      confirmLabel: "Turn off",
      tone: "danger",
    });
    if (!confirmed) return;
    await act(user, async () => {
      await requestJson(userUrl(user, "/two-factor"), { method: "DELETE" });
      notify({ tone: "success", title: `Two-factor turned off for ${user.name}` });
    });
  };

  const signOutEverywhere = async (user: ManagedUser) => {
    const confirmed = await confirm({
      title: `Sign ${user.name} out everywhere?`,
      message: "Every device they're signed in on will need to sign in again.",
      confirmLabel: "Sign out",
    });
    if (!confirmed) return;
    await act(user, async () => {
      await requestJson(userUrl(user, "/sessions"), { method: "DELETE" });
      notify({ tone: "success", title: `${user.name} signed out everywhere` });
    });
  };

  return (
    <section id="users" className="card scroll-mt-20">
      <div className="card-header">
        <div>
          <h2 className="card-title">Users</h2>
          <p className="card-description">
            Manage who can sign in. You never see anyone&apos;s password: send them an invitation or reset link instead.
          </p>
        </div>
        {!adding && (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setResetLink(null);
              setAdding(true);
            }}
          >
            <UserPlus />
            Add user
          </button>
        )}
      </div>

      {adding && (
        <AddUserForm
          onCancel={() => setAdding(false)}
          onCreated={(link) => {
            setAdding(false);
            setResetLink({ ...link, invitation: true });
            announceAccountsChanged();
            notify({ tone: "success", title: `${link.name} added`, message: "Send them the invitation link." });
          }}
        />
      )}

      {resetLink && (
        <div className="border-b border-[var(--border)] bg-[var(--warning-soft)] p-5 text-[14px]">
          <p className="font-medium text-amber-900">
            {resetLink.invitation ? "Invitation link" : "Reset link"} for {resetLink.name}
          </p>
          <p className="mt-0.5 text-[13px] text-amber-900">
            Send this to them privately. {resetLink.invitation ? "They'll set up their password with it. " : ""}It works
            once, until {formatDateTime(resetLink.expiresAt)}, and won&apos;t be shown again.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input className="input min-w-0 flex-1 font-mono text-[12px]" readOnly value={resetLink.url} />
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => {
                void navigator.clipboard?.writeText(resetLink.url);
                notify({ tone: "success", title: "Link copied" });
              }}
            >
              <Copy />
              Copy
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setResetLink(null)}>
              Done
            </button>
          </div>
        </div>
      )}

      {users === null && !error && <p className="p-5 text-[14px] text-[var(--text-muted)]">Loading…</p>}
      {users && (
        <ul className="divide-y divide-[var(--border)]">
          {users.map((user) => {
            const isSelf = user.id === currentUser.id;
            const busy = busyId !== null;
            return (
              <li key={user.id} className="space-y-2 px-5 py-3 text-[14px]">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {user.name}
                      {isSelf && <span className="badge">You</span>}
                      {!user.isActive && <span className="badge badge-danger">Deactivated</span>}
                      {user.isActive && !user.lastLoginAt && <span className="badge badge-warning">Invited</span>}
                      {user.totpEnabled && <span className="badge badge-success">2FA</span>}
                    </p>
                    <p className="truncate text-[13px] text-[var(--text-muted)]">
                      {user.email} · last sign-in {formatDateTime(user.lastLoginAt)}
                    </p>
                  </div>
                  <select
                    className="input h-8 w-[130px] text-[13px]"
                    value={user.role}
                    disabled={busy || isSelf}
                    title={isSelf ? "You can't change your own role" : undefined}
                    aria-label={`Role for ${user.name}`}
                    onChange={(event) => void changeRole(user, event.target.value as ManagedUser["role"])}
                  >
                    <option value="EDITOR">Editor</option>
                    <option value="ADMIN">Administrator</option>
                  </select>
                </div>
                {!isSelf && (
                  <div className="flex flex-wrap gap-2">
                    {user.isActive && (
                      <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void issueReset(user)}>
                        {user.lastLoginAt ? <KeyRound /> : <Mail />}
                        {user.lastLoginAt ? "Reset password" : "Resend invite"}
                      </button>
                    )}
                    {user.totpEnabled && (
                      <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void resetTwoFactor(user)}>
                        <ShieldOff />
                        Reset 2FA
                      </button>
                    )}
                    {user.isActive && (
                      <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void signOutEverywhere(user)}>
                        <LogOut />
                        Sign out everywhere
                      </button>
                    )}
                    <button
                      type="button"
                      className={user.isActive ? "btn btn-sm btn-danger" : "btn btn-sm"}
                      disabled={busy}
                      onClick={() => void toggleActive(user)}
                    >
                      {user.isActive ? <UserX /> : <UserCheck />}
                      {user.isActive ? "Deactivate" : "Reactivate"}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {error && (
        <p className="px-5 pb-4 pt-2 text-[13px] text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

const AUDIT_ACTION_LABELS: Record<string, string> = {
  "user.request_approved": "approved the account request from",
  "user.request_rejected": "rejected the account request from",
  "user.role_changed": "changed the role of",
  "user.deactivated": "deactivated",
  "user.reactivated": "reactivated",
  "user.sessions_revoked": "signed out everywhere:",
  "user.two_factor_reset": "turned off two-factor for",
  "user.password_reset_issued": "created a password reset link for",
  "user.invited": "added and invited",
  "user.invite_resent": "created a new invitation link for",
  "user.invite_accepted": "accepted their invitation:",
  "user.password_reset_completed": "reset their password using a link:",
  "user.password_changed": "changed their password:",
};

function describeAudit(entry: AuditEntry) {
  const actor = entry.actorEmail ?? "Someone";
  const label = AUDIT_ACTION_LABELS[entry.action] ?? entry.action;
  const details = entry.details as { from?: string; to?: string } | null;
  const roleChange =
    entry.action === "user.role_changed" && details?.to
      ? ` (${details.from} → ${details.to})`
      : entry.action === "user.invited" && details && "role" in details
      ? ` as ${(details as { role: string }).role === "ADMIN" ? "an administrator" : "an editor"}`
      : "";
  return `${actor} ${label} ${entry.targetEmail ?? ""}${roleChange}`;
}

export function AuditLogSection() {
  const { value: entries, error } = useAccountsResource<AuditEntry[]>("/api/users/audit", (data) =>
    Array.isArray(data?.entries) ? data.entries : []
  );

  return (
    <section id="activity" className="card scroll-mt-20">
      <div className="card-header">
        <div>
          <h2 className="card-title">Account activity</h2>
          <p className="card-description">The 50 most recent account changes. This log can&apos;t be edited.</p>
        </div>
      </div>
      {entries === null && !error && <p className="p-5 text-[14px] text-[var(--text-muted)]">Loading…</p>}
      {entries && entries.length === 0 && (
        <p className="p-5 text-[14px] text-[var(--text-muted)]">Nothing recorded yet.</p>
      )}
      {entries && entries.length > 0 && (
        <ul className="max-h-[360px] divide-y divide-[var(--border)] overflow-y-auto">
          {entries.map((entry) => (
            <li key={entry.id} className="flex flex-wrap justify-between gap-x-4 px-5 py-2.5 text-[13px]">
              <span>{describeAudit(entry)}</span>
              <span className="text-[var(--text-muted)]">{formatDateTime(entry.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
      {error && (
        <p className="p-5 text-[13px] text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

export function ChangePasswordSection() {
  const { notify } = useFeedback();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!meetsPasswordPolicy(newPassword)) {
      setError(PASSWORD_POLICY_MESSAGE);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("The new passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      await requestJson("/api/auth/password", { method: "POST", body: { currentPassword, newPassword } });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      notify({ tone: "success", title: "Password changed", message: "Your other devices have been signed out." });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="password" className="card scroll-mt-20">
      <div className="card-header">
        <div>
          <h2 className="card-title">Password</h2>
          <p className="card-description">Changing it signs you out on your other devices.</p>
        </div>
      </div>
      <form className="space-y-3 p-5 text-[14px]" onSubmit={submit}>
        <div className="grid gap-3 sm:grid-cols-3">
          <input
            type="password"
            className="input"
            placeholder="Current password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
          <input
            type="password"
            className="input"
            placeholder="New password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <input
            type="password"
            className="input"
            placeholder="Confirm new password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </div>
        {newPassword && <PasswordRequirements password={newPassword} />}
        <button type="submit" className="btn btn-primary" disabled={busy || !currentPassword || !newPassword}>
          {busy ? "Changing…" : "Change password"}
        </button>
        {error && (
          <p className="text-[13px] text-[var(--danger)]" role="alert">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
