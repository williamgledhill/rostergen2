import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

type DemoTaskTone = "front" | "tour" | "gallery" | "break" | "prep" | "finish";
type DemoTask = { label: string; tone: DemoTaskTone } | null;

const demoColumns = [
  { name: "Claire", hours: "09:00 - 17:00" },
  { name: "Anna", hours: "08:00 - 16:00" },
  { name: "Leila", hours: "08:00 - 16:00" },
  { name: "Rowan", hours: "09:00 - 17:00" },
];

const demoRows: Array<{ time: string; tasks: DemoTask[] }> = [
  {
    time: "08:00 - 08:15",
    tasks: [{ label: "Front Desk", tone: "front" }, null, { label: "Gallery Floor", tone: "gallery" }, null],
  },
  {
    time: "08:15 - 08:30",
    tasks: [{ label: "Public Tour", tone: "tour" }, { label: "Prep", tone: "prep" }, null, { label: "Finish", tone: "finish" }],
  },
  {
    time: "08:30 - 08:45",
    tasks: [null, { label: "Gallery Floor", tone: "gallery" }, { label: "Front Desk", tone: "front" }, null],
  },
  {
    time: "08:45 - 09:00",
    tasks: [{ label: "Break", tone: "break" }, null, { label: "Public Tour", tone: "tour" }, { label: "Front Desk", tone: "front" }],
  },
  {
    time: "09:00 - 09:15",
    tasks: [{ label: "Front Desk", tone: "front" }, { label: "School Program", tone: "tour" }, { label: "Gallery Floor", tone: "gallery" }, null],
  },
  {
    time: "09:15 - 09:30",
    tasks: [null, { label: "Public Tour", tone: "tour" }, { label: "Break", tone: "break" }, { label: "Prep", tone: "prep" }],
  },
];

function taskToneClass(tone: DemoTaskTone) {
  if (tone === "front") return "bg-[#f7e38b] text-[#1d2430]";
  if (tone === "tour") return "bg-[#b9d2f2] text-[#1b2a44]";
  if (tone === "gallery") return "bg-[#b5e8c7] text-[#1b2a44]";
  if (tone === "break") return "bg-[#d9c8ec] text-[#1d2430]";
  if (tone === "prep") return "bg-[#b9d2f2] text-[#1b2a44]";
  return "bg-[#efcfaa] text-[#1d2430]";
}

export default function HomePage() {
  return (
    <div className={`${inter.className} min-h-screen bg-white text-[#1f2733]`}>
      <header className="sticky top-0 z-50 border-b border-[#e2e7f0] bg-white">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-10 sm:py-4">
          <Link
            href="/"
            className="inline-flex items-center text-[1.25rem] font-semibold tracking-[-0.02em] text-[#1b2a44] sm:text-[1.85rem]"
          >
            Roster Generator
          </Link>

          <nav className="hidden items-center gap-8 text-[1.05rem] font-medium text-[#31435f] lg:flex">
            <a href="#hero" className="transition hover:text-[#1b2a44]">
              Features
            </a>
            <a href="#hero" className="transition hover:text-[#1b2a44]">
              Benefits
            </a>
            <a href="#hero" className="transition hover:text-[#1b2a44]">
              Integrations
            </a>
          </nav>

          <div className="flex items-center gap-2.5 sm:gap-4">
            <Link
              href="/signup"
              className="hidden h-10 items-center px-2 text-[0.98rem] font-semibold text-[var(--accent)] transition hover:text-[var(--accent-strong)] sm:inline-flex"
            >
              Login
            </Link>
            <Link
              href="/signup"
              className="inline-flex h-10 items-center rounded-full bg-[var(--accent)] px-4 text-[0.95rem] font-semibold text-white transition hover:bg-[var(--accent-strong)] sm:h-11 sm:px-6 sm:text-sm"
            >
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-4 pb-20 sm:px-10">
        <section id="hero" className="hero-copy-animate mx-auto max-w-3xl py-20 text-center sm:py-24">
          <h1 className="text-[2rem] font-semibold leading-[1.05] text-[#101827] sm:text-[3.4rem] lg:text-[4rem]">
            Create rosters in seconds
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-[1.06rem] leading-relaxed text-[#465267] sm:text-[1.2rem]">
            Plan people, shifts, and tasks from one clean workspace with less admin overhead.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--accent)] px-6 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
            >
              Get started
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section id="demo" className="mx-auto max-w-6xl">
          <div className="relative rounded-[26px] border border-[#d7dfef] bg-[linear-gradient(180deg,#f6f9ff_0%,#eef3fc_100%)] p-3 shadow-[0_22px_60px_rgba(27,42,68,0.12)] sm:p-5">
            <div className="pointer-events-none absolute -left-16 top-10 h-36 w-36 rounded-full bg-[var(--accent-soft)] blur-3xl" />
            <div className="pointer-events-none absolute -right-14 bottom-8 h-40 w-40 rounded-full bg-[#d9e2ff] blur-3xl" />

            <div className="relative overflow-hidden rounded-[18px] border border-[#ccd6eb] bg-white">
              <div className="flex items-center justify-between bg-[var(--accent)] px-4 py-3 text-white">
                <p className="text-sm font-semibold sm:text-base">Roster Editor Demo</p>
                <span className="rounded-full bg-white/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em]">
                  Live Preview
                </span>
              </div>

              <div className="grid md:grid-cols-[180px_1fr]">
                <aside className="hidden border-r border-[#e2e8f5] bg-[#f9fbff] p-3 md:block">
                  <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#6a7890]">
                    Navigation
                  </p>
                  <div className="mt-2 space-y-1">
                    {["Rosters", "Editor", "People", "Tasks", "Settings"].map((item) => (
                      <div
                        key={item}
                        className={`rounded-md px-2 py-2 text-sm font-medium ${
                          item === "Editor"
                            ? "bg-[#dfe6ff] text-[#263dc7]"
                            : "text-[#3a4a65]"
                        }`}
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </aside>

                <div className="p-3 sm:p-4">
                  <div className="flex flex-wrap items-center gap-2 border-b border-[#e3e8f4] pb-3">
                    {["Undo", "Redo", "Add person", "Autofill", "Save", "Export"].map((action) => (
                      <span
                        key={action}
                        className="inline-flex h-8 items-center rounded-md border border-[#d3dbeb] bg-white px-3 text-xs font-semibold text-[#27374f]"
                      >
                        {action}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full min-w-[760px] border-separate border-spacing-0 overflow-hidden rounded-xl border border-[#d7deee]">
                      <thead>
                        <tr>
                          <th className="w-[140px] border-b border-[#d7deee] bg-[#f4f7fd] px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.09em] text-[#66748c]">
                            Time
                          </th>
                          {demoColumns.map((column) => (
                            <th
                              key={column.name}
                              className="border-b border-l border-[#d7deee] bg-[#f4f7fd] px-3 py-2 text-left"
                            >
                              <p className="text-sm font-semibold text-[#15233a]">{column.name}</p>
                              <p className="text-xs font-medium text-[#5f6f88]">{column.hours}</p>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {demoRows.map((row) => (
                          <tr key={row.time}>
                            <td className="border-b border-[#e1e7f4] bg-white px-3 py-2 text-xs font-semibold text-[#5b6980]">
                              {row.time}
                            </td>
                            {row.tasks.map((task, idx) => (
                              <td key={`${row.time}-${idx}`} className="border-b border-l border-[#e1e7f4] bg-white p-1.5 align-middle">
                                {task ? (
                                  <span
                                    className={`block rounded-md px-2 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.04em] ${taskToneClass(task.tone)}`}
                                  >
                                    {task.label}
                                  </span>
                                ) : (
                                  <span className="block py-3 text-center text-sm font-semibold text-[#c4cede]">+</span>
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
