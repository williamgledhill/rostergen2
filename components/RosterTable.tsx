"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RosterFile } from "@/lib/rosters";

type Props = {
  rosters: RosterFile[];
  footer?: React.ReactNode;
};

export default function RosterTable({ rosters, footer }: Props) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const headerCheckboxRef = useRef<HTMLInputElement>(null);
  const today = useMemo(() => new Date(), []);
  const router = useRouter();

  const allIds = useMemo(() => rosters.map((r) => r.id), [rosters]);
  const allSelected = selectedIds.length > 0 && selectedIds.length === allIds.length;
  const isIndeterminate = selectedIds.length > 0 && selectedIds.length < allIds.length;

  useEffect(() => {
    if (headerCheckboxRef.current) {
      headerCheckboxRef.current.indeterminate = isIndeterminate;
    }
  }, [isIndeterminate]);

  useEffect(() => {
    // prune selections when the roster list changes
    setSelectedIds((prev) => prev.filter((id) => allIds.includes(id)));
  }, [allIds]);

  function toggleAll(checked: boolean) {
    setSelectedIds(checked ? allIds : []);
  }

  function toggleOne(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const set = new Set(prev);
      if (checked) set.add(id); else set.delete(id);
      return Array.from(set);
    });
  }

  function handleRowClick(id: string) {
    router.push(`/editor?date=${encodeURIComponent(id)}`);
  }

  return (
    <div className="bg-white rounded-lg shadow-sm w-full overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="text-slate-600 text-sm">
            <tr className="border-b border-[#E6EAF0]">
              <th className="w-10 px-3 py-2 text-left font-semibold">
                <input
                  ref={headerCheckboxRef}
                  type="checkbox"
                  className="h-4 w-4"
                  aria-label="Select all rosters"
                  checked={allSelected}
                  onChange={(e) => toggleAll(e.target.checked)}
                />
              </th>
              <th className="px-3 py-2 text-left font-semibold">Roster</th>
              <th className="px-3 py-2 text-left font-semibold">Tours</th>
              <th className="px-3 py-2 text-left font-semibold">People</th>
              <th className="px-3 py-2 text-left font-semibold">Status</th>
              <th className="px-3 py-2 text-left font-semibold">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rosters.map((r) => {
              const startDate = r.start instanceof Date ? r.start : new Date(r.start);
              const isCurrent = today.toDateString() === startDate.toDateString();
              const rowStyles = isCurrent ? "bg-amber-50" : "";
              const checked = selectedIds.includes(r.id);
              return (
                <tr
                  key={r.id}
                  className={`group border-b border-[#E6EAF0] hover:bg-[#f8fafc] cursor-pointer ${rowStyles}`}
                  onClick={() => handleRowClick(r.id)}
                >
                  <td className="align-middle px-3 py-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      aria-label={`Select roster ${r.title}`}
                      checked={checked}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => toggleOne(r.id, e.target.checked)}
                    />
                  </td>
                  <td className="align-middle px-3 py-3">
                    <div className="flex flex-col gap-1">
                      <Link
                        href={`/editor?date=${encodeURIComponent(r.id)}`}
                        className="font-semibold text-slate-800 hover:underline group-hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {r.title}
                      </Link>
                      <span className="text-xs text-slate-600">Daily roster</span>
                    </div>
                  </td>
                  <td className="align-middle px-3 py-2 text-slate-700">{r.tours} tours</td>
                  <td className="align-middle px-3 py-2 text-slate-700">{r.people} people</td>
                  <td className="align-middle px-3 py-2">
                    <span
                      className={`text-xs px-2 py-1 rounded-sm border ${
                        r.status === "Published"
                          ? "border-green-700 text-green-800 bg-green-50"
                          : "border-slate-400 text-slate-700 bg-slate-50"
                      }`}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="align-middle px-3 py-2 text-slate-600">{r.updated}</td>
                </tr>
              );
            })}
            {rosters.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-slate-600">No rosters yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 text-sm text-slate-600">
        {footer ?? `${rosters.length} roster${rosters.length === 1 ? "" : "s"}`}
      </div>
    </div>
  );
}
