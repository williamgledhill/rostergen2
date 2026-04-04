import React from "react";
import { requirePageSession } from "@/lib/apiAuth";

export default async function RostersArchivePage() {
  await requirePageSession();

  return (
    <div className="w-full py-3 px-3">
      <div className="space-y-3 flex flex-col items-start w-full">
        <h1 className="text-2xl font-semibold">Archive</h1>
        <p className="text-slate-600">Archived rosters will appear here.</p>
      </div>
    </div>
  );
}
