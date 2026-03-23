"use client";
import React, { useState, useCallback, useEffect } from "react";
import SideNav from "@/components/SideNav";
import { NavProvider } from "@/components/NavContext";
import GlobalTopBar from "@/components/GlobalTopBar";
import { usePathname, useRouter } from "next/navigation";

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(true);
  const toggleNav = useCallback(() => setNavOpen((o) => !o), []);
  const pathname = usePathname();
  const router = useRouter();
  const isPublic = pathname === "/" || pathname.startsWith("/signup");
  const isWidePage = pathname === "/editor" || pathname.startsWith("/rosters/");
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    if (isPublic) {
      setAuthReady(true);
      return;
    }
    let active = true;
    fetch("/api/auth/session")
      .then((res) => (res.ok ? res.json() : { session: null }))
      .then((data) => {
        if (!active) return;
        if (!data?.session) {
          router.replace("/");
          return;
        }
        setAuthReady(true);
      })
      .catch(() => {
        if (!active) return;
        router.replace("/");
      });
    return () => {
      active = false;
    };
  }, [isPublic, pathname, router]);

  if (isPublic) {
    return <main className="min-h-screen bg-[var(--surface)]">{children}</main>;
  }

  if (!authReady) {
    return <div className="min-h-screen bg-[var(--surface)]" />;
  }

  return (
    <NavProvider value={{ navOpen, toggleNav }}>
      <div className="min-h-screen flex bg-[#f5f6fa]">
        <SideNav open={navOpen} />
        <div className="flex min-h-screen flex-1 flex-col bg-[#f5f6fa]">
          <GlobalTopBar />
          <main className={isWidePage ? "px-4 py-4 md:px-5 md:py-5" : "px-4 py-4 md:px-6 md:py-5"}>
            <div className="w-full space-y-4">
              {children}
            </div>
          </main>
        </div>
      </div>
    </NavProvider>
  );
}
