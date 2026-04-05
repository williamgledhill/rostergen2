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
  const [navOpen, setNavOpen] = useState(false);
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
    return <main className="min-h-screen bg-[var(--surface)]">{children}</main>;
  }

  return (
    <NavProvider value={{ navOpen, toggleNav }}>
      <div className="relative min-h-screen bg-white">
        <GlobalTopBar userName={initialUserName ?? null} />
        {isMobile && navOpen && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/30"
            aria-label="Close navigation menu"
            onClick={() => setNavOpen(false)}
          />
        )}
        <div className="flex min-h-[calc(100vh-56px)] bg-white">
          <SideNav
            open={navOpen}
            mobile={isMobile}
            onNavigate={() => {
              if (isMobile) setNavOpen(false);
            }}
          />
          <div className="flex min-h-[calc(100vh-56px)] flex-1 flex-col bg-white">
          <main className="px-2 py-3 sm:px-3 sm:py-4 md:px-6 md:py-5">
            <div className="w-full space-y-4">
              {children}
            </div>
          </main>
          </div>
        </div>
      </div>
    </NavProvider>
  );
}
