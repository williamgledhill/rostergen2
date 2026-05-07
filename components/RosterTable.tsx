"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";
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

  function getRosterState(roster: RosterFile, isCurrent: boolean) {
    const employees = Array.isArray(roster.employees) ? roster.employees : [];
    const tasks = Array.isArray(roster.tasks) ? roster.tasks : [];
    const isEmpty = roster.tours === 0 && roster.people === 0 && employees.length === 0 && tasks.length === 0;
    if (isEmpty) return { label: "Empty", className: "status-badge-empty" };
    if (roster.status === "Published" || isCurrent) return { label: "Published", className: "status-badge-published" };
    return { label: "Draft", className: "status-badge-draft" };
  }

  return (
    <div className="surface-panel">
      <div className="overflow-x-auto">
        <table className="data-table min-w-[900px]">
          <thead>
            <tr>
              <th>Roster</th>
              <th>Tours</th>
              <th>People</th>
              <th>Updated</th>
              <th aria-label="Actions" className="w-[92px]" />
            </tr>
          </thead>
          <tbody>
            {rosters.map((r) => {
              const startDate = r.start instanceof Date ? r.start : new Date(r.start);
              const isCurrent = today.toDateString() === startDate.toDateString();
              const status = getRosterState(r, isCurrent);
              return (
                <tr
                  key={r.id}
                  className="group cursor-pointer"
                  onMouseEnter={() => {
                    const href = buildEditorHref(r.id);
                    preloadWorkspaceRoute(href);
                    router.prefetch(href);
                  }}
                  onClick={() => handleRowClick(r.id)}
                >
                  <td className="align-middle">
                    <div className="flex min-w-[320px] items-center gap-4">
                      <Link
                        href={buildEditorHref(r.id)}
                        className="block truncate text-[14px] font-semibold text-[var(--ink)] hover:underline group-hover:underline"
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
                      <span className={`status-badge ${status.className}`}>{status.label}</span>
                      {isCurrent && <span className="sr-only">Current roster</span>}
                    </div>
                  </td>
                  <td className="align-middle">{r.tours} tours</td>
                  <td className="align-middle">{r.people} people</td>
                  <td className="align-middle text-[var(--muted-strong)]">{r.updated}</td>
                  <td className="align-middle">
                    <button
                      type="button"
                      className="icon-button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleRowClick(r.id);
                      }}
                      aria-label={`Open ${r.title}`}
                      title="Open roster"
                    >
                      <Download className="h-5 w-5" aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {rosters.length === 0 && (
              <tr>
                <td colSpan={5} className="py-10 text-center text-[15px] text-[var(--muted)]">No rosters yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {footer ? <div className="table-footer">{footer}</div> : null}
    </div>
  );
}
