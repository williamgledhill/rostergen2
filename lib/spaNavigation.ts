"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

export const SPA_NAVIGATION_EVENT = "rosterplanner:spa-navigation";

function readBrowserLocation() {
  if (typeof window === "undefined") return { pathname: "/", search: "" };
  return {
    pathname: window.location.pathname || "/",
    search: window.location.search.replace(/^\?/, ""),
  };
}

export function canNavigateWithinSpa(href: string) {
  if (typeof window === "undefined") return false;
  const url = new URL(href, window.location.href);
  if (url.origin !== window.location.origin) return false;
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/_next")) return false;
  if (url.pathname === "/" || url.pathname === "/signup" || url.pathname.startsWith("/signup/")) return false;
  return true;
}

export function navigateWithinSpa(href: string, options?: { replace?: boolean; scroll?: boolean }) {
  if (!canNavigateWithinSpa(href)) return false;

  const url = new URL(href, window.location.href);
  const next = `${url.pathname}${url.search}${url.hash}`;
  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (next === current) return true;

  if (options?.replace) {
    window.history.replaceState(null, "", next);
  } else {
    window.history.pushState(null, "", next);
  }
  window.dispatchEvent(new CustomEvent(SPA_NAVIGATION_EVENT, { detail: { href: next } }));
  if (options?.scroll !== false) {
    if (url.hash) {
      window.setTimeout(() => {
        document.getElementById(decodeURIComponent(url.hash.slice(1)))?.scrollIntoView();
      }, 0);
    } else {
      window.scrollTo(0, 0);
    }
  }
  return true;
}

export function shouldHandleSpaClick(event: {
  button: number;
  defaultPrevented: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
}) {
  return (
    !event.defaultPrevented &&
    event.button === 0 &&
    !event.metaKey &&
    !event.ctrlKey &&
    !event.shiftKey &&
    !event.altKey
  );
}

export function useSpaLocation() {
  const pathname = usePathname() || "/";
  const searchParams = useSearchParams();
  const search = searchParams.toString();
  const [location, setLocation] = useState(() => ({ pathname, search }));

  useEffect(() => {
    setLocation({ pathname, search });
  }, [pathname, search]);

  useEffect(() => {
    const sync = () => setLocation(readBrowserLocation());
    window.addEventListener("popstate", sync);
    window.addEventListener(SPA_NAVIGATION_EVENT, sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener(SPA_NAVIGATION_EVENT, sync);
    };
  }, []);

  return location;
}
