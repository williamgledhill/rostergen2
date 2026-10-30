"use client";

import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";
import Dialog from "@/components/ui/Dialog";

type ToastTone = "success" | "error" | "info";
type Toast = { id: number; tone: ToastTone; title: string; message?: string };

type ConfirmOptions = {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  tone?: "danger" | "default";
};

type FeedbackContextValue = {
  notify: (toast: { tone?: ToastTone; title: string; message?: string }) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const FeedbackContext = createContext<FeedbackContextValue | null>(null);

/** Toasts and confirmation dialogs, replacing the browser's alert() and confirm(). */
export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error("useFeedback must be used inside FeedbackProvider");
  return context;
}

const TOAST_DURATION_MS = 5000;

const toneStyles: Record<ToastTone, { icon: typeof Info; iconClass: string }> = {
  success: { icon: CheckCircle2, iconClass: "text-[var(--success)]" },
  error: { icon: AlertTriangle, iconClass: "text-[var(--danger)]" },
  info: { icon: Info, iconClass: "text-[var(--accent)]" },
};

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [pendingConfirm, setPendingConfirm] = useState<ConfirmOptions | null>(null);
  const resolveConfirmRef = useRef<((value: boolean) => void) | null>(null);
  const nextIdRef = useRef(0);

  const dismiss = useCallback((id: number) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);

  const notify = useCallback<FeedbackContextValue["notify"]>(
    ({ tone = "info", title, message }) => {
      const id = ++nextIdRef.current;
      setToasts((current) => [...current.slice(-2), { id, tone, title, message }]);
      window.setTimeout(() => dismiss(id), TOAST_DURATION_MS);
    },
    [dismiss]
  );

  const confirm = useCallback<FeedbackContextValue["confirm"]>((options) => {
    resolveConfirmRef.current?.(false);
    setPendingConfirm(options);
    return new Promise<boolean>((resolve) => {
      resolveConfirmRef.current = resolve;
    });
  }, []);

  const settleConfirm = (value: boolean) => {
    resolveConfirmRef.current?.(value);
    resolveConfirmRef.current = null;
    setPendingConfirm(null);
  };

  const value = useMemo(() => ({ notify, confirm }), [notify, confirm]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      <Dialog
        open={!!pendingConfirm}
        onClose={() => settleConfirm(false)}
        size="sm"
        title={pendingConfirm?.title}
        description={pendingConfirm?.message}
        footer={
          <>
            <button type="button" className="btn" onClick={() => settleConfirm(false)}>
              Cancel
            </button>
            <button
              type="button"
              autoFocus
              className={`btn ${pendingConfirm?.tone === "danger" ? "btn-danger border-[var(--danger)] bg-[var(--danger)] text-white" : "btn-primary"}`}
              onClick={() => settleConfirm(true)}
            >
              {pendingConfirm?.confirmLabel ?? "Confirm"}
            </button>
          </>
        }
      />

      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[110] flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6"
        aria-live="polite"
      >
        {toasts.map((toast) => {
          const { icon: Icon, iconClass } = toneStyles[toast.tone];
          return (
            <div
              key={toast.id}
              role={toast.tone === "error" ? "alert" : "status"}
              className="toast-enter pointer-events-auto flex w-full max-w-[380px] items-start gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] bg-white px-4 py-3 shadow-[var(--shadow-lg)]"
            >
              <Icon className={`mt-0.5 h-[18px] w-[18px] shrink-0 ${iconClass}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-medium">{toast.title}</p>
                {toast.message && <p className="mt-0.5 text-[13px] text-[var(--text-muted)]">{toast.message}</p>}
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm btn-icon -mr-1.5 -mt-1"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss"
              >
                <X />
              </button>
            </div>
          );
        })}
      </div>
    </FeedbackContext.Provider>
  );
}
