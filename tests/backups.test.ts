import { describe, expect, it } from "vitest";
import { BACKUP_FORMAT, BACKUP_VERSION, parseBackupData, summarizeBackup } from "@/lib/backups";

const validBackup = {
  format: BACKUP_FORMAT,
  version: BACKUP_VERSION,
  createdAt: "2026-11-01T10:00:00.000Z",
  people: [{ id: "1", name: "Claire", schedule: { Mon: { enabled: true, start: "09:00", end: "17:00" } } }],
  taskTemplates: [{ id: "tour", name: "Public Tour", category: "Tours", qualifiedPersonIds: ["1"] }],
  settings: { hoursByDay: {}, upcomingDays: 500 },
  rosters: [{ id: "2026-11-02", employees: [{ id: "1", name: "Claire" }], tasks: [] }],
};

describe("parseBackupData", () => {
  it("rejects files that aren't backups", () => {
    expect(() => parseBackupData({ hello: "world" })).toThrow(/isn't a Roster Generator backup/);
    expect(() => parseBackupData({ ...validBackup, version: 2 })).toThrow();
    expect(() => parseBackupData({ ...validBackup, rosters: [{ id: "not-a-date", employees: [], tasks: [] }] })).toThrow();
  });

  it("fills in defaults so a restore always writes complete records", () => {
    const data = parseBackupData(validBackup);
    expect(summarizeBackup(data)).toEqual({ people: 1, taskTemplates: 1, rosters: 1 });
    expect(data.people[0].schedule.Tue).toEqual({ enabled: false, start: "09:00", end: "17:00" });
    expect(data.taskTemplates[0].qualifiedPersonIds).toEqual(["1"]);
    expect(data.taskTemplates[0].waitingMinutes).toBe(15);
    expect(data.settings.upcomingDays).toBe(90);
    expect(data.rosters[0]).toMatchObject({ id: "2026-11-02", status: "Draft", people: 1 });
  });
});
