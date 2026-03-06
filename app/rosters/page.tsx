import React from "react";
import Link from "next/link";
import MonthActionsMenu from "@/components/MonthActionsMenu";
import NewMonthButton from "@/components/NewMonthButton";
import { getRosterMonths, formatRange } from "@/lib/rosters";

export const dynamic = "force-dynamic";

export default function Page() {
  const months = getRosterMonths(200);

  return (
    <div className="w-full py-3 px-3">
      <div className="space-y-3 flex flex-col items-start w-full max-w-5xl mx-auto">
        <div className="flex items-center justify-between w-full">
          <div>
            <h1 className="text-2xl font-semibold">Rosters by Month</h1>
            <p className="text-slate-600 text-[14px]">Pick a month to view its daily rosters.</p>
          </div>
          <NewMonthButton existingMonthIds={months.map((m) => m.id)} />
        </div>

        <div className="bg-white rounded-lg shadow-sm w-full overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#E6EAF0]">
            <h2 className="text-lg font-semibold">Months</h2>
            <span className="text-sm text-slate-600">Click a month to open</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead className="text-slate-600 text-sm">
                <tr className="border-b border-[#E6EAF0]">
                  <th className="px-3 py-2 text-left font-semibold">Month</th>
                  <th className="px-3 py-2 text-left font-semibold">Rosters</th>
                  <th className="px-3 py-2 text-left font-semibold">Range</th>
                  <th className="px-3 py-2 text-left font-semibold">Latest</th>
                  <th className="px-3 py-2 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => {
                  const total = m.rosters.length;
                  const first = m.rosters[0]?.start;
                  const last = m.rosters[m.rosters.length - 1]?.start;
                  const range = first && last ? formatRange(first, last) : "";
                  const latestUpdated = m.rosters[m.rosters.length - 1]?.updated ?? "-";
                  return (
                    <tr key={m.id} className="border-b border-[#E6EAF0] hover:bg-[#f8fafc]">
                      <td className="align-middle px-3 py-3">
                        <Link
                          href={`/rosters/months/${m.id}`}
                          className="font-semibold text-slate-800 hover:underline"
                        >
                          {m.label}
                        </Link>
                      </td>
                      <td className="align-middle px-3 py-2 text-slate-700">{total} roster{total === 1 ? "" : "s"}</td>
                      <td className="align-middle px-3 py-2 text-slate-700">{range}</td>
                      <td className="align-middle px-3 py-2 text-slate-700">{latestUpdated}</td>
                      <td className="align-middle px-3 py-2 text-right">
                        <MonthActionsMenu />
                      </td>
                    </tr>
                  );
                })}
                {months.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-600">No months available.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 text-sm text-slate-600">{months.length} month{months.length === 1 ? "" : "s"}</div>
        </div>
      </div>
    </div>
  );
}
