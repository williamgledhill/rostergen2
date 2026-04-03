"use client";
import React, { useState, useCallback, useEffect } from "react";
import SideNav from "@/components/SideNav";
import { NavProvider } from "@/components/NavContext";
import GlobalTopBar from "@/components/GlobalTopBar";
import { usePathname, useRouter } from "next/navigation";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sessionName, setSessionName] = useState<string | null>(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const toggleNav = useCallback(() => setNavOpen((o) => !o), []);
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = pathname === "/" || pathname.startsWith("/signup");
  const isWidePage = pathname === "/editor" || pathname.startsWith("/rosters/");

  useEffect(() => {
    if (isPublic) {
      setSessionName(null);
      setSessionChecked(false);
      return;
    }
    if (sessionChecked) return;
    let active = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { session: null }))
      .then((data) => {
        if (!active) return;
        const session = data?.session;
        if (!session?.user) {
          router.replace(`/signup?next=${encodeURIComponent(pathname)}`);
          return;
        }
        setSessionName(typeof session.user.name === "string" ? session.user.name : null);
        setSessionChecked(true);
      })
      .catch(() => {
        if (!active) return;
        router.replace(`/signup?next=${encodeURIComponent(pathname)}`);
      });
    return () => {
      active = false;
    };
  }, [isPublic, pathname, router, sessionChecked]);

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
      <div className="relative min-h-screen flex bg-[#f5f6fa]">
        {isMobile && navOpen && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/30"
            aria-label="Close navigation menu"
            onClick={() => setNavOpen(false)}
          />
        )}
        <SideNav
          open={navOpen}
          mobile={isMobile}
          onNavigate={() => {
            if (isMobile) setNavOpen(false);
          }}
        />
        <div className="flex min-h-screen flex-1 flex-col bg-[#f5f6fa]">
          <GlobalTopBar userName={sessionName} />
          <main className={isWidePage ? "px-2 py-3 sm:px-3 sm:py-4 md:px-5 md:py-5" : "px-2 py-3 sm:px-3 sm:py-4 md:px-6 md:py-5"}>
            <div className="w-full space-y-4">
              {children}
            </div>
          </main>
        </div>
      </div>
    </NavProvider>
  );
}
