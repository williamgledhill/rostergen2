function Line({ width = "w-full" }: { width?: string }) {
  return <div className={`animate-pulse rounded bg-slate-200/80 ${width}`} />;
}

function TaskRow() {
  return (
    <div className="grid grid-cols-[40px_1.2fr_0.6fr_0.8fr] items-center gap-3 border-b border-[var(--border)] px-4 py-3">
      <Line width="h-4 w-4" />
      <div className="flex items-center gap-2">
        <Line width="h-[18px] w-[18px] rounded-full" />
        <Line width="h-4 w-40" />
      </div>
      <Line width="h-4 w-16" />
      <Line width="h-4 w-28" />
    </div>
  );
}

export default function Loading() {
  return (
    <div className="workspace-page" aria-busy="true" aria-live="polite">
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <div className="space-y-2">
            <Line width="h-8 w-28" />
            <Line width="h-4 w-80" />
          </div>
          <Line width="h-10 w-28" />
        </div>
        <div className="surface-panel">
          <div className="grid grid-cols-[40px_1.2fr_0.6fr_0.8fr] gap-3 border-b border-[var(--border)] px-4 py-3">
            <Line width="h-4 w-4" />
            <Line width="h-4 w-16" />
            <Line width="h-4 w-16" />
            <Line width="h-4 w-24" />
          </div>
          <TaskRow />
          <TaskRow />
          <TaskRow />
          <TaskRow />
          <TaskRow />
        </div>
      </div>
    </div>
  );
}
