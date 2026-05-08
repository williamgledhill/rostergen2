"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useNav } from "@/components/NavContext";
import { navigateWithinSpa, shouldHandleSpaClick } from "@/lib/spaNavigation";
import { preloadWorkspaceRoute } from "@/lib/workspaceData";
import { ChevronDown, CircleHelp, Menu } from "lucide-react";

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
  const { toggleNav } = useNav();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
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
    <header className="sticky inset-x-0 top-0 z-30 h-[74px] w-full border-b border-[var(--border)] bg-white/95 px-5 backdrop-blur md:px-9">
      <div className="relative flex h-full w-full items-center justify-between">
        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-[8px] text-[var(--accent)] transition hover:bg-[var(--accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(6,26,88,0.14)]"
          onClick={toggleNav}
          aria-label="Toggle navigation"
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="ml-auto flex items-center gap-5">
          <button
            type="button"
            className="hidden h-9 w-9 items-center justify-center rounded-full text-[var(--accent)] transition hover:bg-[var(--accent-soft)] md:inline-flex"
            aria-label="Help"
          >
            <CircleHelp className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="relative" ref={profileRef}>
            <button
              type="button"
              className="inline-flex h-12 items-center gap-3 rounded-full text-[var(--accent)] transition hover:text-[var(--accent-strong)]"
              onClick={() => setProfileOpen((open) => !open)}
              aria-label="Profile menu"
              aria-expanded={profileOpen}
            >
              <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--surface-soft)] text-[17px] font-bold" aria-hidden="true">
                {initials}
              </span>
              <ChevronDown className="hidden h-5 w-5 md:block" aria-hidden="true" />
              <span className="sr-only">Profile</span>
            </button>
            {profileOpen && (
              <div className="absolute right-0 z-50 mt-3 w-44 overflow-hidden rounded-[10px] border border-[var(--border)] bg-[var(--surface)] shadow-[0_16px_34px_rgba(6,26,77,0.12)]">
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
