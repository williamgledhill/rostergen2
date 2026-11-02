import { gunzipSync, gzipSync } from "zlib";
import { z } from "zod";
import { prisma } from "./prisma";
import { formatFullDay, parseLocalId } from "./dateUtils";
import type { Person } from "./people";
import { loadPeople, mapLegacyPerson, scheduleRowsForPerson } from "./peopleStore";
import { mapRosterRecord, toRosterEmployeeRows, toRosterTaskRows } from "./rosters";
import { loadSettings, normalizeHoursByDay, normalizeUpcomingDays, toDayHourRows } from "./settings";
import type { AppSettings } from "./settingsDefaults";
import type { TaskTemplate } from "./taskTemplates";
import { loadTaskTemplates, mapLegacyTemplate, toRelationRows, toTemplateCreateInput } from "./taskTemplatesStore";
import { recordAudit, UserAdminError, type Actor } from "./userAdmin";

export const BACKUP_FORMAT = "roster-generator-backup";
export const BACKUP_VERSION = 1;

export type BackupKind = "manual" | "automatic" | "pre-restore";

/** Automatic backups are taken at most this often, when rosters are saved. */
const AUTOMATIC_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
/** How many of each kind are kept; older ones are deleted. */
const KEEP_BY_KIND: Record<BackupKind, number> = { manual: 30, automatic: 14, "pre-restore": 10 };

export type BackupRoster = {
  id: string;
  title: string;
  status: "Draft" | "Published";
  updated: string;
  tours: number;
  people: number;
  hoursStart?: string;
  hoursEnd?: string;
  employees: unknown[];
  tasks: unknown[];
};

/**
 * Everything needed to put the roster data back as it was. Accounts, sessions
 * and the audit log are left out on purpose: they hold password hashes and
 * two-factor secrets, and restoring them could lock people out.
 */
export type BackupData = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  createdAt: string;
  people: Person[];
  taskTemplates: TaskTemplate[];
  settings: AppSettings;
  rosters: BackupRoster[];
};

export type BackupSummary = { people: number; taskTemplates: number; rosters: number };

export type BackupListItem = {
  id: string;
  kind: BackupKind;
  createdAt: string;
  createdByEmail: string | null;
  sizeBytes: number;
  summary: BackupSummary;
};

const looseRecord = z.record(z.unknown());
const backupFileSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  createdAt: z.string().optional(),
  people: z.array(looseRecord.and(z.object({ id: z.string().min(1).max(120), name: z.string().min(1).max(120) }))).max(2000),
  taskTemplates: z
    .array(looseRecord.and(z.object({ id: z.string().min(1).max(120), name: z.string().min(1).max(120) })))
    .max(2000),
  settings: looseRecord,
  rosters: z
    .array(
      looseRecord.and(
        z.object({
          id: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
          employees: z.array(z.unknown()).max(500),
          tasks: z.array(z.unknown()).max(5000),
        })
      )
    )
    .max(20000),
});

/** Checks a backup file and tidies it into the shape restore expects. Throws if it isn't one. */
export function parseBackupData(input: unknown): BackupData {
  const parsed = backupFileSchema.safeParse(input);
  if (!parsed.success) throw new UserAdminError("That file isn't a Roster Generator backup, or it's damaged.");
  const data = parsed.data;
  const settings = data.settings as Partial<AppSettings>;
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: data.createdAt ?? new Date().toISOString(),
    people: data.people.map((person: any) =>
      mapLegacyPerson({
        id: person.id,
        name: person.name,
        email: typeof person.email === "string" ? person.email : null,
        fortnightAnchorDate: person.fortnight?.anchorDate ?? null,
        schedule: person.schedule,
        fortnight: person.fortnight,
      })
    ),
    taskTemplates: data.taskTemplates.map((template) => mapLegacyTemplate(template)),
    settings: {
      hoursByDay: normalizeHoursByDay(settings.hoursByDay),
      upcomingDays: normalizeUpcomingDays(settings.upcomingDays),
    },
    rosters: data.rosters.map((roster: any) => {
      const date = parseLocalId(roster.id)!;
      return {
        id: roster.id,
        title: typeof roster.title === "string" && roster.title ? roster.title : formatFullDay(date),
        status: roster.status === "Published" ? "Published" : "Draft",
        updated: typeof roster.updated === "string" ? roster.updated : "-",
        tours: Number.isFinite(roster.tours) ? Number(roster.tours) : 0,
        people: Number.isFinite(roster.people) ? Number(roster.people) : roster.employees.length,
        hoursStart: typeof roster.hoursStart === "string" ? roster.hoursStart : undefined,
        hoursEnd: typeof roster.hoursEnd === "string" ? roster.hoursEnd : undefined,
        employees: roster.employees,
        tasks: roster.tasks,
      };
    }),
  };
}

export function summarizeBackup(data: BackupData): BackupSummary {
  return { people: data.people.length, taskTemplates: data.taskTemplates.length, rosters: data.rosters.length };
}

/** Reads the current data straight from the database, skipping every cache. */
export async function collectBackupData(): Promise<BackupData> {
  const [people, taskTemplates, settings, rosterRecords] = await Promise.all([
    loadPeople(),
    loadTaskTemplates(),
    loadSettings(),
    prisma.appRoster.findMany({
      orderBy: { date: "asc" },
      include: { rosterEmployees: true, rosterTasks: true },
      relationLoadStrategy: "join",
    }),
  ]);

  const rosters = rosterRecords.map(mapRosterRecord).map(
    (roster): BackupRoster => ({
      id: roster.id,
      title: roster.title,
      status: roster.status,
      updated: roster.updated,
      tours: roster.tours,
      people: roster.people,
      ...(roster.hoursStart ? { hoursStart: roster.hoursStart } : {}),
      ...(roster.hoursEnd ? { hoursEnd: roster.hoursEnd } : {}),
      employees: roster.employees ?? [],
      tasks: roster.tasks ?? [],
    })
  );

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    people,
    taskTemplates,
    settings,
    rosters,
  };
}

function toListItem(record: {
  id: string;
  kind: string;
  createdAt: Date;
  createdByEmail: string | null;
  sizeBytes: number;
  summary: unknown;
}): BackupListItem {
  const summary = (record.summary ?? {}) as Partial<BackupSummary>;
  return {
    id: record.id,
    kind: (["manual", "automatic", "pre-restore"].includes(record.kind) ? record.kind : "manual") as BackupKind,
    createdAt: record.createdAt.toISOString(),
    createdByEmail: record.createdByEmail,
    sizeBytes: record.sizeBytes,
    summary: {
      people: Number(summary.people) || 0,
      taskTemplates: Number(summary.taskTemplates) || 0,
      rosters: Number(summary.rosters) || 0,
    },
  };
}

const listSelect = { id: true, kind: true, createdAt: true, createdByEmail: true, sizeBytes: true, summary: true } as const;

async function pruneBackups(kind: BackupKind) {
  const stale = await prisma.appBackup.findMany({
    where: { kind },
    orderBy: { createdAt: "desc" },
    skip: KEEP_BY_KIND[kind],
    select: { id: true },
  });
  if (stale.length) await prisma.appBackup.deleteMany({ where: { id: { in: stale.map((entry) => entry.id) } } });
}

export async function createBackup(kind: BackupKind, actor: Actor | null): Promise<BackupListItem> {
  const data = await collectBackupData();
  const compressed = gzipSync(Buffer.from(JSON.stringify(data)));
  const created = await prisma.appBackup.create({
    data: {
      kind,
      createdById: actor?.id ?? null,
      createdByEmail: actor?.email ?? null,
      summary: summarizeBackup(data),
      data: compressed,
      sizeBytes: compressed.length,
    },
    select: listSelect,
  });
  await pruneBackups(kind);
  return toListItem(created);
}

/** Takes an automatic backup if there hasn't been one in the last day. */
export async function ensureRecentAutomaticBackup() {
  const latest = await prisma.appBackup.findFirst({
    where: { kind: "automatic" },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  if (latest && Date.now() - latest.createdAt.getTime() < AUTOMATIC_BACKUP_INTERVAL_MS) return;
  await createBackup("automatic", null);
}

export async function listBackups(): Promise<BackupListItem[]> {
  const records = await prisma.appBackup.findMany({ orderBy: { createdAt: "desc" }, select: listSelect });
  return records.map(toListItem);
}

export async function readBackup(id: string): Promise<{ item: BackupListItem; data: BackupData } | null> {
  const record = await prisma.appBackup.findUnique({ where: { id } });
  if (!record) return null;
  const data = parseBackupData(JSON.parse(gunzipSync(record.data).toString("utf-8")));
  return { item: toListItem(record), data };
}

export async function deleteBackup(actor: Actor, id: string) {
  const deleted = await prisma.appBackup.deleteMany({ where: { id } });
  if (!deleted.count) throw new UserAdminError("Backup not found", 404);
  await recordAudit(prisma, actor, "backup.deleted", null, { backupId: id });
}

/**
 * Replaces all people, tasks, settings and rosters with the backup's. A backup
 * of the current data is taken first, so a restore can itself be undone.
 */
export async function restoreBackup(actor: Actor, data: BackupData, source: { backupId?: string; fileName?: string }) {
  const safetyBackup = await createBackup("pre-restore", actor);

  await prisma.$transaction(
    async (tx) => {
      await tx.appRoster.deleteMany();
      await tx.appTaskTemplate.deleteMany();
      await tx.appPerson.deleteMany();
      await tx.appSettings.deleteMany();

      if (data.people.length) {
        await tx.appPerson.createMany({
          data: data.people.map((person) => ({
            id: person.id,
            name: person.name,
            email: person.email || null,
            fortnightAnchorDate: person.fortnight?.anchorDate ?? null,
            schedule: person.schedule as never,
            ...(person.fortnight ? { fortnight: person.fortnight as never } : {}),
          })),
        });
        await tx.appPersonDaySchedule.createMany({
          data: data.people.flatMap((person) =>
            scheduleRowsForPerson(person).map((row) => ({ personId: person.id, ...row }))
          ),
        });
      }

      if (data.taskTemplates.length) {
        await tx.appTaskTemplate.createMany({ data: data.taskTemplates.map(toTemplateCreateInput) as never });
        const relations = data.taskTemplates.map((template) => toRelationRows(template.id, template));
        const regularDayRules = relations.flatMap((entry) => entry.regularDayRules);
        const timeSlots = relations.flatMap((entry) => entry.timeSlots);
        const dayWindows = relations.flatMap((entry) => entry.dayWindows);
        if (regularDayRules.length) await tx.appTaskTemplateRegularDay.createMany({ data: regularDayRules });
        if (timeSlots.length) await tx.appTaskTemplateTimeSlot.createMany({ data: timeSlots });
        if (dayWindows.length) await tx.appTaskTemplateDayWindow.createMany({ data: dayWindows });
      }

      await tx.appSettings.create({
        data: { id: "default", hoursByDay: data.settings.hoursByDay as never, upcomingDays: data.settings.upcomingDays },
      });
      await tx.appSettingsDayHours.createMany({
        data: toDayHourRows(data.settings.hoursByDay).map((row) => ({ settingsId: "default", ...row })),
      });

      if (data.rosters.length) {
        await tx.appRoster.createMany({
          data: data.rosters.map((roster) => ({
            id: roster.id,
            date: parseLocalId(roster.id)!,
            title: roster.title,
            status: roster.status,
            updatedLabel: roster.updated,
            tours: roster.tours,
            people: roster.people,
            employees: roster.employees as never,
            tasks: roster.tasks as never,
            hoursStart: roster.hoursStart || null,
            hoursEnd: roster.hoursEnd || null,
          })),
        });
        const employeeRows = data.rosters.flatMap((roster) => toRosterEmployeeRows(roster.id, roster.employees));
        const taskRows = data.rosters.flatMap((roster) => toRosterTaskRows(roster.id, roster.tasks));
        if (employeeRows.length) await tx.appRosterEmployee.createMany({ data: employeeRows });
        if (taskRows.length) await tx.appRosterTask.createMany({ data: taskRows });
      }

      await recordAudit(tx, actor, "backup.restored", null, {
        ...(source.backupId ? { backupId: source.backupId } : {}),
        ...(source.fileName ? { fileName: source.fileName } : {}),
        backupCreatedAt: data.createdAt,
        safetyBackupId: safetyBackup.id,
      });
    },
    // Thousands of rows go over the network to the database, which takes longer than the default.
    { maxWait: 10_000, timeout: 120_000 }
  );

  return { safetyBackup, summary: summarizeBackup(data) };
}
