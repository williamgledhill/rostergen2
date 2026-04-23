"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { RosterFile } from "@/lib/rosters";
import { buildEditorHref } from "@/lib/editorPersistence";
import { navigateWithinSpa, shouldHandleSpaClick } from "@/lib/spaNavigation";
import { preloadWorkspaceRoute } from "@/lib/workspaceData";

type Props = {
  rosters: RosterFile[];
  footer?: React.ReactNode;
};

export default function RosterTable({ rosters, footer }: Props) {
  const today = useMemo(() => new Date(), []);
  const router = useRouter();

  function handleRowClick(id: string) {
    const href = buildEditorHref(id);
    if (!navigateWithinSpa(href)) router.push(href);
  }

  return (
    <div className="w-full overflow-hidden rounded-lg border border-[var(--border)] bg-white">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[15px]">
          <thead className="text-[15px] text-slate-900">
            <tr className="border-b border-[#E6EAF0]">
              <th className="px-4 py-4 text-left font-bold tracking-[0.01em]">Roster</th>
              <th className="px-4 py-4 text-left font-bold tracking-[0.01em]">Tours</th>
              <th className="px-4 py-4 text-left font-bold tracking-[0.01em]">People</th>
              <th className="px-4 py-4 text-left font-bold tracking-[0.01em]">Updated</th>
            </tr>
          </thead>
          <tbody className="[&_tr:last-child]:border-b-0">
            {rosters.map((r) => {
              const startDate = r.start instanceof Date ? r.start : new Date(r.start);
              const isCurrent = today.toDateString() === startDate.toDateString();
              const rowStyles = isCurrent ? "bg-amber-50" : "";
              return (
                <tr
                  key={r.id}
                  className={`group border-b border-[#E6EAF0] hover:bg-[#f8fafc] cursor-pointer ${rowStyles}`}
                  onMouseEnter={() => {
                    const href = buildEditorHref(r.id);
                    preloadWorkspaceRoute(href);
                    router.prefetch(href);
                  }}
                  onClick={() => handleRowClick(r.id)}
                >
                  <td className="align-middle px-4 py-4">
                    <Link
                      href={buildEditorHref(r.id)}
                      className="block truncate text-[15px] font-medium text-slate-700 hover:underline group-hover:underline"
                      onClick={(event) => {
                        event.stopPropagation();
                        const href = buildEditorHref(r.id);
                        if (shouldHandleSpaClick(event) && navigateWithinSpa(href)) {
                          event.preventDefault();
                        }
                      }}
                    >
                      {r.title}
                    </Link>
                  </td>
                  <td className="align-middle px-4 py-4 text-[15px] font-medium text-slate-700">{r.tours} tours</td>
                  <td className="align-middle px-4 py-4 text-[15px] font-medium text-slate-700">{r.people} people</td>
                  <td className="align-middle px-4 py-4 text-[15px] font-medium text-slate-600">{r.updated}</td>
                </tr>
              );
            })}
            {rosters.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-[15px] text-slate-600">No rosters yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="border-t border-[#E6EAF0] px-4 py-3 text-sm text-slate-600">
        {footer ?? `${rosters.length} roster${rosters.length === 1 ? "" : "s"}`}
      </div>
    </div>
  );
}
