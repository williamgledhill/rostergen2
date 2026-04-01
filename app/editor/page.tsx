import EditorClient from "./EditorClient";
import { requirePageSession } from "@/lib/apiAuth";
import { parseLocalId } from "@/lib/dateUtils";
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

export default async function Page({
  searchParams,
}: {
  searchParams?: Promise<{ date?: string }>;
}) {
  await requirePageSession();

  const resolvedSearchParams = (await searchParams) ?? {};
  const dateParam = typeof resolvedSearchParams.date === "string" ? resolvedSearchParams.date : "";
  const selectedDate = parseLocalId(dateParam) ?? new Date();
  const [people, settings, templates, savedRoster] = await Promise.all([
    getPeople(),
    getSettings(),
    getTaskTemplates(),
    getRosterById(dateParam),
  ]);

  const baseEmployees = Array.isArray(savedRoster?.employees)
    ? savedRoster!.employees
    : workingPeopleForDate(selectedDate, people);

  return (
    <EditorClient
      selectedDate={selectedDate}
      people={people}
      settings={settings}
      templates={templates}
      initialRoster={{
        employees: syncEmployeesWithPeople(baseEmployees, people),
        tasks: Array.isArray(savedRoster?.tasks) ? savedRoster!.tasks : [],
        hoursStart: savedRoster?.hoursStart,
        hoursEnd: savedRoster?.hoursEnd,
      }}
    />
  );
}
