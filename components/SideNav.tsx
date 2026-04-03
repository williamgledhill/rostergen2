"use client";
import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  Users,
  FolderOpen,
  Pencil,
  Settings,
} from "lucide-react";

const Item = ({
  icon: Icon,
  label,
  href,
  active = false,
  collapsed = false,
  onClick,
}: {
  icon: any;
  label: string;
  href: string;
  active?: boolean;
  collapsed?: boolean;
  onClick?: () => void;
}) => {
  if (collapsed) {
    return (
      <Link
        href={href}
        prefetch={true}
        onClick={onClick}
        className={`flex min-h-[82px] w-full flex-col items-center justify-center gap-1.5 rounded-[12px] px-1 py-2 text-center transition ${
          active ? "text-[#3f4c84]" : "text-[#4b556b] hover:text-[#374151]"
        }`}
        title={label}
      >
        <span className={`grid h-10 w-10 place-items-center rounded-full ${active ? "bg-[#6b73ff]" : "bg-transparent"}`}>
          <Icon className={`h-4 w-4 ${active ? "text-white" : "text-[#6b768f]"}`} aria-hidden="true" />
        </span>
        <span className="block w-full text-center text-[12px] font-medium leading-[1.15] text-current">{label}</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      prefetch={true}
      onClick={onClick}
      className={`inline-flex h-10 w-full items-center gap-2.5 rounded-[12px] px-4 text-left transition ${
        active ? "bg-[#eceefe] text-[#3f4c84]" : "text-[#4b556b] hover:bg-[#f3f4f7]"
      }`}
      title={label}
    >
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full ${active ? "bg-white/90 shadow-sm" : "bg-transparent"}`}>
        <Icon className={`h-4 w-4 ${active ? "text-[#4a57a1]" : "text-[#6b768f]"}`} aria-hidden="true" />
      </span>
      <span className="text-[14px] font-medium leading-5">{label}</span>
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
  const isOpen = open;
  const collapsed = mobile ? false : !isOpen;

  const rostersActive = pathname.startsWith("/rosters");
  const editorActive = pathname.startsWith("/editor");
  const rosterItems = [
    { icon: CalendarDays, label: "Rosters", href: "/rosters", active: rostersActive },
  ];
  const navItems = [
    { icon: Pencil, label: "Editor", href: "/editor" },
    { icon: Users, label: "People", href: "/people" },
    { icon: FolderOpen, label: "Tasks", href: "/tasks" },
    { icon: Settings, label: "Settings", href: "/settings" },
  ];
  const asideWidth = collapsed ? "w-[86px]" : "w-[236px]";
  const asideVisibility = isOpen ? "block" : "hidden md:block";

  if (mobile && !isOpen) return null;

  React.useEffect(() => {
    ["/rosters", "/editor", "/people", "/tasks", "/settings"].forEach((href) => {
      router.prefetch(href);
    });
  }, [router]);

  const asideClassName = mobile
    ? "fixed inset-x-0 bottom-0 left-0 top-14 z-50 w-[236px] overflow-y-auto border-r border-[#e0e3ea] bg-white pt-3 pb-3 shadow-xl"
    : `${asideVisibility} ${asideWidth} relative flex-shrink-0 overflow-visible border-r border-[#e2e8f0] bg-white pt-3 pb-3 transition-all duration-200 md:sticky md:top-14 md:h-[calc(100vh-56px)] md:overflow-y-auto`;

  return (
    <aside className={asideClassName}>
      <div className="flex h-full flex-col">
        <div className={!collapsed ? "px-4 pt-2 pb-5" : "px-2 pt-3 pb-4"}>
          {!collapsed ? (
            <Link href="/rosters" prefetch={true} onClick={mobile ? onNavigate : undefined} className="block" title="Go to Rosters">
              <img
                src="/royal-australian-mint-logo.svg"
                alt="Australian Government Royal Australian Mint"
                className="mx-auto h-auto w-full max-w-[192px] object-contain"
              />
            </Link>
          ) : (
            <div className="h-1" aria-hidden="true" />
          )}
        </div>
        <div className={`w-full space-y-1 ${collapsed ? "px-2" : "px-2"}`}>
          {rosterItems.map((item) => (
            <Item key={item.label} {...item} collapsed={collapsed} onClick={mobile ? onNavigate : undefined} />
          ))}
          {navItems.map((item) => {
            const isActive = item.href === "/editor" ? editorActive : pathname.startsWith(item.href);
            return (
              <Item
                key={item.href}
                {...item}
                active={isActive}
                collapsed={collapsed}
                onClick={mobile ? onNavigate : undefined}
              />
            );
          })}
        </div>
        {!mobile && (
          <div className={`mt-auto ${collapsed ? "px-2 pt-4" : "px-3 pt-4"}`}>
            {collapsed ? (
              <div className="h-2" aria-hidden="true" />
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
