"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Menu, Settings, MessageCircleQuestion, Plus } from "lucide-react";
import { useNav } from "@/components/NavContext";

export default function GlobalTopBar() {
  const { navOpen, toggleNav } = useNav();
  const pathname = usePathname();
  const isSettings = pathname === "/settings";
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

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
    <header className="h-16 bg-white flex items-center relative px-6 border-b border-[#E6EAF0]">
      <div className="w-full flex items-center gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <button
            className="btn px-2 py-2 md:hidden"
            onClick={toggleNav}
            aria-label="Toggle navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="w-full max-w-[420px]">
            <label className="sr-only" htmlFor="global-search">Search</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Search className="w-4 h-4" aria-hidden="true" />
              </span>
              <input
                id="global-search"
                placeholder="Search"
                className="w-full h-10 pl-10 pr-4 bg-[#f5f7fa] text-sm text-slate-600 placeholder:text-slate-500 border border-transparent shadow-none focus:outline-none focus:ring-0"
                style={{ borderRadius: "var(--radius-md)" }}
                type="search"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <button
            className="p-2 rounded-full hover:bg-[#f5f7fa] text-slate-600"
            aria-label="Help"
            title="Help"
          >
            <MessageCircleQuestion className="w-5 h-5" />
          </button>
          <Link
            href="/rosters"
            className="p-2 rounded-full bg-[rgb(103,93,255)] hover:bg-[#594eea] text-white"
            aria-label="Go to rosters"
            title="Go to rosters"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
          </Link>
          <Link
            href="/settings"
            className={`p-2 rounded-full hover:bg-[#f5f7fa] ${isSettings ? "text-[#675dff]" : "text-slate-600"}`}
            aria-label="Settings"
            title="Settings"
          >
            <Settings className="w-5 h-5" />
          </Link>
          <div className="relative" ref={profileRef}>
            <button
              className="w-10 h-10 rounded-full border border-[var(--border)] overflow-hidden bg-slate-200 grid place-items-center text-sm font-semibold shadow-sm"
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
      </div>
    </header>
  );
}
