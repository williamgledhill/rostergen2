import EditorClient from "./EditorClient";
import { requirePageSession } from "@/lib/apiAuth";
import { formatLocalId, parseLocalId } from "@/lib/dateUtils";
import { getDayScheduleForDate, type Person } from "@/lib/people";
import { getPeople } from "@/lib/peopleStore";
import { getRosterById } from "@/lib/rosters";
import { getSettings } from "@/lib/settings";
import { getTaskTemplates } from "@/lib/taskTemplatesStore";

export const dynamic = "force-dynamic";

function syncEmployeesWithPeople(employees: any[], people: Person[]) {
  const byId = new Map(people.map((p) => [String(p.id), p.name]));
  const byName = new Map(people.map((p) => [p.name.toLowerCase(), p.name]));
  return employees.map((employee) => {
    const id = String(employee?.id ?? "");
    const name = typeof employee?.name === "string" ? employee.name : "";
    return {
      ...employee,
      name: byId.get(id) ?? byName.get(name.toLowerCase()) ?? name,
    };
  });
}

function workingPeopleForDate(date: Date, people: Person[]) {
  return people
    .filter((person) => getDayScheduleForDate(person, date).enabled)
    .map((person) => ({ id: person.id, name: person.name }));
}

function hasMeaningfulSavedLayout(
  roster: { employees?: any[]; tasks?: any[] } | null
) {
  if (!roster) return false;
  const employees = Array.isArray(roster.employees) ? roster.employees : [];
  const tasks = Array.isArray(roster.tasks) ? roster.tasks : [];
  return employees.length > 0 || tasks.length > 0;
}

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ date?: string }>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const dateParam = typeof resolvedSearchParams.date === "string" ? resolvedSearchParams.date : "";
  const selectedDate = parseLocalId(dateParam) ?? new Date();
  const rosterDateId = formatLocalId(selectedDate);
  const [_, people, settings, templates, savedRoster] = await Promise.all([
    requirePageSession(),
    getPeople(),
    getSettings(),
    getTaskTemplates(),
    getRosterById(rosterDateId),
  ]);

  const defaultEmployees = workingPeopleForDate(selectedDate, people);
  const savedEmployees = Array.isArray(savedRoster?.employees) ? savedRoster!.employees : [];
  const savedTasks = Array.isArray(savedRoster?.tasks) ? savedRoster!.tasks : [];
  const hasSavedLayout = hasMeaningfulSavedLayout(savedRoster);
  const baseEmployees = hasSavedLayout ? savedEmployees : defaultEmployees;
  const baseTasks = hasSavedLayout ? savedTasks : [];

  return (
    <EditorClient
      selectedDate={selectedDate}
      people={people}
      settings={settings}
      templates={templates}
      initialRoster={{
        employees: syncEmployeesWithPeople(baseEmployees, people),
        tasks: baseTasks,
        hoursStart: savedRoster?.hoursStart,
        hoursEnd: savedRoster?.hoursEnd,
      }}
    />
  );
}
