"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

export default function GlobalTopBar() {
  const pathname = usePathname() || "/";
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);
  const pageTitle = useMemo(() => {
    if (pathname.startsWith("/rosters")) return "Rosters";
    if (pathname.startsWith("/editor")) return "Editor";
    if (pathname.startsWith("/people")) return "People";
    if (pathname.startsWith("/tasks")) return "Tasks";
    if (pathname.startsWith("/settings")) return "Settings";
    return "Roster Planner";
  }, [pathname]);

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
        <span className="text-[16px] font-semibold tracking-[0.01em] text-white">{pageTitle}</span>
        <div className="absolute right-0" ref={profileRef}>
          <button
            className="grid h-9 w-9 place-items-center overflow-hidden rounded-full border border-white/60 bg-white text-[12px] font-semibold text-[var(--accent)]"
            onClick={() => setProfileOpen((open) => !open)}
            aria-label="Profile menu"
            aria-expanded={profileOpen}
          >
            <span aria-hidden="true">AB</span>
            <span className="sr-only">Profile</span>
          </button>
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-40 rounded-md border border-[var(--border)] bg-white shadow-lg z-50">
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
