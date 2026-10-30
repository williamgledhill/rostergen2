"use client";
import React, { useEffect, useRef, useState } from "react";
import { CalendarRange, LogOut, Menu, ShieldCheck } from "lucide-react";
import { useNav } from "@/components/NavContext";
import SpaLink from "@/components/ui/SpaLink";

function getInitials(name?: string | null) {
  const initials = (name ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("");
  return initials || "RP";
}

export default function GlobalTopBar({ userName }: { userName?: string | null }) {
  const { toggleNav } = useNav();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!profileOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!profileRef.current?.contains(e.target as Node)) setProfileOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setProfileOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [profileOpen]);

  async function handleLogout() {
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
    } finally {
      window.location.href = "/";
    }
  }

  return (
    <header className="sticky inset-x-0 top-0 z-50 flex h-14 w-full items-center justify-between gap-3 border-b border-[var(--border)] bg-white px-3 sm:px-4">
      <div className="flex min-w-0 items-center gap-2">
        <button type="button" className="btn btn-ghost btn-icon" onClick={toggleNav} aria-label="Toggle navigation">
          <Menu className="!h-5 !w-5" />
        </button>
        <SpaLink href="/rosters" className="flex min-w-0 items-center gap-2.5 rounded-md px-1 py-1">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[9px] bg-[var(--accent)] text-white">
            <CalendarRange className="h-[17px] w-[17px]" aria-hidden="true" />
          </span>
          <span className="truncate text-[15px] font-semibold tracking-[-0.01em]">Roster Generator</span>
        </SpaLink>
      </div>

      <div className="relative" ref={profileRef}>
        <button
          type="button"
          className="flex items-center gap-2 rounded-full py-1 pl-1 pr-1 transition hover:bg-[var(--surface-muted)] sm:pr-3"
          onClick={() => setProfileOpen((open) => !open)}
          aria-label="Account menu"
          aria-expanded={profileOpen}
          aria-haspopup="menu"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-[var(--accent-soft)] text-[12px] font-semibold text-[var(--accent-strong)]">
            {getInitials(userName)}
          </span>
          <span className="hidden max-w-[160px] truncate text-[13.5px] font-medium sm:block">{userName ?? "Account"}</span>
        </button>
        {profileOpen && (
          <div
            role="menu"
            className="dialog-enter absolute right-0 mt-2 w-52 overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border)] bg-white py-1 shadow-[var(--shadow-lg)]"
          >
            <SpaLink
              role="menuitem"
              href="/settings#security"
              className="flex items-center gap-2.5 px-3 py-2 text-[13.5px] hover:bg-[var(--surface-subtle)]"
              onNavigate={() => setProfileOpen(false)}
            >
              <ShieldCheck className="h-4 w-4 text-[var(--text-muted)]" />
              Security
            </SpaLink>
            <button
              role="menuitem"
              type="button"
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13.5px] hover:bg-[var(--surface-subtle)]"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 text-[var(--text-muted)]" />
              Log out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
