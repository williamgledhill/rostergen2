"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useNav } from "@/components/NavContext";
import { navigateWithinSpa, shouldHandleSpaClick, useSpaLocation } from "@/lib/spaNavigation";
import { preloadWorkspaceRoute } from "@/lib/workspaceData";
import { Bell, ChevronDown, CircleHelp, Clock3, Menu } from "lucide-react";

function getInitials(name?: string | null) {
  if (typeof name !== "string" || !name.trim()) return "RG";
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || "")
      .join("") || "RG"
  );
}

export default function GlobalTopBar({ userName }: { userName?: string | null }) {
  const { pathname } = useSpaLocation();
  const { toggleNav } = useNav();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const pageTitle = useMemo(() => {
    if (pathname.startsWith("/rosters")) return "Rosters";
    if (pathname.startsWith("/editor")) return "Roster Editor";
    if (pathname.startsWith("/tours")) return "Tours";
    if (pathname.startsWith("/people")) return "Staff";
    if (pathname.startsWith("/tasks")) return "Tasks";
    if (pathname.startsWith("/settings")) return "Settings";
    return "Roster Planner";
  }, [pathname]);
  const initials = useMemo(() => getInitials(userName), [userName]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!profileRef.current) return;
      if (profileRef.current.contains(e.target as Node)) return;
      setProfileOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  async function handleLogout() {
    try {
      await fetch("/api/auth/session", { method: "DELETE" });
    } finally {
      window.location.href = "/";
    }
  }

  return (
    <header className="sticky inset-x-0 top-0 z-30 h-[72px] w-full border-b border-[var(--border)] bg-[rgba(255,254,253,0.84)] px-5 backdrop-blur md:h-[106px] md:px-11">
      <div className="relative flex h-full w-full items-center justify-between">
        <button
          type="button"
          className="absolute left-0 flex h-10 w-10 items-center justify-center rounded-[14px] border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)] shadow-[0_10px_24px_rgba(41,29,21,0.08)] transition hover:border-[#d4cbc2] hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(57,36,147,0.18)] md:-left-[58px]"
          onClick={toggleNav}
          aria-label="Toggle navigation"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
        <span className="ml-14 font-serif text-[2rem] font-semibold leading-none text-[var(--ink)] md:ml-0 md:text-[2.65rem]">
          {pageTitle}
        </span>

        <div className="ml-auto flex items-center gap-3 md:gap-6">
          <button
            type="button"
            className="hidden h-9 items-center gap-2 text-[14px] font-semibold text-[var(--ink)] transition hover:text-[var(--accent)] md:inline-flex"
          >
            <Clock3 className="h-5 w-5" aria-hidden="true" />
            <span>What&apos;s new</span>
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />
          </button>
          <button type="button" className="hidden text-[var(--ink)] transition hover:text-[var(--accent)] md:inline-flex" aria-label="Help">
            <CircleHelp className="h-7 w-7" aria-hidden="true" />
          </button>
          <button type="button" className="relative text-[var(--ink)] transition hover:text-[var(--accent)]" aria-label="Notifications">
            <Bell className="h-6 w-6" aria-hidden="true" />
            <span className="absolute -right-2 -top-2 grid h-5 min-w-5 place-items-center rounded-full bg-[var(--accent)] px-1 text-[11px] font-bold leading-none text-white">
              3
            </span>
          </button>
        <div className="relative" ref={profileRef}>
          <button
            className="inline-flex h-12 items-center gap-3 rounded-full text-[var(--ink)] transition hover:text-[var(--accent)]"
            onClick={() => setProfileOpen((open) => !open)}
            aria-label="Profile menu"
            aria-expanded={profileOpen}
          >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-[#ece8e1] text-[17px] font-bold" aria-hidden="true">
              {initials}
            </span>
            <ChevronDown className="hidden h-5 w-5 md:block" aria-hidden="true" />
            <span className="sr-only">Profile</span>
          </button>
          {profileOpen && (
            <div className="absolute right-0 z-50 mt-3 w-44 overflow-hidden rounded-[12px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_18px_40px_rgba(41,29,21,0.12)]">
              <Link
                className="block w-full px-4 py-3 text-left text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)]"
                href="/settings#security"
                onMouseEnter={() => preloadWorkspaceRoute("/settings")}
                onFocus={() => preloadWorkspaceRoute("/settings")}
                onClick={(event) => {
                  if (shouldHandleSpaClick(event) && navigateWithinSpa("/settings#security")) {
                    event.preventDefault();
                    setProfileOpen(false);
                  }
                }}
              >
                Security
              </Link>
              <button
                className="w-full px-4 py-3 text-left text-sm font-medium text-[var(--ink)] hover:bg-[var(--surface-subtle)]"
                onClick={handleLogout}
              >
                Log out
              </button>
            </div>
          )}
          </div>
        </div>
      </div>
    </header>
  );
}
