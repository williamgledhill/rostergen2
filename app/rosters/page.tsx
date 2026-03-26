import React from "react";
import Link from "next/link";
import RosterTable from "@/components/RosterTable";
import { getUpcomingRosters } from "@/lib/rosters";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default function Page() {
  const settings = getSettings();
  const rosters = getUpcomingRosters(settings.upcomingDays);
  const dayLabel = settings.upcomingDays === 1 ? "day" : "days";

  return (
    <div className="w-full py-3 px-3">
      <div className="space-y-3 flex flex-col items-start w-full">
        <div className="w-full flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Upcoming Rosters</h1>
            <p className="text-slate-600 text-[14px]">
              Showing the next {settings.upcomingDays} {dayLabel} starting today, with blank rows auto-generated.
            </p>
          </div>
          <Link href="/rosters/old" className="btn h-9 px-4 whitespace-nowrap">
            Old Rosters
          </Link>
        </div>

        <RosterTable
          rosters={rosters}
          footer={
            <>
              Autogenerates {settings.upcomingDays} roster{settings.upcomingDays === 1 ? "" : "s"}.{" "}
              <Link href="/settings" className="font-medium text-[#675dff] hover:underline">
                Click to change
              </Link>
            </>
          }
        />
      </div>
    </div>
  );
}
