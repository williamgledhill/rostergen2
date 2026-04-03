"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useNav } from "@/components/NavContext";

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
  const pathname = usePathname() || "/";
  const { toggleNav } = useNav();
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const pageTitle = useMemo(() => {
    if (pathname.startsWith("/rosters")) return "Rosters";
    if (pathname.startsWith("/editor")) return "Roster Editor";
    if (pathname.startsWith("/people")) return "People";
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
    <header className="h-14 bg-[var(--accent)] px-4">
      <div className="relative flex h-full items-center justify-center">
        <button
          type="button"
          className="absolute left-0 grid h-9 w-9 place-items-center rounded-md border border-white/20 bg-white/8 text-white transition hover:bg-white/14 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          onClick={toggleNav}
          aria-label="Toggle navigation"
        >
          <Menu className="h-4 w-4" />
        </button>
        <span className="text-[16px] font-semibold tracking-[0.01em] text-white">{pageTitle}</span>
        <div className="absolute right-0" ref={profileRef}>
          <button
            className="grid h-9 w-9 place-items-center overflow-hidden rounded-full border border-white/60 bg-white text-[12px] font-semibold text-[var(--accent)]"
            onClick={() => setProfileOpen((open) => !open)}
            aria-label="Profile menu"
            aria-expanded={profileOpen}
          >
            <span aria-hidden="true">{initials}</span>
            <span className="sr-only">Profile</span>
          </button>
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-40 rounded-md border border-[var(--border)] bg-white shadow-lg z-50">
              <Link
                className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-[#f5f7fa]"
                href="/settings#security"
              >
                Security
              </Link>
              <button
                className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-[#f5f7fa]"
                onClick={handleLogout}
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
