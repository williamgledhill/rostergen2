"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, FolderOpen, Map as MapIcon, Pencil, Settings, Users, type LucideIcon } from "lucide-react";
import SpaLink from "@/components/ui/SpaLink";
import { buildEditorHref, LAST_EDITOR_DATE_EVENT, LAST_EDITOR_DATE_STORAGE_KEY, isLocalDateId } from "@/lib/editorPersistence";
import { useSpaLocation } from "@/lib/spaNavigation";
import { preloadWorkspaceRoute } from "@/lib/workspaceData";

function NavItem({
  icon: Icon,
  label,
  href,
  active,
  collapsed,
  onNavigate,
}: {
  icon: LucideIcon;
  label: string;
  href: string;
  active: boolean;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  return (
    <SpaLink
      href={href}
      onNavigate={onNavigate}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={`group flex h-10 items-center gap-3 rounded-[var(--radius-md)] text-[14px] font-medium transition-colors ${
        collapsed ? "w-10 justify-center" : "px-3"
      } ${
        active
          ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
          : "text-[var(--text-muted)] hover:bg-[var(--surface-muted)] hover:text-[var(--text)]"
      }`}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
      {collapsed ? <span className="sr-only">{label}</span> : label}
    </SpaLink>
  );
}

export default function SideNav({
  open = true,
  mobile = false,
  onNavigate,
}: {
  open?: boolean;
  mobile?: boolean;
  onNavigate?: () => void;
}) {
  const { pathname } = useSpaLocation();
  const router = useRouter();
  const [editorHref, setEditorHref] = React.useState("/editor");
  // On desktop the menu button collapses the sidebar to icons; on mobile it opens a drawer.
  const collapsed = !mobile && !open;

  React.useEffect(() => {
    const syncEditorHref = () => {
      const rememberedDate = window.localStorage.getItem(LAST_EDITOR_DATE_STORAGE_KEY);
      setEditorHref(buildEditorHref(isLocalDateId(rememberedDate) ? rememberedDate : null));
    };
    syncEditorHref();
    window.addEventListener("storage", syncEditorHref);
    window.addEventListener(LAST_EDITOR_DATE_EVENT, syncEditorHref);
    return () => {
      window.removeEventListener("storage", syncEditorHref);
      window.removeEventListener(LAST_EDITOR_DATE_EVENT, syncEditorHref);
    };
  }, []);

  React.useEffect(() => {
    ["/rosters", editorHref, "/people", "/tasks", "/tours", "/settings"].forEach((href) => {
      preloadWorkspaceRoute(href);
      router.prefetch(href);
    });
  }, [editorHref, router]);

  // Must come after every hook: returning earlier changes the hook count when
  // the layout switches between mobile and desktop, which crashes React.
  if (mobile && !open) return null;

  const items = [
    { icon: CalendarDays, label: "Rosters", href: "/rosters", matchPrefix: "/rosters" },
    { icon: Pencil, label: "Editor", href: editorHref, matchPrefix: "/editor" },
    { icon: Users, label: "People", href: "/people", matchPrefix: "/people" },
    { icon: FolderOpen, label: "Tasks", href: "/tasks", matchPrefix: "/tasks" },
    { icon: MapIcon, label: "Tours", href: "/tours", matchPrefix: "/tours" },
    { icon: Settings, label: "Settings", href: "/settings", matchPrefix: "/settings" },
  ];

  const nav = (
    <nav className={`flex h-full flex-col gap-1 py-3 ${collapsed ? "items-center px-2" : "px-3"}`} aria-label="Main">
      {items.map(({ matchPrefix, ...item }) => (
        <NavItem
          key={item.label}
          {...item}
          active={pathname.startsWith(matchPrefix) || (matchPrefix === "/rosters" && pathname === "/")}
          collapsed={collapsed}
          onNavigate={mobile ? onNavigate : undefined}
        />
      ))}
      {!collapsed && (
        <p className="mt-auto px-3 pt-6 text-[11.5px] leading-relaxed text-[var(--text-faint)]">
          Powered by rostergenerator.app
          <br />© William Gledhill 2026 (excluding Mint logo)
        </p>
      )}
    </nav>
  );

  if (mobile) {
    return (
      <aside className="dialog-enter fixed bottom-0 left-0 top-14 z-50 w-[248px] overflow-y-auto border-r border-[var(--border)] bg-white shadow-[var(--shadow-lg)]">
        {nav}
      </aside>
    );
  }

  // The outer column stretches with the page so the white panel reaches the
  // bottom; the menu itself stays pinned under the top bar.
  return (
    <aside
      className={`hidden shrink-0 border-r border-[var(--border)] bg-white transition-[width] duration-200 md:block ${
        collapsed ? "w-[64px]" : "w-[228px]"
      }`}
    >
      <div className="sticky top-14 h-[calc(100vh-56px)] overflow-y-auto">{nav}</div>
    </aside>
  );
}
