"use client";
import React, { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import GlobalTopBar from "@/components/GlobalTopBar";
import { NavProvider } from "@/components/NavContext";
import SideNav from "@/components/SideNav";
import { FeedbackProvider } from "@/components/ui/Feedback";

const NAV_COLLAPSED_STORAGE_KEY = "rosterplanner:nav-collapsed";

export default function AppShell({
  children,
  initialUserName,
}: {
  children: React.ReactNode;
  initialUserName?: string | null;
}) {
  const [navOpen, setNavOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const pathname = usePathname();
  const isPublic = pathname === "/" || pathname.startsWith("/signup");

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const sync = () => {
      setIsMobile(mediaQuery.matches);
      if (mediaQuery.matches) {
        setNavOpen(false);
      } else {
        try {
          setNavOpen(window.localStorage.getItem(NAV_COLLAPSED_STORAGE_KEY) !== "true");
        } catch {
          setNavOpen(true);
        }
      }
    };
    sync();
    mediaQuery.addEventListener("change", sync);
    return () => mediaQuery.removeEventListener("change", sync);
  }, []);

  const toggleNav = useCallback(() => {
    setNavOpen((open) => {
      if (!isMobile) {
        try {
          window.localStorage.setItem(NAV_COLLAPSED_STORAGE_KEY, String(open));
        } catch {
          // Storage can be unavailable; the toggle still works for this visit.
        }
      }
      return !open;
    });
  }, [isMobile]);

  if (isPublic) {
    return <main className="min-h-screen bg-[var(--surface)]">{children}</main>;
  }

  return (
    <NavProvider value={{ navOpen, toggleNav }}>
      <FeedbackProvider>
        <div className="min-h-screen bg-[var(--canvas)]">
          <GlobalTopBar userName={initialUserName ?? null} />
          {isMobile && navOpen && (
            <button
              type="button"
              className="fixed inset-0 top-14 z-40 bg-slate-900/30"
              aria-label="Close navigation menu"
              onClick={() => setNavOpen(false)}
            />
          )}
          <div className="flex">
            <SideNav open={navOpen} mobile={isMobile} onNavigate={() => setNavOpen(false)} />
            <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
          </div>
        </div>
      </FeedbackProvider>
    </NavProvider>
  );
}
