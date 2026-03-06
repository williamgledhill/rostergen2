export default function Legend() {
  const Dot = ({ className }: { className: string }) => (
    <span className={`w-3 h-3 border border-slate-300 rounded ${className}`} />
  );
  return (
    <div className="flex flex-wrap gap-2">
      <span className="badge"><Dot className="bg-[var(--tour)]" />Public Tour</span>
      <span className="badge"><Dot className="bg-[var(--prep)]" />Prep</span>
      <span className="badge"><Dot className="bg-[var(--front)]" />Front Desk</span>
      <span className="badge"><Dot className="bg-[var(--gallery)]" />Gallery</span>
      <span className="badge"><Dot className="bg-[var(--break)]" />Break</span>
      <span className="badge"><Dot className="bg-[var(--tidy)]" />Finish</span>
    </div>
  );
}
