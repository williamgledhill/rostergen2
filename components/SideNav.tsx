"use client";
import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Users, FolderOpen, Clock, Pencil, Settings, ChevronDown, ChevronLeft } from "lucide-react";
import { formatLocalId } from "@/lib/dateUtils";
import { useNav } from "@/components/NavContext";

const Item = ({
  icon: Icon,
  label,
  href,
  active = false,
  collapsed = false,
}: {
  icon: any;
  label: string;
  href: string;
  active?: boolean;
  collapsed?: boolean;
}) => {
  const layout = collapsed ? "justify-center px-2" : "justify-start gap-2.5 px-3";
  const base = `inline-flex w-full items-center rounded-md py-[7px] text-left transition font-normal ${layout}`;
  const state = active
    ? "text-[#5a31f4] hover:bg-[#f5f7fb] font-semibold"
    : "text-slate-700 hover:bg-[#f5f7fb]";
  return (
    <Link href={href} className={`${base} ${state}`} title={collapsed ? label : undefined}>
      <Icon className={`w-4 h-4 shrink-0 ${active ? "text-[#5a31f4]" : "text-slate-500"}`} aria-hidden="true" />
      <span className={collapsed ? "sr-only" : "text-[14px] leading-5"}>{label}</span>
    </Link>
  );
};

export default function SideNav({ open = true }: { open?: boolean }){
  const pathname = usePathname() || "/";
  const nav = useNav();
  const isOpen = open;
  const [rostersOpen, setRostersOpen] = useState(pathname.startsWith("/rosters"));
  const [accountOpen, setAccountOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const navItems = [
    { icon: Pencil, label: "Editor", href: "/editor" },
    { icon: Users, label: "People", href: "/people" },
    { icon: FolderOpen, label: "Tasks", href: "/tasks" },
    { icon: Clock, label: "History", href: "/history" },
    { icon: Settings, label: "Settings", href: "/settings" },
  ];

  useEffect(() => {
    if (pathname.startsWith("/rosters")) {
      setRostersOpen(true);
    }
  }, [pathname]);

  const rostersActive = pathname.startsWith("/rosters");
  const todayHref = `/editor?date=${encodeURIComponent(formatLocalId(new Date()))}`;
  const todayActive = pathname.startsWith("/editor");
  const rosterBase = "flex items-center rounded-md py-[7px] transition";
  const rosterState = rostersActive
    ? "text-[#5a31f4] hover:bg-[#f5f7fb]"
    : "text-slate-700 hover:bg-[#f5f7fb]";
  const rosterLayout = isOpen ? "justify-between px-3" : "justify-center px-2";
  const showSubmenu = isOpen && rostersOpen;
  const asideWidth = isOpen ? "w-[220px]" : "w-[64px]";
  const asidePadding = isOpen ? "px-5" : "px-3";
  const asideVisibility = isOpen ? "block" : "hidden md:block";

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!accountRef.current) return;
      if (accountRef.current.contains(e.target as Node)) return;
      setAccountOpen(false);
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
    <aside
      className={`${asideVisibility} ${asideWidth} ${asidePadding} flex-shrink-0 border-r border-[#E6EAF0] pt-6 pb-4 bg-[var(--surface)] md:sticky md:top-0 md:h-screen md:overflow-y-auto transition-all duration-200 relative overflow-visible`}
    >
      <button
        type="button"
        className="hidden md:flex items-center justify-center h-9 w-9 rounded-lg border border-[#CBD5E1] bg-white shadow-md hover:bg-[#f5f7fa] absolute top-1/2 -right-4 -translate-y-1/2"
        onClick={nav.toggleNav}
        aria-label={isOpen ? "Collapse sidebar" : "Expand sidebar"}
        title={isOpen ? "Collapse" : "Expand"}
      >
        <ChevronLeft className={`w-4 h-4 text-slate-500 transition ${isOpen ? "" : "rotate-180"}`} />
      </button>
      <div className="mb-5 relative" ref={accountRef}>
        <button
          className={`w-full flex items-center rounded-md bg-[#f5f7fa] text-slate-800 font-semibold ${isOpen ? "justify-between px-3 py-2" : "justify-center px-2 py-2"}`}
          aria-label="Business selector"
          aria-expanded={accountOpen}
          onClick={() => setAccountOpen((openState) => !openState)}
        >
          <span className="inline-flex items-center gap-2">
            <span className="w-7 h-7 rounded-md bg-slate-200 grid place-items-center text-sm font-semibold text-slate-700">M</span>
            {isOpen && <span className="text-[14px] font-normal">Mint</span>}
          </span>
          {isOpen && <ChevronDown className="w-4 h-4 text-slate-500" aria-hidden="true" />}
        </button>
        {accountOpen && isOpen && (
          <div className="absolute left-0 mt-2 w-full rounded-md border border-[var(--border)] bg-white shadow-lg z-50">
            <button
              className="w-full text-left px-3 py-2 text-sm text-slate-700 hover:bg-[#f5f7fa]"
              onClick={handleLogout}
            >
              Log out
            </button>
          </div>
        )}
      </div>
      <div className="space-y-[0.5px] w-full">
        <div className="space-y-[0.5px]">
          <div className={`${rosterBase} ${rosterState} ${rosterLayout}`}>
            <Link href="/rosters" className={`inline-flex items-center flex-1 ${isOpen ? "gap-2.5" : "justify-center"}`} title={isOpen ? undefined : "Rosters"}>
              <CalendarDays className={`w-4 h-4 shrink-0 ${rostersActive ? "text-[#5a31f4]" : "text-slate-500"}`} aria-hidden="true" />
              <span className={`text-[14px] leading-5 ${rostersActive ? "font-semibold" : "font-normal"} ${isOpen ? "" : "sr-only"}`}>Rosters</span>
            </Link>
            {isOpen && (
              <button
                type="button"
                className="ml-1 p-1 rounded hover:bg-[#eef1f6]"
                aria-label="Toggle rosters submenu"
                aria-expanded={rostersOpen}
                onClick={() => setRostersOpen((prev) => !prev)}
              >
                <ChevronDown className={`w-4 h-4 text-slate-500 transition ${rostersOpen ? "rotate-180" : ""}`} />
              </button>
            )}
          </div>
          {showSubmenu && (
            <div className="pl-7 space-y-[0.5px]">
              <Link
                href={todayHref}
                className={`inline-flex w-full items-center rounded-md px-3 py-[7px] text-[14px] leading-5 transition ${
                  todayActive
                    ? "text-[#5a31f4] bg-[#f5f7fb] font-semibold"
                    : "text-slate-700 hover:bg-[#f5f7fb] font-normal"
                }`}
              >
                Today
              </Link>
              <Link
                href="/rosters/archive"
                className={`inline-flex w-full items-center rounded-md px-3 py-[7px] text-[14px] leading-5 transition ${
                  pathname.startsWith("/rosters/archive")
                    ? "text-[#5a31f4] bg-[#f5f7fb] font-semibold"
                    : "text-slate-700 hover:bg-[#f5f7fb] font-normal"
                }`}
              >
                Archive
              </Link>
              <Link
                href="/rosters/bin"
                className={`inline-flex w-full items-center rounded-md px-3 py-[7px] text-[14px] leading-5 transition ${
                  pathname.startsWith("/rosters/bin")
                    ? "text-[#5a31f4] bg-[#f5f7fb] font-semibold"
                    : "text-slate-700 hover:bg-[#f5f7fb] font-normal"
                }`}
              >
                Bin
              </Link>
            </div>
          )}
        </div>
        {navItems.map((item) => {
          const isActive = item.href === "/editor" ? pathname.startsWith("/editor") : pathname.startsWith(item.href);
          return <Item key={item.href} {...item} active={isActive} collapsed={!isOpen} />;
        })}
      </div>
    </aside>
  );
}
