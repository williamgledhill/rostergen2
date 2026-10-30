import React from "react";

/**
 * A drawn sample of the roster editor for the public pages. Blocks appear one
 * after another, the way autofill places them.
 */

type Task = { label: string; color: string };

const TASKS = {
  front: { label: "Front desk", color: "#FDE68A" },
  gallery: { label: "Gallery floor", color: "#BBF7D0" },
  tour: { label: "Public tour", color: "#BFDBFE" },
  school: { label: "School program", color: "#C7D2FE" },
  prep: { label: "School prep", color: "#DBEAFE" },
  breakTime: { label: "Break", color: "#E9D5FF" },
} satisfies Record<string, Task>;

type Placement = { task: Task; start: number; span: number };

const PEOPLE: { name: string; hours: string; blocks: Placement[] }[] = [
  {
    name: "Avery",
    hours: "08:00–17:00",
    blocks: [
      { task: TASKS.front, start: 0, span: 2 },
      { task: TASKS.school, start: 2, span: 3 },
      { task: TASKS.breakTime, start: 5, span: 1 },
      { task: TASKS.gallery, start: 6, span: 4 },
    ],
  },
  {
    name: "Jordan",
    hours: "08:00–16:00",
    blocks: [
      { task: TASKS.gallery, start: 0, span: 3 },
      { task: TASKS.tour, start: 3, span: 3 },
      { task: TASKS.front, start: 6, span: 2 },
      { task: TASKS.breakTime, start: 8, span: 1 },
    ],
  },
  {
    name: "Sam",
    hours: "08:30–17:00",
    blocks: [
      { task: TASKS.prep, start: 1, span: 2 },
      { task: TASKS.front, start: 3, span: 3 },
      { task: TASKS.breakTime, start: 6, span: 1 },
      { task: TASKS.tour, start: 7, span: 3 },
    ],
  },
  {
    name: "Taylor",
    hours: "08:00–16:30",
    blocks: [
      { task: TASKS.tour, start: 0, span: 2 },
      { task: TASKS.breakTime, start: 2, span: 1 },
      { task: TASKS.gallery, start: 3, span: 2 },
      { task: TASKS.school, start: 5, span: 3 },
      { task: TASKS.front, start: 8, span: 2 },
    ],
  },
];

const ROW_COUNT = 10;
const TIMES = Array.from({ length: ROW_COUNT }, (_, row) => {
  const minutes = 8 * 60 + row * 30;
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${minutes % 60 === 0 ? "00" : "30"}`;
});

export default function RosterPreview({ compact = false }: { compact?: boolean }) {
  const rowHeight = compact ? 22 : 30;
  const visiblePeople = compact ? PEOPLE.slice(0, 3) : PEOPLE;
  let blockIndex = 0;

  return (
    <div
      className="overflow-hidden rounded-[14px] border border-[#dfe3ea] bg-white text-[#111827] shadow-[0_24px_60px_rgba(16,24,40,0.14)]"
      aria-hidden="true"
    >
      <div className="flex items-center justify-between gap-3 border-b border-[#e7eaf0] px-4 py-3">
        <div>
          <p className={compact ? "text-[13px] font-semibold" : "text-[15px] font-semibold"}>Monday 30 March</p>
          {!compact && <p className="text-[12px] text-[#6b7280]">4 people · 18 tasks placed</p>}
        </div>
        <span className="preview-chip inline-flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[11px] font-semibold text-[var(--accent)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          Autofilled
        </span>
      </div>

      <div
        className="grid"
        style={{ gridTemplateColumns: `${compact ? 44 : 56}px repeat(${visiblePeople.length}, minmax(0, 1fr))` }}
      >
        <div className="border-b border-r border-[#e7eaf0] bg-[#f8f9fb]" />
        {visiblePeople.map((person) => (
          <div key={person.name} className="border-b border-r border-[#e7eaf0] bg-[#f8f9fb] px-2 py-1.5 last:border-r-0">
            <p className="truncate text-[12px] font-semibold">{person.name}</p>
            {!compact && <p className="truncate text-[10.5px] text-[#6b7280]">{person.hours}</p>}
          </div>
        ))}

        <div className="grid border-r border-[#e7eaf0]" style={{ gridTemplateRows: `repeat(${ROW_COUNT}, ${rowHeight}px)` }}>
          {TIMES.map((time) => (
            <div
              key={time}
              className="border-b border-[#eef0f4] px-1.5 pt-1 text-right text-[10px] tabular-nums text-[#8a93a3] last:border-b-0"
            >
              {time}
            </div>
          ))}
        </div>

        {visiblePeople.map((person) => (
          <div
            key={person.name}
            className="grid border-r border-[#e7eaf0] last:border-r-0"
            style={{
              gridTemplateRows: `repeat(${ROW_COUNT}, ${rowHeight}px)`,
              backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${rowHeight - 1}px, #f1f3f6 ${rowHeight - 1}px ${rowHeight}px)`,
            }}
          >
            {person.blocks.map((block) => {
              const delay = 120 + blockIndex++ * 70;
              return (
                <div
                  key={`${block.task.label}-${block.start}`}
                  className="preview-block m-[1.5px] flex items-center justify-center overflow-hidden rounded-[6px] border border-black/10 px-1 text-center font-semibold uppercase tracking-[0.02em] text-[#1f2937]"
                  style={{
                    gridRow: `${block.start + 1} / span ${block.span}`,
                    backgroundColor: block.task.color,
                    fontSize: compact ? 9 : 10.5,
                    animationDelay: `${delay}ms`,
                  }}
                >
                  <span className="line-clamp-2">{block.task.label}</span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
