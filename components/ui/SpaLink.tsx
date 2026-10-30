"use client";

import React from "react";
import Link from "next/link";
import { navigateWithinSpa, shouldHandleSpaClick } from "@/lib/spaNavigation";
import { preloadWorkspaceRoute } from "@/lib/workspaceData";

/** A link that switches workspace views without a full page load and preloads its data on hover. */
export default function SpaLink({
  href,
  className,
  style,
  children,
  onNavigate,
  onClick,
  ...rest
}: {
  href: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
  onNavigate?: () => void;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <Link
      href={href}
      className={className}
      style={style}
      onMouseEnter={() => preloadWorkspaceRoute(href)}
      onFocus={() => preloadWorkspaceRoute(href)}
      onClick={(event) => {
        onClick?.(event);
        if (shouldHandleSpaClick(event) && navigateWithinSpa(href)) event.preventDefault();
        onNavigate?.();
      }}
      {...rest}
    >
      {children}
    </Link>
  );
}
