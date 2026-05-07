function Line({ width = "w-full" }: { width?: string }) {
  return <div className={`h-4 ${width} animate-pulse rounded bg-slate-200/80`} />;
}

function CardRow() {
  return (
    <div className="grid grid-cols-[1.6fr_0.7fr_0.7fr_0.7fr_0.7fr] gap-3 border-b border-[var(--border)] px-4 py-3">
      <Line width="w-3/4" />
      <Line width="w-2/3" />
      <Line width="w-2/3" />
      <Line width="w-1/2" />
      <Line width="w-2/3" />
    </div>
  );
}

export default function Loading() {
  return (
    <div className="workspace-page" aria-busy="true" aria-live="polite">
      <div className="space-y-4">
        <div className="space-y-2">
          <Line width="h-8 w-64" />
          <Line width="w-80" />
        </div>

        <div className="surface-panel">
          <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3">
            <div className="space-y-2">
              <Line width="w-40" />
              <Line width="w-56" />
            </div>
            <Line width="h-9 w-32" />
          </div>

          <div className="space-y-0">
            <CardRow />
            <CardRow />
            <CardRow />
            <CardRow />
            <CardRow />
            <CardRow />
          </div>
        </div>
      </div>
    </div>
  );
}
