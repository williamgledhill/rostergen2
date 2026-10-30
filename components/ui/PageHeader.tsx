import React from "react";
import { ChevronRight } from "lucide-react";
import SpaLink from "@/components/ui/SpaLink";

export default function PageHeader({
  title,
  description,
  actions,
  breadcrumb,
  meta,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumb?: { label: string; href: string };
  /** Small line under the description, such as the autosave status. */
  meta?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {breadcrumb && (
          <nav className="mb-2 flex items-center gap-1 text-[13px] font-medium text-[var(--text-muted)]">
            <SpaLink href={breadcrumb.href} className="hover:text-[var(--text)]">
              {breadcrumb.label}
            </SpaLink>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          </nav>
        )}
        <h1 className="break-words text-[24px] font-semibold leading-tight tracking-[-0.015em]">{title}</h1>
        {description && <p className="mt-1 text-[14px] text-[var(--text-muted)]">{description}</p>}
        {meta && <div className="mt-2">{meta}</div>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
