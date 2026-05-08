"use client";
import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronsLeft,
  ChevronsRight,
  ClipboardList,
  type LucideIcon,
  Pencil,
  Route,
  Settings,
  WandSparkles,
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
    ? `group flex min-h-[54px] w-full flex-col items-center justify-center gap-1 rounded-[8px] px-2 text-center transition-all duration-200 ${
        active
          ? "bg-[var(--accent-soft)] text-[var(--accent)]"
          : "text-[var(--ink)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
      }`
    : `group flex h-[52px] w-full items-center gap-4 rounded-[8px] px-4 text-left transition-all duration-200 ${
        active
          ? "bg-[var(--accent-soft)] text-[var(--accent)]"
          : "text-[var(--ink)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)]"
      }`;
  const labelClassName = collapsed
    ? "block w-full text-center text-[11px] font-semibold leading-[1.15] text-current"
    : "text-[15px] font-semibold leading-none text-current";

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
      <span className="grid h-6 w-6 shrink-0 place-items-center text-current">
        <Icon className="h-[21px] w-[21px]" aria-hidden="true" />
      </span>
      <span className={labelClassName}>{label}</span>
    </Link>
  );
};

export default function SideNav({
  open = true,
  mobile = false,
  onNavigate,
  onToggleNav,
}: {
  open?: boolean;
  mobile?: boolean;
  onNavigate?: () => void;
  onToggleNav?: () => void;
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
  const asideWidth = collapsed ? "w-[76px]" : "w-[286px]";
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
    ? "fixed bottom-0 left-0 top-[74px] z-50 w-[286px] overflow-y-auto border-r border-[var(--border)] bg-white pb-5 shadow-xl"
    : `${asideVisibility} ${asideWidth} relative flex-shrink-0 overflow-visible border-r border-[var(--border)] bg-white pb-7 transition-all duration-200 md:sticky md:top-0 md:h-screen md:overflow-y-auto`;

  if (mobile && !isOpen) return null;

  return (
    <aside className={asideClassName}>
      <div className="flex h-full flex-col">
        <div className={`flex h-[84px] items-center ${collapsed ? "justify-center px-2" : "gap-4 px-6"}`}>
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[8px] bg-[var(--accent)] text-[20px] font-bold text-white shadow-[0_10px_24px_rgba(6,26,88,0.16)]">
            RG
          </div>
          {!collapsed && (
            <div className="text-[16px] font-bold leading-[1.15] text-[var(--ink)]">
              <div>Roster</div>
              <div>Generator</div>
            </div>
          )}
        </div>

        <div className={`w-full ${collapsed ? "space-y-1.5 px-2 pt-3" : "space-y-2 px-5 pt-5"}`}>
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
          <div className={`mt-auto ${collapsed ? "px-2 pt-2" : "px-5 pt-6"}`}>
            {collapsed ? (
              <div className="h-16" aria-hidden="true" />
            ) : (
              <>
                <div className="mb-7 rounded-[8px] border border-[var(--border)] bg-white px-4 py-4 shadow-[0_10px_28px_rgba(6,26,77,0.035)]">
                  <div className="flex items-center gap-3 text-[13px] font-bold text-[var(--accent)]">
                    <WandSparkles className="h-5 w-5" aria-hidden="true" />
                    <span>Roster magic, on autopilot</span>
                  </div>
                  <p className="mt-4 text-[14px] font-medium leading-6 text-[var(--muted-strong)]">
                    Save time. Stay organised.
                    <br />
                    Focus on your people.
                  </p>
                </div>
                <div className="space-y-2 text-[12px] leading-5 text-[var(--muted-strong)]">
                  <p>Powered by rostergenerator.app</p>
                  <p>(c) 2026 William Gledhill</p>
                </div>
              </>
            )}
          </div>
        )}
      </div>
      {!mobile && onToggleNav && (
        <button
          type="button"
          className="absolute bottom-6 right-0 grid h-11 w-11 translate-x-1/2 place-items-center rounded-full border border-[var(--border)] bg-white text-[var(--accent)] shadow-[0_8px_22px_rgba(6,26,77,0.08)] transition hover:bg-[var(--accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(6,26,88,0.14)]"
          onClick={onToggleNav}
          aria-label={collapsed ? "Expand navigation" : "Collapse navigation"}
          title={collapsed ? "Expand navigation" : "Collapse navigation"}
        >
          {collapsed ? <ChevronsRight className="h-5 w-5" /> : <ChevronsLeft className="h-5 w-5" />}
        </button>
      )}
    </aside>
  );
}
