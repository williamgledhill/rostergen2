import React from "react";
import { Check, Circle } from "lucide-react";
import { checkPasswordRules } from "@/lib/passwordRules";

/** The password rules as a checklist that ticks off while the person types. */
export default function PasswordRequirements({ password, className = "" }: { password: string; className?: string }) {
  return (
    <ul className={`space-y-1 text-[13px] ${className}`} aria-label="Password requirements">
      {checkPasswordRules(password).map((rule) => (
        <li
          key={rule.id}
          className={`flex items-center gap-2 transition-colors ${rule.met ? "text-[var(--success)]" : "text-[#6b7280]"}`}
        >
          {rule.met ? (
            <Check className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <Circle className="h-3 w-3 shrink-0" aria-hidden="true" />
          )}
          <span>
            {rule.label}
            <span className="sr-only">{rule.met ? " (done)" : " (not yet)"}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
