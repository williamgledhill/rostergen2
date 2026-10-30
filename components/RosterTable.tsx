"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import SpaLink from "@/components/ui/SpaLink";
import { formatLocalId } from "@/lib/dateUtils";
import { buildEditorHref } from "@/lib/editorPersistence";
import type { RosterFile } from "@/lib/rosters";
import { navigateWithinSpa } from "@/lib/spaNavigation";
import { preloadWorkspaceRoute } from "@/lib/workspaceData";

function isBlank(roster: RosterFile) {
  return !roster.people && !(roster.tasks?.length ?? 0) && !(roster.employees?.length ?? 0);
}

const countOrDash = (count: number) => (count > 0 ? count : <span className="text-[var(--text-faint)]">—</span>);

export default function RosterTable({ rosters, footer }: { rosters: RosterFile[]; footer?: React.ReactNode }) {
  const router = useRouter();
  const todayId = useMemo(() => formatLocalId(new Date()), []);

  const open = (id: string) => {
    const href = buildEditorHref(id);
    if (!navigateWithinSpa(href)) router.push(href);
  };

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Day</th>
              <th>Status</th>
              <th className="hidden text-right sm:table-cell">People</th>
              <th className="hidden text-right sm:table-cell">Tours</th>
              <th className="hidden md:table-cell">Last updated</th>
              <th aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {rosters.map((roster) => {
              const blank = isBlank(roster);
              const isToday = roster.id === todayId;
              return (
                <tr
                  key={roster.id}
                  className="is-clickable"
                  onMouseEnter={() => preloadWorkspaceRoute(buildEditorHref(roster.id))}
                  onClick={() => open(roster.id)}
                >
                  <td className="sm:whitespace-nowrap">
                    <SpaLink
                      href={buildEditorHref(roster.id)}
                      className="font-medium hover:underline"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {roster.title}
                    </SpaLink>
                    {isToday && <span className="badge badge-accent ml-2">Today</span>}
                  </td>
                  <td>
                    {blank ? (
                      <span className="badge">Not started</span>
                    ) : roster.status === "Published" ? (
                      <span className="badge badge-success">Published</span>
                    ) : (
                      <span className="badge badge-warning">Draft</span>
                    )}
                  </td>
                  <td className="hidden text-right tabular-nums sm:table-cell">{countOrDash(roster.people)}</td>
                  <td className="hidden text-right tabular-nums sm:table-cell">{countOrDash(roster.tours)}</td>
                  <td className="hidden whitespace-nowrap text-[var(--text-muted)] md:table-cell">{roster.updated === "-" ? "—" : roster.updated}</td>
                  <td className="w-10 text-[var(--text-faint)]">
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </td>
                </tr>
              );
            })}
            {rosters.length === 0 && (
              <tr>
                <td colSpan={6} className="py-10 text-center text-[var(--text-muted)]">
                  No rosters yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="border-t border-[var(--border)] px-5 py-3 text-[13px] text-[var(--text-muted)]">
        {footer ?? `${rosters.length} roster${rosters.length === 1 ? "" : "s"}`}
      </div>
    </div>
  );
}
