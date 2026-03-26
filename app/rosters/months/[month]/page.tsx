"use client";
import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useParams } from "next/navigation";
import RosterTable from "@/components/RosterTable";
import { formatLocalId } from "@/lib/dateUtils";
import type { RosterFile } from "@/lib/rosters";

function formatMonthLabelLocal(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month)) return month;
  const [y, m] = month.split("-").map(Number);
  const dt = new Date(y, m - 1, 1);
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(dt);
}

export default function RostersForMonth() {
  const params = useParams();
  const month = typeof params?.month === "string" ? params.month : "";
  const [rosters, setRosters] = useState<RosterFile[]>([]);
  const [loading, setLoading] = useState(true);
  const label = useMemo(() => formatMonthLabelLocal(month) || month || "this month", [month]);
  const todayHref = `/editor?date=${encodeURIComponent(formatLocalId(new Date()))}`;

  useEffect(() => {
    let active = true;
    if (!month) {
      setRosters([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(`/api/rosters/month?month=${encodeURIComponent(month)}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (!active) return;
        setRosters(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (active) setRosters([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [month]);

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
        {loading ? (
          <div className="text-slate-600 text-sm">Loading rosters...</div>
        ) : (
          <RosterTable rosters={rosters} />
        )}
      </div>
    </div>
  );
}

