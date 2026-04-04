import React from "react";
import { requirePageSession } from "@/lib/apiAuth";

export default async function Page() {
  await requirePageSession();

  return (
    <div className="w-full py-3 px-3">
      <div className="space-y-3 flex flex-col items-start w-full">
        <h1 className="text-2xl font-semibold">History</h1>
        <p className="text-slate-600">Content coming soon.</p>
      </div>
    </div>
  );
}
