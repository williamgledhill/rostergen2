"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
}: {
  icon: any;
  label: string;
  href: string;
  active?: boolean;
  collapsed?: boolean;
}) => {
  const layout = collapsed ? "justify-center px-2" : "justify-start gap-2.5 px-4";
  const base = `inline-flex h-10 w-full items-center rounded-[10px] text-left transition ${layout}`;
  const state = active ? "bg-[#e8e9fb] text-[#3f4c84]" : "text-[#384462] hover:bg-[#f3f4f7]";
  return (
    <Link href={href} className={`${base} ${state}`} title={collapsed ? label : undefined}>
      <Icon className={`h-4 w-4 shrink-0 ${active ? "text-[#4a57a1]" : "text-[#6b768f]"}`} aria-hidden="true" />
      <span className={collapsed ? "sr-only" : "text-[14px] leading-5 font-medium"}>{label}</span>
    </Link>
  );
};

export default function SideNav({ open = true }: { open?: boolean }){
  const pathname = usePathname() || "/";
  const isOpen = open;

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
  const asideWidth = isOpen ? "w-[236px]" : "w-[68px]";
  const asideVisibility = isOpen ? "block" : "hidden md:block";

  return (
    <aside
      className={`${asideVisibility} ${asideWidth} relative flex-shrink-0 overflow-visible border-r border-[#e0e3ea] bg-white pt-3 pb-3 transition-all duration-200 md:sticky md:top-0 md:h-screen md:overflow-y-auto`}
    >
      <div className="flex h-full flex-col">
        <div className={isOpen ? "px-4 pt-2 pb-5" : "px-2 pt-2 pb-4"}>
          {isOpen ? (
            <img
              src="/royal-australian-mint-logo.svg"
              alt="Australian Government Royal Australian Mint"
              className="mx-auto h-auto w-full max-w-[192px] object-contain"
            />
          ) : (
            <div className="mx-auto grid h-8 w-8 place-items-center rounded-md bg-[#e8e9fb] text-xs font-bold text-[#4a57a1]">M</div>
          )}
        </div>
        <div className="w-full space-y-1 px-2">
          {rosterItems.map((item) => (
            <Item key={item.label} {...item} collapsed={!isOpen} />
          ))}
          {navItems.map((item) => {
            const isActive = item.href === "/editor" ? editorActive : pathname.startsWith(item.href);
            return <Item key={item.href} {...item} active={isActive} collapsed={!isOpen} />;
          })}
        </div>
        <div className="mt-auto px-3 pt-4">
          <p className="text-center text-[12px] text-[#707991]">Powered by rostergenerator.app</p>
          <p className="mt-1 text-center text-[11px] text-[#707991]">Copyright William Gledhill 2026 (excluding Mint Logo).</p>
        </div>
      </div>
    </aside>
  );
}
