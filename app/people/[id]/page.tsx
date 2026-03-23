"use client";
import React, { useEffect, useMemo, useState } from "react";
import { notFound, useRouter, useParams } from "next/navigation";
import TopBar from "@/components/TopBar";
import { ALL_DAYS, DaySchedule, Person } from "@/lib/people";

function formatTitle(name: string) {
  return `${name}'s default hours`;
}

export default function PersonDetail() {
  // useParams is the canonical way in client components
  const routeParams = useParams<{ id: string }>();
  const id = routeParams?.id;

  const [person, setPerson] = useState<Person | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    async function load(targetId: string) {
      try {
        const res = await fetch(`/api/people?id=${targetId}`);
        if (!res.ok) throw new Error("Not found");
        const data = await res.json();
        if (active) setPerson(data);
      } catch (err) {
        console.error(err);
        if (active) setPerson(null);
      } finally {
        if (active) setLoading(false);
      }
    }
    if (id) {
      load(id);
    } else {
      setLoading(false);
    }
    return () => { active = false; };
  }, [id]);

  const toggleDay = (day: string) => {
    setPerson(prev => {
      if (!prev) return prev;
      const current = prev.schedule[day];
      const next: DaySchedule = { ...current, enabled: !current.enabled };
      return { ...prev, schedule: { ...prev.schedule, [day]: next } };
    });
  };

  const updateTime = (day: string, which: "start" | "end", value: string) => {
    setPerson(prev => {
      if (!prev) return prev;
      const current = prev.schedule[day];
      const next: DaySchedule = { ...current, [which]: value };
      return { ...prev, schedule: { ...prev.schedule, [day]: next } };
    });
  };

  async function save() {
    if (!person) return;
    try {
      const res = await fetch("/api/people", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(person),
      });
      if (!res.ok) throw new Error("Save failed");
      alert("Saved");
    } catch (err) {
      console.error(err);
      alert("Failed to save");
    }
  }
  async function remove() {
    if (!id) return;
    if (!confirm("Delete this employee?")) return;
    try{
      const res = await fetch(`/api/people?id=${id}`, { method: "DELETE" });
      if(!res.ok) throw new Error("Delete failed");
      router.push("/people");
    }catch(err){
      console.error(err);
      alert("Failed to delete");
    }
  }
  function rename(){
    const name = prompt("Rename employee", person?.name ?? "");
    if(!name || !person) return;
    const trimmed = name.trim();
    if(!trimmed) return;
    setPerson(prev => prev ? ({...prev, name: trimmed}) : prev);
  }

  if (loading) {
    return (
      <div className="w-full py-4 px-3">
        <div className="space-y-4 flex flex-col items-start">
          <TopBar showActions={false} />
          <p className="text-slate-700">Loading...</p>
        </div>
      </div>
    );
  }

  if (!id) return notFound();
  if (!person) return notFound();

  return (
    <div className="w-full py-4 px-3">
      <div className="space-y-3 flex flex-col items-start">
        <div className="flex items-center justify-between w-full">
          <button className="btn" onClick={()=>router.push("/people")}>Back</button>
          <div className="text-center flex-1">
            <h1 className="text-2xl font-semibold">{formatTitle(person.name)}</h1>
            <p className="text-slate-600">Adjust working days and hours for {person.name}.</p>
          </div>
          <div className="flex items-center gap-2">
            <button className="btn" onClick={rename}>Rename</button>
            <button className="btn" onClick={remove}>Delete</button>
            <button className="btn whitespace-nowrap" onClick={save}>Save</button>
          </div>
        </div>

        <div className="card border border-[var(--border)] bg-white w-full">
          <div className="px-4 py-3 border-b border-[var(--border)]">
            <h2 className="text-lg font-semibold">Schedule</h2>
            <p className="text-sm text-slate-600">Toggle a day, then set start/end times.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="table-clean">
              <thead>
                <tr>
                  <th className="w-32">Day</th>
                  <th className="w-28 text-center">Working</th>
                  <th className="w-32 text-center">Start</th>
                  <th className="w-32 text-center">End</th>
                </tr>
              </thead>
              <tbody>
                {ALL_DAYS.map(day => {
                  const sched = person.schedule[day];
                  return (
                    <tr key={day}>
                      <td className="font-semibold">{day}</td>
                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="h-4 w-4"
                          checked={sched.enabled}
                          onChange={()=>toggleDay(day)}
                        />
                      </td>
                      <td className="text-center">
                        <input
                          type="time"
                          className="input text-sm px-2 py-[6px]"
                          value={sched.start}
                          onChange={(e)=>updateTime(day, "start", e.target.value)}
                          disabled={!sched.enabled}
                        />
                      </td>
                      <td className="text-center">
                        <input
                          type="time"
                          className="input text-sm px-2 py-[6px]"
                          value={sched.end}
                          onChange={(e)=>updateTime(day, "end", e.target.value)}
                          disabled={!sched.enabled}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
