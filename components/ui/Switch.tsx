import React from "react";

export default function Switch({
  id,
  checked,
  onChange,
  label,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name when there's no visible label pointing at the id. */
  label?: string;
}) {
  return (
    <label htmlFor={id} className="relative inline-flex shrink-0 cursor-pointer items-center">
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="peer sr-only"
        checked={checked}
        aria-label={label}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="h-6 w-11 rounded-full bg-slate-200 transition peer-checked:bg-[var(--accent)] peer-focus-visible:ring-[3px] peer-focus-visible:ring-[var(--accent-ring)]" />
      <span className="absolute left-[3px] top-[3px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition peer-checked:translate-x-5" />
    </label>
  );
}
