"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, ChevronDown, Clock3, FileSpreadsheet, Pencil, Plus, Trash2, Upload, Users, X } from "lucide-react";
import { parseSchoolTourWorkbook } from "@/lib/schoolTourImports";
import type { SchoolTour } from "@/lib/schoolTourTypes";
import { buildEditorHref } from "@/lib/editorPersistence";
import { navigateWithinSpa } from "@/lib/spaNavigation";
import {
  invalidateWorkspaceResources,
  notifyWorkspaceResourcesChanged,
  preloadWorkspaceRoute,
  toursDataKey,
  writeCachedResource,
} from "@/lib/workspaceData";

type TourForm = {
  id?: string;
  rosterDateId: string;
  startTime: string;
  schoolName: string;
  studentCount: string;
};

const blankForm: TourForm = {
  rosterDateId: "",
  startTime: "09:30",
  schoolName: "",
  studentCount: "",
};

function todayDateId() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatDateLabel(dateId: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateId)) return dateId;
  const [year, month, day] = dateId.split("-").map(Number);
  return new Intl.DateTimeFormat("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function tourKey(tour: Pick<SchoolTour, "rosterDateId" | "startTime" | "schoolName" | "studentCount">) {
  return `${tour.rosterDateId}|${tour.startTime}|${tour.schoolName.trim().toLowerCase()}|${tour.studentCount}`;
}

function sortTours(tours: SchoolTour[]) {
  return [...tours].sort((a, b) => {
    if (a.rosterDateId !== b.rosterDateId) return a.rosterDateId.localeCompare(b.rosterDateId);
    if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
    return a.schoolName.localeCompare(b.schoolName);
  });
}

function formFromTour(tour: SchoolTour): TourForm {
  return {
    id: tour.id,
    rosterDateId: tour.rosterDateId,
    startTime: tour.startTime,
    schoolName: tour.schoolName,
    studentCount: String(tour.studentCount),
  };
}

function tourFromForm(form: TourForm) {
  return {
    id: form.id,
    rosterDateId: form.rosterDateId,
    startTime: form.startTime,
    schoolName: form.schoolName.trim(),
    studentCount: Number(form.studentCount),
  };
}

export default function ToursClient({ initialTours }: { initialTours: SchoolTour[] }) {
  const [tours, setTours] = useState<SchoolTour[]>(() => sortTours(initialTours));
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState<TourForm>({ ...blankForm, rosterDateId: todayDateId() });
  const [saveError, setSaveError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    setTours(sortTours(initialTours));
  }, [initialTours]);

  const summary = useMemo(() => {
    const dates = new Set(tours.map((tour) => tour.rosterDateId));
    const students = tours.reduce((total, tour) => total + tour.studentCount, 0);
    return { dates: dates.size, students };
  }, [tours]);

  function syncTours(nextTours: SchoolTour[]) {
    const sorted = sortTours(nextTours);
    setTours(sorted);
    writeCachedResource(toursDataKey(), sorted);
    notifyWorkspaceResourcesChanged([toursDataKey()]);
    invalidateWorkspaceResources(["rosters", "rosters-old", "rosters-month", "editor"]);
  }

  async function refreshTours() {
    const res = await fetch("/api/tours", { cache: "no-store" });
    if (!res.ok) throw new Error("Failed to refresh tours");
    syncTours((await res.json()) as SchoolTour[]);
  }

  function openCreate() {
    setForm({ ...blankForm, rosterDateId: todayDateId() });
    setSaveError("");
    setModalOpen(true);
  }

  function openEdit(tour: SchoolTour) {
    setForm(formFromTour(tour));
    setSaveError("");
    setModalOpen(true);
  }

  function closeModal() {
    if (isSaving) return;
    setModalOpen(false);
    setSaveError("");
  }

  async function saveTour(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const payload = tourFromForm(form);
    if (!payload.rosterDateId || !payload.startTime || !payload.schoolName || !Number.isFinite(payload.studentCount)) return;

    try {
      setIsSaving(true);
      setSaveError("");
      const res = await fetch("/api/tours", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save tour");
      const saved = (await res.json()) as SchoolTour;
      syncTours([...tours.filter((tour) => tour.id !== saved.id), saved]);
      setModalOpen(false);
    } catch (error) {
      console.error(error);
      setSaveError("Failed to save tour.");
    } finally {
      setIsSaving(false);
    }
  }

  async function deleteTour(tour: SchoolTour) {
    if (!window.confirm(`Delete ${tour.schoolName} on ${tour.rosterDateId}?`)) return;
    try {
      const res = await fetch(`/api/tours?id=${encodeURIComponent(tour.id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete tour");
      syncTours(tours.filter((current) => current.id !== tour.id));
    } catch (error) {
      console.error(error);
      window.alert("Failed to delete tour.");
    }
  }

  async function importTours(file: File | null | undefined) {
    if (!file) return;
    try {
      setIsImporting(true);
      const imported = parseSchoolTourWorkbook(await file.arrayBuffer());
      if (imported.length === 0) {
        window.alert("No tours were found in that workbook.");
        return;
      }

      const existingByKey = new Map(tours.map((tour) => [tourKey(tour), tour]));
      const importedByKey = new Map(imported.map((tour) => [tourKey(tour), tour]));
      await Promise.all(
        Array.from(importedByKey.values()).map((tour) => {
          const existing = existingByKey.get(tourKey(tour));
          return fetch("/api/tours", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...tour, id: existing?.id }),
          }).then((res) => {
            if (!res.ok) throw new Error("Failed to import tours");
          });
        })
      );
      await refreshTours();
      window.alert(`Imported ${imported.length} tour${imported.length === 1 ? "" : "s"}.`);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Unable to import tours.";
      window.alert(message);
    } finally {
      setIsImporting(false);
      if (uploadInputRef.current) uploadInputRef.current.value = "";
    }
  }

  function openRoster(tour: SchoolTour) {
    const href = buildEditorHref(tour.rosterDateId);
    if (!navigateWithinSpa(href)) router.push(href);
  }

  return (
    <div className="workspace-page">
      <div className="flex w-full flex-col items-start space-y-7">
        <div className="flex w-full flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="page-title">Tours</h1>
            <p className="page-description mt-1.5">Manage school tours and keep them available to the daily roster editor.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={uploadInputRef}
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="sr-only"
              onChange={(event) => void importTours(event.target.files?.[0])}
            />
            <button className="btn px-4" onClick={() => uploadInputRef.current?.click()} disabled={isImporting}>
              <Upload className="h-4 w-4" aria-hidden="true" />
              <span>{isImporting ? "Importing..." : "Import XLSX"}</span>
            </button>
            <button className="btn btn-primary px-4" onClick={openCreate}>
              <Plus className="h-4 w-4 text-white" strokeWidth={2.3} aria-hidden="true" />
              <span className="text-[14px] font-medium">Add tour</span>
            </button>
          </div>
        </div>

        <div className="grid w-full gap-3 sm:grid-cols-3">
          <div className="surface-panel px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-[8px] bg-[var(--accent-soft)] text-[var(--accent)]">
                <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[12px] font-bold uppercase text-[var(--muted)]">Tours</p>
                <p className="text-[20px] font-bold text-[var(--ink)]">{tours.length}</p>
              </div>
            </div>
          </div>
          <div className="surface-panel px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-[8px] bg-[var(--accent-soft)] text-[var(--accent)]">
                <CalendarDays className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[12px] font-bold uppercase text-[var(--muted)]">Dates</p>
                <p className="text-[20px] font-bold text-[var(--ink)]">{summary.dates}</p>
              </div>
            </div>
          </div>
          <div className="surface-panel px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-[8px] bg-[var(--accent-soft)] text-[var(--accent)]">
                <Users className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="text-[12px] font-bold uppercase text-[var(--muted)]">Students</p>
                <p className="text-[20px] font-bold text-[var(--ink)]">{summary.students}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="surface-panel">
          <div className="overflow-x-auto">
            <table className="data-table min-w-[880px] table-fixed">
              <colgroup>
                <col className="w-[21%]" />
                <col className="w-[13%]" />
                <col />
                <col className="w-[14%]" />
                <col className="w-[150px]" />
              </colgroup>
              <thead className="text-[15px] text-slate-900">
                <tr className="border-b border-[var(--border)]">
                  <th className="px-4 py-4 text-left font-bold tracking-[0.01em]">
                    <span className="inline-flex items-center gap-2">
                      Date
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                    </span>
                  </th>
                  <th className="px-4 py-4 text-left font-bold tracking-[0.01em]">Time</th>
                  <th className="px-4 py-4 text-left font-bold tracking-[0.01em]">School</th>
                  <th className="px-4 py-4 text-left font-bold tracking-[0.01em]">Students</th>
                  <th className="px-4 py-4 text-right font-bold tracking-[0.01em]">Actions</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-b-0">
                {tours.map((tour) => {
                  const href = buildEditorHref(tour.rosterDateId);
                  return (
                    <tr
                      key={tour.id}
                      className="border-b border-[var(--border)] hover:bg-[var(--surface-subtle)]"
                      onMouseEnter={() => {
                        preloadWorkspaceRoute(href);
                        router.prefetch(href);
                      }}
                    >
                      <td className="align-middle px-4 py-4 text-[15px] font-bold text-[var(--ink)]">
                        <button
                          type="button"
                          className="block truncate text-left transition hover:text-[var(--accent)]"
                          onClick={() => openRoster(tour)}
                          title="Open roster"
                        >
                          {formatDateLabel(tour.rosterDateId)}
                        </button>
                      </td>
                      <td className="align-middle px-4 py-4 text-[15px] font-semibold text-[var(--muted-strong)]">
                        <span className="inline-flex items-center gap-2">
                          <Clock3 className="h-4 w-4" aria-hidden="true" />
                          {tour.startTime}
                        </span>
                      </td>
                      <td className="align-middle px-4 py-4 text-[15px] font-bold text-[var(--ink)]">
                        <span className="block truncate">{tour.schoolName}</span>
                      </td>
                      <td className="align-middle px-4 py-4 text-[15px] font-semibold text-[var(--muted-strong)]">
                        {tour.studentCount}
                      </td>
                      <td className="align-middle px-4 py-4">
                        <div className="flex justify-end gap-2">
                          <button className="icon-button h-9 w-10" onClick={() => openEdit(tour)} aria-label={`Edit ${tour.schoolName}`} title="Edit tour">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button className="icon-button h-9 w-10 text-rose-700" onClick={() => void deleteTour(tour)} aria-label={`Delete ${tour.schoolName}`} title="Delete tour">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {tours.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-[15px] text-[var(--muted)]">
                      No tours yet. Add one or import an XLSX runsheet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="table-footer">
            {tours.length} tour{tours.length === 1 ? "" : "s"}
          </div>
        </div>

        {modalOpen && (
          <div className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/40 px-4" onClick={closeModal}>
            <form
              className="w-full max-w-xl overflow-hidden rounded-[8px] border border-[var(--border)] bg-white shadow-xl"
              onClick={(event) => event.stopPropagation()}
              onSubmit={saveTour}
            >
              <div className="flex items-center justify-between px-6 py-4">
                <div>
                  <h2 className="text-xl font-semibold">{form.id ? "Edit tour" : "Add tour"}</h2>
                  <p className="text-sm text-slate-600">Tour records are attached to their roster date.</p>
                </div>
                <button
                  type="button"
                  className="rounded-[10px] p-2 text-slate-500 transition hover:bg-[var(--surface-subtle)] hover:text-slate-700"
                  onClick={closeModal}
                  aria-label="Close"
                  disabled={isSaving}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-5 px-6 pb-5 text-[14px]" style={{ color: "#1A1B25" }}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm font-semibold" htmlFor="tour-date" style={{ color: "#1A1B25" }}>
                      Date
                    </label>
                    <input
                      id="tour-date"
                      type="date"
                      className="input w-full text-[14px]"
                      value={form.rosterDateId}
                      onChange={(event) => setForm((prev) => ({ ...prev, rosterDateId: event.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold" htmlFor="tour-time" style={{ color: "#1A1B25" }}>
                      Time
                    </label>
                    <input
                      id="tour-time"
                      type="time"
                      step={900}
                      className="input w-full text-[14px]"
                      value={form.startTime}
                      onChange={(event) => setForm((prev) => ({ ...prev, startTime: event.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold" htmlFor="tour-school" style={{ color: "#1A1B25" }}>
                    School
                  </label>
                  <input
                    id="tour-school"
                    className="input w-full text-[14px]"
                    value={form.schoolName}
                    onChange={(event) => setForm((prev) => ({ ...prev, schoolName: event.target.value }))}
                    autoFocus
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-semibold" htmlFor="tour-students" style={{ color: "#1A1B25" }}>
                    Students
                  </label>
                  <input
                    id="tour-students"
                    type="number"
                    min={0}
                    max={10000}
                    className="input w-full text-[14px]"
                    value={form.studentCount}
                    onChange={(event) => setForm((prev) => ({ ...prev, studentCount: event.target.value }))}
                    required
                  />
                </div>

                {saveError && <p className="text-sm text-red-600">{saveError}</p>}
              </div>

              <div className="flex items-center justify-end gap-3 bg-white px-6 py-4">
                <button
                  type="button"
                  className="btn h-[30px] justify-center text-black/80 hover:text-black"
                  style={{ width: "65px", boxShadow: "inset 0 0 0 1px #CFCFCF", borderRadius: "6px", border: "none", background: "white" }}
                  onClick={closeModal}
                  disabled={isSaving}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary h-[30px] px-4"
                  style={{ borderRadius: "6px" }}
                  type="submit"
                  disabled={isSaving || !form.rosterDateId || !form.startTime || !form.schoolName.trim() || !form.studentCount}
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
