"use client";
import React, { useState, useCallback, useEffect } from "react";
import SideNav from "@/components/SideNav";
import { NavProvider } from "@/components/NavContext";
import GlobalTopBar from "@/components/GlobalTopBar";
import { usePathname } from "next/navigation";

export default function AppShell({
  children,
  initialUserName,
}: {
  children: React.ReactNode;
  initialUserName?: string | null;
}) {
  const [navOpen, setNavOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const toggleNav = useCallback(() => setNavOpen((o) => !o), []);
  const pathname = usePathname();
  const isPublic = pathname === "/" || pathname.startsWith("/signup");

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const onChange = () => setIsMobile(mediaQuery.matches);
    onChange();
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (isMobile) {
      setNavOpen(false);
    }
  }, [isMobile]);

  if (isPublic) {
    return <main className="min-h-screen bg-[var(--app-bg)]">{children}</main>;
  }

  return (
    <NavProvider value={{ navOpen, toggleNav }}>
      <div className="relative min-h-screen bg-[var(--app-bg)] text-[var(--ink)]">
        <div className="flex min-h-screen">
          <SideNav
            open={navOpen}
            mobile={isMobile}
            onNavigate={() => {
              if (isMobile) setNavOpen(false);
            }}
          />
          <div className="flex min-w-0 flex-1 flex-col">
            <GlobalTopBar userName={initialUserName ?? null} />
            {isMobile && navOpen && (
              <button
                type="button"
                className="fixed inset-0 z-40 bg-black/30"
                aria-label="Close navigation menu"
                onClick={() => setNavOpen(false)}
              />
            )}
            <main className="workspace-main">
              <div className="workspace-container">{children}</div>
            </main>
          </div>
        </div>
      </div>
    </NavProvider>
  );
}
