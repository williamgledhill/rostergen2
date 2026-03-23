"use client";
import React, { useEffect, useMemo, useState } from "react";
import { AppSettings, DEFAULT_SETTINGS, DAY_KEYS } from "@/lib/settingsDefaults";

const DAY_LABELS: Record<string, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const invalidDays = useMemo(() => {
    return DAY_KEYS.filter((day) => settings.hoursByDay[day].start >= settings.hoursByDay[day].end);
  }, [settings]);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const res = await fetch("/api/settings");
        if (!res.ok) throw new Error("Failed to load settings");
        const data = await res.json();
        if (active) setSettings(data);
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setLoaded(true);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  function updateDay(day: string, field: "start" | "end", value: string) {
    setSettings((prev) => ({
      ...prev,
      hoursByDay: {
        ...prev.hoursByDay,
        [day]: { ...prev.hoursByDay[day as keyof typeof prev.hoursByDay], [field]: value },
      },
    }));
  }

  function updateUpcomingDays(value: string) {
    const numeric = Math.floor(Number(value));
    setSettings((prev) => ({
      ...prev,
      upcomingDays: Number.isFinite(numeric)
        ? Math.min(90, Math.max(1, numeric))
        : DEFAULT_SETTINGS.upcomingDays,
    }));
  }

  async function save() {
    if (invalidDays.length) return;
    try {
      setSaving(true);
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      const data = await res.json();
      setSettings(data);
    } catch (err) {
      console.error(err);
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full py-3 px-3">
      <div className="space-y-4 flex flex-col items-start w-full">
        <div>
          <h1 className="text-2xl font-semibold">Settings</h1>
          <p className="text-slate-600 text-[14px]">Default roster hours by day.</p>
        </div>

        <div className="bg-white rounded-lg shadow-sm w-full border border-[var(--border)]">
          <div className="px-4 py-3 border-b border-[var(--border)] space-y-3">
            <h2 className="text-lg font-semibold">Default Hours</h2>
            <p className="text-sm text-slate-600">Used when creating or opening a roster day.</p>
            <div className="flex items-center gap-3 pt-1">
              <label className="text-sm font-semibold" htmlFor="upcoming-days">Upcoming roster days</label>
              <input
                id="upcoming-days"
                type="number"
                min={1}
                max={90}
                className="input text-[14px] w-[120px]"
                value={settings.upcomingDays}
                onChange={(e) => updateUpcomingDays(e.target.value)}
                aria-label="Upcoming roster days"
              />
              <span className="text-xs text-slate-500">Auto-generates blank upcoming rows from today.</span>
            </div>
          </div>
          <div className="divide-y divide-[var(--border)]">
            <div className="grid grid-cols-[160px,1fr,1fr] gap-3 px-4 py-2 text-[12px] text-slate-500 bg-[var(--surface-subtle)]">
              <span>Day</span>
              <span>From</span>
              <span>To</span>
            </div>
            {DAY_KEYS.map((day) => (
              <div key={day} className="grid grid-cols-[160px,1fr,1fr] items-center gap-3 px-4 py-3">
                <span className="text-sm font-semibold">{DAY_LABELS[day]}</span>
                <input
                  type="time"
                  className="input text-[14px] w-[140px]"
                  value={settings.hoursByDay[day].start}
                  step={900}
                  onChange={(e) => updateDay(day, "start", e.target.value)}
                  aria-label={`${DAY_LABELS[day]} start time`}
                />
                <input
                  type="time"
                  className="input text-[14px] w-[140px]"
                  value={settings.hoursByDay[day].end}
                  step={900}
                  onChange={(e) => updateDay(day, "end", e.target.value)}
                  aria-label={`${DAY_LABELS[day]} end time`}
                />
              </div>
            ))}
          </div>
          <div className="px-4 py-3 flex items-center justify-between">
            {invalidDays.length > 0 ? (
              <span className="text-xs text-red-600">End time must be after start time.</span>
            ) : (
              <span className="text-xs text-slate-500">
                {loaded ? "Changes apply to new or opened rosters." : "Loading settings..."}
              </span>
            )}
            <button
              className="btn btn-primary h-9"
              style={{ borderRadius: "6px", paddingInline: "12px" }}
              onClick={save}
              disabled={saving || invalidDays.length > 0}
            >
              <span className="text-[14px] font-medium text-white">{saving ? "Saving..." : "Save"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

