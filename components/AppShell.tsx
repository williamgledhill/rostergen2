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
    return <main className="min-h-screen bg-white">{children}</main>;
  }

  if (!authReady) {
    return <div className="min-h-screen bg-white" />;
  }

  return (
    <NavProvider value={{ navOpen, toggleNav }}>
      <div className="min-h-screen flex">
        <SideNav open={navOpen} />
        <div className="flex-1 flex flex-col bg-white">
          <GlobalTopBar />
          <main className={isWidePage ? "px-3 pb-8" : "px-6 pb-8"}>
            <div className={isWidePage ? "w-full space-y-6" : "w-full max-w-[1000px] mx-auto space-y-6"}>
              {children}
            </div>
          </main>
        </div>
      </div>
    </NavProvider>
  );
}
