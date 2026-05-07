"use client";
import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ClipboardList,
  type LucideIcon,
  Pencil,
  Route,
  Settings,
  UsersRound,
} from "lucide-react";
import { buildEditorHref, LAST_EDITOR_DATE_EVENT, LAST_EDITOR_DATE_STORAGE_KEY, isLocalDateId } from "@/lib/editorPersistence";
import { navigateWithinSpa, shouldHandleSpaClick, useSpaLocation } from "@/lib/spaNavigation";
import { preloadWorkspaceRoute } from "@/lib/workspaceData";

const Item = ({
  icon: Icon,
  label,
  href,
  active = false,
  collapsed = false,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  href: string;
  active?: boolean;
  collapsed?: boolean;
  onClick?: () => void;
}) => {
  const linkClassName = collapsed
    ? `group flex h-12 w-full flex-col items-center justify-center gap-1 rounded-[12px] px-2 text-center transition-all duration-200 ${
        active
          ? "bg-[var(--accent-soft)] text-[var(--accent)]"
          : "text-[var(--ink)] hover:bg-[rgba(255,254,253,0.74)] hover:text-[var(--accent)]"
      }`
    : `group flex h-12 w-full items-center gap-3 rounded-[14px] px-4 text-left transition-all duration-200 ${
        active
          ? "bg-[#ece8f2] text-[var(--accent)]"
          : "text-[var(--ink)] hover:bg-[rgba(255,254,253,0.68)] hover:text-[var(--accent)]"
      }`;
  const labelClassName = collapsed
    ? "block w-full text-center text-[11px] font-semibold leading-[1.15] text-current"
    : "text-[14px] font-semibold leading-none text-current";

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (shouldHandleSpaClick(event) && navigateWithinSpa(href)) {
      event.preventDefault();
      onClick?.();
      return;
    }
    onClick?.();
  };

  const handlePrefetch = () => preloadWorkspaceRoute(href);

  return (
    <Link
      href={href}
      prefetch={true}
      onClick={handleClick}
      onMouseEnter={handlePrefetch}
      onFocus={handlePrefetch}
      className={linkClassName}
      title={label}
    >
      <span className="grid h-5 w-5 shrink-0 place-items-center text-current">
        <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <span className={labelClassName}>{label}</span>
    </Link>
  );
};

export default function SideNav({
  open = true,
  mobile = false,
  onNavigate,
}: {
  open?: boolean;
  mobile?: boolean;
  onNavigate?: () => void;
}){
  const { pathname } = useSpaLocation();
  const router = useRouter();
  const [editorHref, setEditorHref] = React.useState("/editor");
  const isOpen = open;
  const collapsed = mobile ? false : !isOpen;

  const rostersActive = pathname.startsWith("/rosters");
  const rosterItems = [
    { icon: CalendarDays, label: "Rosters", href: "/rosters", active: rostersActive },
  ];
  const navItems = [
    { icon: Pencil, label: "Editor", href: editorHref, matchPrefix: "/editor" },
    { icon: Route, label: "Tours", href: "/tours", matchPrefix: "/tours" },
    { icon: ClipboardList, label: "Tasks", href: "/tasks", matchPrefix: "/tasks" },
    { icon: UsersRound, label: "Staff", href: "/people", matchPrefix: "/people" },
    { icon: Settings, label: "Settings", href: "/settings", matchPrefix: "/settings" },
  ];
  const asideWidth = collapsed ? "w-[78px]" : "w-[260px]";
  const asideVisibility = isOpen ? "block" : "hidden md:block";

  React.useEffect(() => {
    const syncEditorHref = () => {
      const rememberedDate = typeof window !== "undefined" ? window.localStorage.getItem(LAST_EDITOR_DATE_STORAGE_KEY) : null;
      setEditorHref(buildEditorHref(isLocalDateId(rememberedDate) ? rememberedDate : null));
    };

    syncEditorHref();
    window.addEventListener("storage", syncEditorHref);
    window.addEventListener(LAST_EDITOR_DATE_EVENT, syncEditorHref as EventListener);
    return () => {
      window.removeEventListener("storage", syncEditorHref);
      window.removeEventListener(LAST_EDITOR_DATE_EVENT, syncEditorHref as EventListener);
    };
  }, []);

  React.useEffect(() => {
    ["/rosters", editorHref, "/tours", "/people", "/tasks", "/settings"].forEach((href) => {
      preloadWorkspaceRoute(href);
      router.prefetch(href);
    });
  }, [editorHref, router]);

  const asideClassName = mobile
    ? "fixed bottom-0 left-0 top-14 z-50 w-[260px] overflow-y-auto border-r border-[var(--border)] bg-[var(--app-bg)] pb-5 shadow-xl"
    : `${asideVisibility} ${asideWidth} relative flex-shrink-0 overflow-visible border-r border-[var(--border)] bg-[var(--app-bg)] pb-7 transition-all duration-200 md:sticky md:top-0 md:h-screen md:overflow-y-auto`;

  if (mobile && !isOpen) return null;

  return (
    <aside className={asideClassName}>
      <div className="flex h-full flex-col">
        <div className={`flex h-20 items-center ${collapsed ? "justify-center px-2" : "gap-3 px-6"}`}>
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[var(--accent)] font-serif text-[20px] font-bold text-white">
            RG
          </div>
          {!collapsed && (
            <div className="font-serif text-[14px] font-bold uppercase leading-[1.08] tracking-[0.02em] text-[var(--ink)]">
              <div>Roster</div>
              <div>Generator</div>
            </div>
          )}
        </div>

        <div className={`w-full ${collapsed ? "space-y-1.5 px-2 pt-1" : "space-y-1.5 px-4 pt-3"}`}>
          {rosterItems.map((item) => (
            <Item key={item.label} {...item} collapsed={collapsed} onClick={mobile ? onNavigate : undefined} />
          ))}
          {navItems.map((item) => {
            const { matchPrefix, ...navItemProps } = item;
            const isActive = pathname.startsWith(matchPrefix);
            return (
              <Item
                key={navItemProps.href}
                {...navItemProps}
                active={isActive}
                collapsed={collapsed}
                onClick={mobile ? onNavigate : undefined}
              />
            );
          })}
        </div>
        {!mobile && (
          <div className={`mt-auto ${collapsed ? "px-2 pt-2" : "px-6 pt-6"}`}>
            {collapsed ? (
              <div className="h-0" aria-hidden="true" />
            ) : (
              <>
                <div className="mb-6 space-y-2 text-[13px] leading-5 text-[var(--ink)]">
                  <p className="font-bold">Roster magic, on autopilot</p>
                  <p className="text-[var(--muted-strong)]">
                    Save time. Stay organised.
                    <br />
                    Focus on your people.
                  </p>
                </div>
                <div className="border-t border-[var(--border)] pt-5 text-[12px] leading-6 text-[var(--muted-strong)]">
                  <p>Powered by rostergenerator.app</p>
                  <p>(c) 2026 William Gledhill</p>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
