"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { DatabaseBackup, Download, RotateCcw, Trash2, Upload } from "lucide-react";
import { useFeedback } from "@/components/ui/Feedback";
import type { BackupKind, BackupListItem } from "@/lib/backups";

const KIND_LABELS: Record<BackupKind, { label: string; badge: string }> = {
  manual: { label: "Manual", badge: "badge-accent" },
  automatic: { label: "Daily", badge: "" },
  "pre-restore": { label: "Before a restore", badge: "badge-warning" },
};

async function requestJson(url: string, init?: { method?: string; body?: unknown }) {
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    body: init?.body ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Request failed");
  return data;
}

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : "Something went wrong.";
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function describeContents(summary: BackupListItem["summary"]) {
  const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return [
    count(summary.people, "person", "people"),
    count(summary.taskTemplates, "task", "tasks"),
    count(summary.rosters, "roster", "rosters"),
  ].join(" · ");
}

/** Restored data replaces what's on the server, so unsaved local copies of the old data must go too. */
function reloadWithRestoredData() {
  try {
    Object.keys(window.sessionStorage)
      .filter((key) => key.startsWith("rosterplanner:"))
      .forEach((key) => window.sessionStorage.removeItem(key));
  } catch (error) {
    console.error(error);
  }
  window.location.reload();
}

export function BackupsSection() {
  const { confirm, notify } = useFeedback();
  const [backups, setBackups] = useState<BackupListItem[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    requestJson("/api/backups")
      .then((data) => {
        setBackups(Array.isArray(data?.backups) ? data.backups : []);
        setError("");
      })
      .catch((err) => setError(errorMessage(err)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function run(key: string, action: () => Promise<void>) {
    setBusy(key);
    try {
      await action();
    } catch (err) {
      notify({ tone: "error", title: "Something went wrong", message: errorMessage(err) });
    } finally {
      setBusy(null);
    }
  }

  const backUpNow = () =>
    run("create", async () => {
      await requestJson("/api/backups", { method: "POST" });
      notify({ tone: "success", title: "Backup taken" });
      load();
    });

  async function restore(backup: BackupListItem) {
    const confirmed = await confirm({
      title: "Restore this backup?",
      message: `All people, tasks, tours, settings and rosters are replaced with the backup from ${formatDateTime(
        backup.createdAt
      )}. A backup of the current data is taken first, so you can undo this by restoring that one.`,
      confirmLabel: "Restore",
      tone: "danger",
    });
    if (!confirmed) return;
    await run(`restore:${backup.id}`, async () => {
      await requestJson("/api/backups/restore", { method: "POST", body: { backupId: backup.id } });
      notify({ tone: "success", title: "Backup restored", message: "Reloading with the restored data…" });
      reloadWithRestoredData();
    });
  }

  async function restoreFromFile(file: File) {
    let data: unknown;
    try {
      data = JSON.parse(await file.text());
    } catch {
      notify({ tone: "error", title: "Couldn't read that file", message: "Choose a backup file downloaded from here." });
      return;
    }
    const confirmed = await confirm({
      title: `Restore ${file.name}?`,
      message:
        "All people, tasks, tours, settings and rosters are replaced with the ones in this file. A backup of the current data is taken first, so you can undo this.",
      confirmLabel: "Restore",
      tone: "danger",
    });
    if (!confirmed) return;
    await run("restore-file", async () => {
      await requestJson("/api/backups/restore", { method: "POST", body: { data, fileName: file.name } });
      notify({ tone: "success", title: "Backup restored", message: "Reloading with the restored data…" });
      reloadWithRestoredData();
    });
  }

  async function remove(backup: BackupListItem) {
    const confirmed = await confirm({
      title: "Delete this backup?",
      message: `The backup from ${formatDateTime(backup.createdAt)} will be gone for good.`,
      confirmLabel: "Delete",
      tone: "danger",
    });
    if (!confirmed) return;
    await run(`delete:${backup.id}`, async () => {
      await requestJson(`/api/backups/${encodeURIComponent(backup.id)}`, { method: "DELETE" });
      setBackups((current) => current?.filter((entry) => entry.id !== backup.id) ?? current);
    });
  }

  return (
    <section id="backups" className="card scroll-mt-20">
      <div className="card-header">
        <div>
          <h2 className="card-title">Backups</h2>
          <p className="card-description">
            A copy of all people, tasks, tours, settings and rosters is taken once a day, and the last 14 are kept.
            User accounts aren&apos;t included.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn" disabled={busy !== null} onClick={() => fileInputRef.current?.click()}>
            <Upload />
            Restore from file
          </button>
          <button type="button" className="btn btn-primary" disabled={busy !== null} onClick={backUpNow}>
            <DatabaseBackup />
            {busy === "create" ? "Backing up…" : "Back up now"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void restoreFromFile(file);
            }}
          />
        </div>
      </div>

      {backups === null && !error && <p className="p-5 text-[14px] text-[var(--text-muted)]">Loading…</p>}
      {backups && backups.length === 0 && (
        <p className="p-5 text-[14px] text-[var(--text-muted)]">
          No backups yet. The first daily one is taken shortly; or take one now.
        </p>
      )}
      {backups && backups.length > 0 && (
        <ul className="max-h-[420px] divide-y divide-[var(--border)] overflow-y-auto">
          {backups.map((backup) => {
            const kind = KIND_LABELS[backup.kind];
            return (
              <li key={backup.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3">
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-[14px] font-medium">
                    {formatDateTime(backup.createdAt)}
                    <span className={`badge ${kind.badge}`}>{kind.label}</span>
                  </p>
                  <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">
                    {describeContents(backup.summary)} · {formatSize(backup.sizeBytes)}
                    {backup.createdByEmail ? ` · by ${backup.createdByEmail}` : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <a className="btn btn-sm" href={`/api/backups/${encodeURIComponent(backup.id)}`} download>
                    <Download />
                    Download
                  </a>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={busy !== null}
                    onClick={() => void restore(backup)}
                  >
                    <RotateCcw />
                    {busy === `restore:${backup.id}` ? "Restoring…" : "Restore"}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={busy !== null}
                    onClick={() => void remove(backup)}
                    aria-label={`Delete the backup from ${formatDateTime(backup.createdAt)}`}
                  >
                    <Trash2 />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {busy === "restore-file" && <p className="px-5 pb-4 text-[13px] text-[var(--text-muted)]">Restoring…</p>}
      {error && (
        <p className="p-5 text-[13px] text-[var(--danger)]" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
