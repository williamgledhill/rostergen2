import React from "react";
import TopBar from "@/components/TopBar";
import DateNavigator from "@/components/DateNavigator";
import Link from "next/link";
import { requirePageSession } from "@/lib/apiAuth";

export default async function OldRosters() {
  await requirePageSession();

  return (
    <div className="w-full py-4 px-3 space-y-4">
      <TopBar />
      <DateNavigator />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Old Rosters</h1>
          <p className="text-slate-700">This page will show past rosters. Coming soon.</p>
        </div>
        <Link href="/rosters" className="btn">Back to list</Link>
      </div>
      <div className="card border border-black bg-white p-4">
        <p className="text-slate-700">No past rosters to show yet.</p>
      </div>
    </div>
  );
}
