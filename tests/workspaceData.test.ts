import { describe, expect, it } from "vitest";
import { defaultSchedule, type Person } from "../lib/people";
import {
  editorDataKey,
  peopleDataKey,
  personDataKey,
  readCachedResource,
  upsertCachedPerson,
  writeCachedResource,
  type EditorPayload,
} from "../lib/workspaceData";

function makePerson(id: string, days: string[]): Person {
  return {
    id,
    name: `Person ${id}`,
    email: `${id}@example.com`,
    schedule: defaultSchedule(days),
  };
}

describe("workspaceData person cache updates", () => {
  it("updates person caches and invalidates editor payloads when a person schedule changes", () => {
    const person = makePerson("cache-test-person", ["Mon"]);
    const updated = makePerson("cache-test-person", ["Mon", "Sun"]);
    const editorKey = editorDataKey("2026-05-03");

    writeCachedResource(peopleDataKey(), [person]);
    writeCachedResource(personDataKey(person.id), person);
    writeCachedResource<EditorPayload>(editorKey, {
      people: [person],
      settings: {
        hoursByDay: {
          Mon: { start: "09:00", end: "17:00" },
          Tue: { start: "09:00", end: "17:00" },
          Wed: { start: "09:00", end: "17:00" },
          Thu: { start: "09:00", end: "17:00" },
          Fri: { start: "09:00", end: "17:00" },
          Sat: { start: "09:00", end: "17:00" },
          Sun: { start: "09:00", end: "17:00" },
        },
        upcomingDays: 7,
      },
      templates: [],
      savedRoster: null,
    });

    upsertCachedPerson(updated);

    const people = readCachedResource<Person[]>(peopleDataKey());
    const cachedPerson = readCachedResource<Person>(personDataKey(person.id));
    const editor = readCachedResource<EditorPayload>(editorKey);

    expect(people.hit && people.data[0].schedule.Sun.enabled).toBe(true);
    expect(cachedPerson.hit && cachedPerson.data.schedule.Sun.enabled).toBe(true);
    expect(editor.hit).toBe(false);
  });
});
