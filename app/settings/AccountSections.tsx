"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Check, Copy, KeyRound, LogOut, Mail, Pencil, ShieldOff, UserCheck, UserPlus, UserX, X } from "lucide-react";
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

type InviteResult =
  | { name: string; emailed: true; sentTo: string }
  | { name: string; emailed: false; emailFailed: boolean; url: string; expiresAt: string };

function AddUserForm({
  emailEnabled,
  onCreated,
  onCancel,
}: {
  emailEnabled: boolean;
  onCreated: (result: InviteResult) => void;
  onCancel: () => void;
}) {
  const [sendInviteEmail, setSendInviteEmail] = useState(true);
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
        body: { name: name.trim(), email: email.trim(), role, sendEmail: emailEnabled && sendInviteEmail },
      });
      onCreated(
        data.emailed
          ? { name: name.trim(), emailed: true, sentTo: data.sentTo }
          : {
              name: name.trim(),
              emailed: false,
              emailFailed: Boolean(data.emailFailed),
              url: data.inviteUrl,
              expiresAt: data.expiresAt,
            }
      );
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
        {emailEnabled && sendInviteEmail
          ? "We'll email them an invitation link. They choose their own password when they open it."
          : "You'll get an invitation link to send them. They choose their own password when they open it."}
      </p>
      {emailEnabled && (
        <label className="flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            checked={sendInviteEmail}
            onChange={(event) => setSendInviteEmail(event.target.checked)}
          />
          Email the invitation to them
        </label>
      )}
      {error && (
        <p className="text-[13px] text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? "Adding…" : emailEnabled && sendInviteEmail ? "Add user and send invitation" : "Add user and create link"}
        </button>
        <button type="button" className="btn btn-ghost" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function EditUserForm({
  user,
  onSaved,
  onCancel,
}: {
  user: ManagedUser;
  onSaved: (changes: { name: string; email: string }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!name.trim()) {
      setError("Enter a name.");
      return;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      await requestJson(`/api/users/${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        body: { name: name.trim(), email: email.trim() },
      });
      onSaved({ name: name.trim(), email: email.trim().toLowerCase() });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="space-y-3" onSubmit={submit}>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="field-label" htmlFor={`edit-name-${user.id}`}>
            Name
          </label>
          <input
            id={`edit-name-${user.id}`}
            className="input"
            autoComplete="off"
            value={name}
            onChange={(event) => setName(event.target.value)}
            autoFocus
          />
        </div>
        <div>
          <label className="field-label" htmlFor={`edit-email-${user.id}`}>
            Sign-in email
          </label>
          <input
            id={`edit-email-${user.id}`}
            type="email"
            className="input"
            autoComplete="off"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
      </div>
      {email.trim().toLowerCase() !== user.email && (
        <p className="text-[13px] text-[var(--text-muted)]">
          They&apos;ll sign in with the new email from now on. Let them know, as it isn&apos;t sent to them.
        </p>
      )}
      {error && (
        <p className="text-[13px] text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function UsersSection({ currentUser }: { currentUser: AuthUser }) {
  const { notify, confirm } = useFeedback();
  const { value: usersData, setValue: setUsersData, error, setError } = useAccountsResource<{
    users: ManagedUser[];
    emailEnabled: boolean;
  }>("/api/users", (data) => ({
    users: Array.isArray(data?.users) ? data.users : [],
    emailEnabled: Boolean(data?.emailEnabled),
  }));
  const users = usersData?.users ?? null;
  const emailEnabled = Boolean(usersData?.emailEnabled);
  const setUsers = (update: (prev: ManagedUser[]) => ManagedUser[]) =>
    setUsersData((prev) => (prev ? { ...prev, users: update(prev.users) } : prev));
  const [sentNotice, setSentNotice] = useState<{ user: ManagedUser; sentTo: string; invitation: boolean } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [resetLink, setResetLink] = useState<{
    name: string;
    url: string;
    expiresAt: string;
    invitation: boolean;
  } | null>(null);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

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

  const issueReset = async (user: ManagedUser, delivery: "email" | "link" = emailEnabled ? "email" : "link") => {
    const invited = !user.lastLoginAt;
    const lifetime = invited ? "7 days" : "24 hours";
    const confirmed = await confirm({
      title:
        delivery === "email"
          ? invited
            ? `Email a new invitation to ${user.name}?`
            : `Email a password reset link to ${user.name}?`
          : invited
          ? `Create a new invitation link for ${user.name}?`
          : `Create a password reset link for ${user.name}?`,
      message: `${
        delivery === "email" ? `We'll send it to ${user.email}.` : "You'll get a link to send them yourself."
      } It works once, for ${lifetime}, and any earlier link stops working.${
        invited ? "" : " Their current password keeps working until they use it."
      }`,
      confirmLabel: delivery === "email" ? "Send email" : "Create link",
    });
    if (!confirmed) return;
    await act(user, async () => {
      const data = await requestJson(userUrl(user, "/password-reset"), { method: "POST", body: { delivery } });
      setAdding(false);
      if (data.emailed) {
        setResetLink(null);
        setSentNotice({ user, sentTo: data.sentTo, invitation: Boolean(data.invitation) });
        notify({ tone: "success", title: `Email sent to ${data.sentTo}` });
      } else {
        setSentNotice(null);
        setResetLink({ name: user.name, url: data.resetUrl, expiresAt: data.expiresAt, invitation: Boolean(data.invitation) });
      }
    });
  };

  const resetTwoFactor = async (user: ManagedUser) => {
    const confirmed = await confirm({
      title: `Turn off two-factor for ${user.name}?`,
      message: "Use this when they've lost their authenticator. They'll be signed out and asked to set it up again the next time they sign in.",
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
          emailEnabled={emailEnabled}
          onCreated={(result) => {
            setAdding(false);
            announceAccountsChanged();
            if (result.emailed) {
              notify({ tone: "success", title: `${result.name} added`, message: `Invitation emailed to ${result.sentTo}.` });
              return;
            }
            setResetLink({ name: result.name, url: result.url, expiresAt: result.expiresAt, invitation: true });
            notify(
              result.emailFailed
                ? { tone: "error", title: `${result.name} added, but the email didn't send`, message: "Send them the link below instead." }
                : { tone: "success", title: `${result.name} added`, message: "Send them the invitation link." }
            );
          }}
        />
      )}

      {sentNotice && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--success-soft)] px-5 py-3 text-[14px]">
          <p className="text-[var(--success)]">
            {sentNotice.invitation ? "Invitation" : "Reset link"} emailed to {sentNotice.sentTo}.
          </p>
          <div className="flex gap-2">
            <button type="button" className="btn btn-sm" onClick={() => void issueReset(sentNotice.user, "link")}>
              Didn&apos;t arrive? Copy a link instead
            </button>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => setSentNotice(null)}>
              Dismiss
            </button>
          </div>
        </div>
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
            if (editingId === user.id) {
              return (
                <li key={user.id} className="bg-[var(--surface-subtle)] px-5 py-4 text-[14px]">
                  <EditUserForm
                    user={user}
                    onCancel={() => setEditingId(null)}
                    onSaved={(changes) => {
                      setEditingId(null);
                      setUsers((prev) => prev.map((item) => (item.id === user.id ? { ...item, ...changes } : item)));
                      announceAccountsChanged();
                      notify({ tone: "success", title: `${changes.name}'s details updated` });
                    }}
                  />
                </li>
              );
            }
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
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-sm" disabled={busy} onClick={() => setEditingId(user.id)}>
                    <Pencil />
                    Edit
                  </button>
                {!isSelf && (
                  <>
                    {user.isActive && (
                      <button type="button" className="btn btn-sm" disabled={busy} onClick={() => void issueReset(user)}>
                        {user.lastLoginAt ? <KeyRound /> : <Mail />}
                        {user.lastLoginAt ? (emailEnabled ? "Email reset link" : "Reset password") : "Resend invite"}
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
                  </>
                )}
                </div>
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
  "user.details_changed": "changed the details of",
  "user.email_changed": "changed their sign-in email:",
  "user.password_reset_requested": "asked for a password reset email:",
  "user.password_reset_completed": "reset their password using a link:",
  "user.password_changed": "changed their password:",
};

function describeAudit(entry: AuditEntry) {
  const actor = entry.actorEmail ?? "Someone";
  const label = AUDIT_ACTION_LABELS[entry.action] ?? entry.action;
  const details = (entry.details ?? {}) as Record<string, string | undefined>;
  const changes: string[] = [];
  if (entry.action === "user.role_changed" && details.to) changes.push(`${details.from} → ${details.to}`);
  if (entry.action === "user.invited" && details.role) {
    changes.push(details.role === "ADMIN" ? "as an administrator" : "as an editor");
  }
  if (details.emailTo) changes.push(`email ${details.emailFrom} → ${details.emailTo}`);
  if (details.nameTo) changes.push(`name ${details.nameFrom} → ${details.nameTo}`);
  const suffix = changes.length ? ` (${changes.join(", ")})` : "";
  return `${actor} ${label} ${entry.targetEmail ?? ""}${suffix}`;
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

export function ChangeEmailSection({ initialEmail }: { initialEmail: string }) {
  const { notify } = useFeedback();
  const [currentEmail, setCurrentEmail] = useState(initialEmail);
  const [newEmail, setNewEmail] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    if (!EMAIL_REGEX.test(newEmail.trim())) {
      setError("Enter a valid email address.");
      return;
    }
    setBusy(true);
    try {
      const data = await requestJson("/api/auth/email", {
        method: "POST",
        body: { currentPassword, newEmail: newEmail.trim() },
      });
      setCurrentEmail(data.email);
      setNewEmail("");
      setCurrentPassword("");
      announceAccountsChanged();
      notify({ tone: "success", title: "Email changed", message: `Sign in with ${data.email} from now on.` });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="email" className="card scroll-mt-20">
      <div className="card-header">
        <div>
          <h2 className="card-title">Sign-in email</h2>
          <p className="card-description">
            You sign in with <span className="font-medium text-[var(--text)]">{currentEmail}</span>.
          </p>
        </div>
      </div>
      <form className="space-y-3 p-5 text-[14px]" onSubmit={submit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            type="email"
            className="input"
            placeholder="New email"
            autoComplete="email"
            value={newEmail}
            onChange={(event) => setNewEmail(event.target.value)}
          />
          <input
            type="password"
            className="input"
            placeholder="Current password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
        </div>
        <button type="submit" className="btn btn-primary" disabled={busy || !newEmail || !currentPassword}>
          {busy ? "Changing…" : "Change email"}
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
