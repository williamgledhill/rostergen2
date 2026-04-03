function Line({ width = "w-full" }: { width?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200/80 ${width}`} />;
}

function PeopleRow() {
  return (
    <div className="grid grid-cols-[40px_1fr_1fr] items-center gap-3 border-b border-[#E6EAF0] px-4 py-3">
      <Line width="h-4 w-4" />
      <Line width="h-4 w-40" />
      <Line width="h-4 w-52" />
    </div>
  );
}

export default function Loading() {
  return (
    <div className="w-full px-3 py-3" aria-busy="true" aria-live="polite">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Line width="h-8 w-32" />
            <Line width="h-4 w-72" />
          </div>
          <Line width="h-10 w-32" />
        </div>
        <div className="overflow-hidden rounded-lg bg-white shadow-sm">
          <div className="grid grid-cols-[40px_1fr_1fr] gap-3 border-b border-[#E6EAF0] px-4 py-3">
            <Line width="h-4 w-4" />
            <Line width="h-4 w-20" />
            <Line width="h-4 w-28" />
          </div>
          <PeopleRow />
          <PeopleRow />
          <PeopleRow />
          <PeopleRow />
          <PeopleRow />
        </div>
      </div>
    </div>
  );
}
