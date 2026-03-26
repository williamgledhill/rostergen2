"use client";
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, X } from "lucide-react";
import { ALL_DAYS, Person, defaultSchedule } from "@/lib/people";

export default function PeopleList() {
  const [people, setPeople] = useState<Person[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<Person>({ id: "", name: "", email: "", schedule: defaultSchedule([]) });
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const dayRows = [
    { key: "Mon", label: "Monday" },
    { key: "Tue", label: "Tuesday" },
    { key: "Wed", label: "Wednesday" },
    { key: "Thu", label: "Thursday" },
    { key: "Fri", label: "Friday" },
    { key: "Sat", label: "Saturday" },
    { key: "Sun", label: "Sunday" },
  ];

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/people");
        if (!res.ok) throw new Error("Failed to load");
        const data = await res.json();
        setPeople(data);
      } catch (err) {
        console.error(err);
        setPeople([]);
      }
    }
    load();
  }, []);

  const summaries = people.map((p) => {
    const activeDays = ALL_DAYS.filter((d) => p.schedule[d]?.enabled);
    return {
      id: p.id,
      name: p.name,
      days: activeDays.length ? activeDays.join(", ") : "No default days",
    };
  });

  function openModal() { setModalOpen(true); }
  function closeModal() { setModalOpen(false); }

  function resetForm() {
    setForm({ id: "", name: "", email: "", schedule: defaultSchedule([]) });
  }

  function handleOpen() {
    resetForm();
    openModal();
  }

  function updateDay(day: string, patch: Partial<{ enabled: boolean; start: string; end: string }>) {
    setForm((prev) => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [day]: { ...prev.schedule[day], ...patch },
      },
    }));
  }

  async function handleSave() {
    const payload: Person = {
      ...form,
      id: form.id || Date.now().toString(),
      name: form.name.trim(),
      email: form.email?.trim() || "",
    };
    if (!payload.name) return;
    try {
      const res = await fetch("/api/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save");
      const saved = await res.json();
      setPeople((prev) => {
        const idx = prev.findIndex((p) => p.id === saved.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = saved;
          return next;
        }
        return [...prev, saved];
      });
      closeModal();
    } catch (err) {
      console.error(err);
      alert("Failed to save employee");
    }
  }

  function toggleRow(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const set = new Set(prev);
      if (checked) set.add(id); else set.delete(id);
      return Array.from(set);
    });
  }

  function toggleAll(checked: boolean) {
    if (checked) {
      setSelectedIds(summaries.map((s) => String(s.id)));
    } else {
      setSelectedIds([]);
    }
  }

  return (
    <div className="w-full py-3 px-3">
      <div className="space-y-3 flex flex-col items-start w-full">
        <div className="flex items-center justify-between w-full">
          <div>
            <h1 className="text-2xl font-semibold">People</h1>
            <p className="text-slate-600 text-[14px]">Manage employees and their default working hours.</p>
          </div>
          <button className="btn btn-primary px-4 py-2" style={{ borderRadius: "6px" }} onClick={handleOpen}>
            <Plus className="w-4 h-4 text-white" strokeWidth={2.3} />
            <span className="text-[14px] font-medium">Add employee</span>
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm w-full overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-sm border-collapse">
              <colgroup>
                <col className="w-10" />
                <col className="w-[38%]" />
                <col />
              </colgroup>
              <thead className="text-slate-600 text-sm">
                <tr className="border-b border-[#E6EAF0]">
                  <th className="w-10 px-3 py-3 text-left font-semibold">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      aria-label="Select all"
                      checked={selectedIds.length > 0 && selectedIds.length === summaries.length}
                      onChange={(e) => toggleAll(e.target.checked)}
                    />
                  </th>
                  <th className="px-3 py-3 text-left font-semibold">Employee</th>
                  <th className="px-3 py-3 text-left font-semibold">Default days</th>
                </tr>
              </thead>
              <tbody>
                {summaries.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-[#E6EAF0] hover:bg-[#f8fafc] cursor-pointer"
                    onClick={() => router.push(`/people/${p.id}`)}
                  >
                    <td className="align-middle px-3 py-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        aria-label={`Select ${p.name}`}
                        checked={selectedIds.includes(String(p.id))}
                        onClick={(e)=>e.stopPropagation()}
                        onChange={(e)=>toggleRow(String(p.id), e.target.checked)}
                      />
                    </td>
                    <td className="align-middle px-3 py-3">
                      <div className="inline-flex items-center gap-2 font-semibold text-slate-800">
                        <span className="block truncate">{p.name}</span>
                      </div>
                    </td>
                    <td className="align-middle px-3 py-3 text-slate-600">
                      <span className="block truncate">{p.days || ""}</span>
                    </td>
                  </tr>
                ))}
                {summaries.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-6 text-center text-slate-600">No people yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 text-sm text-slate-600">{summaries.length} employee{summaries.length === 1 ? "" : "s"}</div>
        </div>

        {modalOpen && (
          <div
            className="fixed inset-0 z-[2147483647] bg-black/40 flex items-center justify-center"
            style={{ top: 0, left: 0, right: 0, bottom: 0, margin: 0, padding: 0 }}
            onClick={closeModal}
          >
            <div
              className="bg-white rounded-[8px] w-full max-w-xl shadow-xl border border-[var(--border)] overflow-hidden mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4">
                <div>
                  <h2 className="text-xl font-semibold">Add employee</h2>
                  <p className="text-sm text-slate-600">Enter details for a new employee.</p>
                </div>
                <button
                  className="p-2 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-[#f5f7fa] transition"
                  onClick={closeModal}
                  aria-label="Close"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="px-6 pb-5 space-y-6 text-[14px]" style={{ color: "#1A1B25" }}>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold mb-1" style={{ color: "#1A1B25" }}>Name</label>
                    <p className="text-xs text-slate-500 mb-1">Employee display name; appears on rosters.</p>
                    <input
                      className="input w-full text-[14px]"
                      style={{ color: "#1A1B25" }}
                      placeholder=""
                      value={form.name}
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1" style={{ color: "#1A1B25" }}>Email</label>
                    <input
                      className="input w-full text-[14px]"
                      style={{ color: "#1A1B25" }}
                      type="email"
                      placeholder=""
                      value={form.email ?? ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-1" style={{ color: "#1A1B25" }}>Standard work roster</label>
                    <p className="text-xs text-slate-500 mb-2">Used by roster generator</p>
                    <div className="border border-[var(--border)] rounded-md divide-y divide-[var(--border)]">
                      {dayRows.map((day) => (
                        <div key={day.key} className="grid grid-cols-[120px,1fr,1fr] items-center gap-3 px-3 py-3">
                          <label className="flex items-center gap-2 text-sm font-semibold" style={{ color: "#1A1B25" }}>
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              aria-label={`Enable ${day.label}`}
                              checked={!!form.schedule[day.key]?.enabled}
                              onChange={(e) => updateDay(day.key, { enabled: e.target.checked })}
                              style={{ accentColor: "rgb(103, 93, 255)" }}
                            />
                            <span>{day.label}</span>
                          </label>
                          <input
                            type="time"
                            className="input text-[14px]"
                            style={{ color: "#1A1B25" }}
                            value={form.schedule[day.key]?.start || ""}
                            onChange={(e) => updateDay(day.key, { start: e.target.value })}
                            disabled={!form.schedule[day.key]?.enabled}
                            aria-label={`${day.label} start time`}
                          />
                          <input
                            type="time"
                            className="input text-[14px]"
                            style={{ color: "#1A1B25" }}
                            value={form.schedule[day.key]?.end || ""}
                            onChange={(e) => updateDay(day.key, { end: e.target.value })}
                            disabled={!form.schedule[day.key]?.enabled}
                            aria-label={`${day.label} end time`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              <div className="px-6 py-4 flex items-center justify-end gap-3 bg-white">
                <button
                  className="btn h-[30px] justify-center text-black/80 hover:text-black"
                  style={{ width: "65px", boxShadow: "inset 0 0 0 1px #CFCFCF", borderRadius: "6px", border: "none", background: "white" }}
                  onClick={closeModal}
                >
                  Cancel
                </button>
                <button className="btn btn-primary px-4 h-[30px]" style={{ borderRadius: "6px", width: "auto", minWidth: "unset" }} onClick={handleSave}>
                  Add employee
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

