"use client";

import React, { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

/**
 * Modal shell: dims the page, closes on Escape or a backdrop click, and moves
 * focus into the dialog so keyboard users land in it.
 */
export default function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  as = "div",
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  /** Render the panel as a form so Enter submits. */
  as?: "div" | "form";
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCloseRef.current();
    };
    window.addEventListener("keydown", onKeyDown);
    const firstField = panelRef.current?.querySelector<HTMLElement>("[autofocus], input, select, textarea");
    (firstField ?? panelRef.current)?.focus();
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const width = size === "sm" ? "max-w-[420px]" : size === "lg" ? "max-w-[720px]" : "max-w-[540px]";
  const Panel = as;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <Panel
        ref={panelRef as never}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onSubmit={onSubmit as React.FormEventHandler<HTMLElement> & React.FormEventHandler<HTMLFormElement>}
        className={`dialog-enter flex max-h-[92vh] w-full ${width} flex-col overflow-hidden rounded-t-[var(--radius-lg)] bg-white shadow-[var(--shadow-lg)] outline-none sm:rounded-[var(--radius-lg)]`}
      >
        <div className="flex items-start justify-between gap-4 px-5 pb-3 pt-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-[17px] font-semibold leading-snug">
              {title}
            </h2>
            {description && <p className="mt-1 text-[13.5px] text-[var(--text-muted)]">{description}</p>}
          </div>
          <button type="button" className="btn btn-ghost btn-sm btn-icon -mr-1.5 -mt-1" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </div>
        {children && <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">{children}</div>}
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-[var(--border)] bg-[var(--surface-subtle)] px-5 py-3">
            {footer}
          </div>
        )}
      </Panel>
    </div>
  );
}
