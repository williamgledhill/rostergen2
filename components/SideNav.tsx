"use client";
import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  type LucideIcon,
  Users,
  FolderOpen,
  Pencil,
  Settings,
} from "lucide-react";
import { buildEditorHref, LAST_EDITOR_DATE_EVENT, LAST_EDITOR_DATE_STORAGE_KEY, isLocalDateId } from "@/lib/editorPersistence";

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
    ? `group flex min-h-[92px] w-full flex-col items-center justify-center gap-2.5 rounded-[18px] px-2 py-3 text-center transition-all duration-200 ${
        active
          ? "bg-[rgba(52,77,232,0.08)] text-[#22305a]"
          : "text-[#3d4865] hover:bg-[#f4f6fb] hover:text-[#22305a]"
      }`
    : `group flex min-h-[60px] w-full items-center gap-3.5 rounded-[16px] px-4 py-2.5 text-left transition-all duration-200 ${
        active
          ? "bg-[rgba(52,77,232,0.08)] text-[#22305a]"
          : "text-[#3d4865] hover:bg-[#f4f6fb] hover:text-[#22305a]"
      }`;
  const iconWrapClassName = `grid h-11 w-11 shrink-0 place-items-center rounded-full border transition-all duration-200 ${
    active
      ? "border-[var(--accent)] bg-[var(--accent)] text-white"
      : "border-[#e7ebf3] bg-[#fafbfe] text-[#48536f] group-hover:border-[#d8dfec] group-hover:bg-[#f3f6fd] group-hover:text-[#22305a]"
  }`;
  const labelClassName = collapsed
    ? "block w-full text-center text-[13px] font-medium leading-[1.15] text-current"
    : "text-[15px] font-medium leading-none text-current";

  if (collapsed) {
    return (
      <Link
        href={href}
        prefetch={true}
        onClick={onClick}
        className={linkClassName}
        title={label}
      >
        <span className={iconWrapClassName}>
          <Icon className="h-[19px] w-[19px]" aria-hidden="true" />
        </span>
        <span className={labelClassName}>{label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      prefetch={true}
      onClick={onClick}
      className={linkClassName}
      title={label}
    >
      <span className={iconWrapClassName}>
        <Icon className="h-[19px] w-[19px]" aria-hidden="true" />
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
  const pathname = usePathname() || "/";
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
    { icon: Users, label: "People", href: "/people", matchPrefix: "/people" },
    { icon: FolderOpen, label: "Tasks", href: "/tasks", matchPrefix: "/tasks" },
    { icon: Settings, label: "Settings", href: "/settings", matchPrefix: "/settings" },
  ];
  const asideWidth = collapsed ? "w-[90px]" : "w-[244px]";
  const asideVisibility = isOpen ? "block" : "hidden md:block";

  if (mobile && !isOpen) return null;

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
    ["/rosters", editorHref, "/people", "/tasks", "/settings"].forEach((href) => {
      router.prefetch(href);
    });
  }, [editorHref, router]);

  const asideClassName = mobile
    ? "fixed inset-x-0 bottom-0 left-0 top-14 z-50 w-[244px] overflow-y-auto border-r border-[#dfe4ee] bg-white pt-2 pb-3 shadow-xl"
    : `${asideVisibility} ${asideWidth} relative flex-shrink-0 overflow-visible border-r border-[#dfe4ee] bg-white pt-2 pb-3 transition-all duration-200 md:sticky md:top-14 md:h-[calc(100vh-56px)] md:overflow-y-auto`;

  return (
    <aside className={asideClassName}>
      <div className="flex h-full flex-col">
        <div className={`w-full ${collapsed ? "space-y-2.5 px-3 pt-3" : "space-y-1.5 px-2.5 pt-3"}`}>
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
          <div className={`mt-auto ${collapsed ? "px-2 pt-2" : "px-3 pt-4"}`}>
            {collapsed ? (
              <div className="h-0" aria-hidden="true" />
            ) : (
              <>
                <p className="text-center text-[12px] text-[#707991]">Powered by rostergenerator.app</p>
                <p className="mt-1 text-center text-[11px] text-[#707991]">Copyright William Gledhill 2026 (excluding Mint Logo).</p>
              </>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}
