import Link from "next/link";
import { Plus } from "lucide-react";
import RosterTable from "@/components/RosterTable";
import { formatLocalId } from "@/lib/dateUtils";
import { formatMonthLabel, getRostersForMonth } from "@/lib/rosters";
import { requirePageSession } from "@/lib/apiAuth";

export default async function RostersForMonthPage({
  params,
}: {
  params: Promise<{ month: string }>;
}) {
  const { month } = await params;
  await requirePageSession();

  const rosters = await getRostersForMonth(month, 5000);
  const label = formatMonthLabel(month) || month || "this month";
  const todayHref = `/editor?date=${encodeURIComponent(formatLocalId(new Date()))}`;

  return (
    <div className="w-full py-3 px-3">
      <div className="space-y-3 flex flex-col items-start w-full">
        <div className="w-full">
          <div className="flex items-center justify-between w-full">
            <div className="flex flex-col leading-tight">
              <h1 className="text-2xl font-semibold">Rosters for {label}</h1>
              <p className="text-slate-600 text-[14px]">Browse individual daily rosters in this month. Today is highlighted.</p>
            </div>
            <Link
              href={todayHref}
              className="btn btn-primary h-9"
              style={{ borderRadius: "6px", paddingInline: "12px" }}
            >
              <Plus className="w-4 h-4 text-white" strokeWidth={2.3} />
              <span className="text-[14px] font-medium text-white">New Roster</span>
            </Link>
          </div>
        </div>
        <RosterTable rosters={rosters} />
      </div>
    </div>
  );
}
