import { randomUUID } from "crypto";
import { revalidatePath, revalidateTag } from "next/cache";
import { prisma } from "./prisma";
import { ensureAppPersistenceSeeded } from "./appPersistenceSeed";
import { CACHE_TAGS } from "./cacheTags";
import { formatFullDay, parseLocalId } from "./dateUtils";
import { isSchoolTourTask, SCHOOL_TOUR_RECORD_TYPE, type SchoolTour, type SchoolTourInput } from "./schoolTourTypes";

function normalizeStudentCount(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
}

export function normalizeSchoolTourTask(task: unknown, fallbackRosterDateId?: string, index = 0): SchoolTour | null {
  if (!isSchoolTourTask(task)) return null;
  const record = task as Record<string, unknown>;
  const rosterDateId = String(record.rosterDateId ?? fallbackRosterDateId ?? "").trim();
  const startTime = String(record.startTime ?? "").trim();
  const schoolName = String(record.schoolName ?? record.label ?? "").trim();
  const studentCount = Number(record.studentCount);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(rosterDateId) || !startTime || !schoolName || !Number.isFinite(studentCount)) {
    return null;
  }
  return {
    id: String(record.id ?? `school-tour-${index + 1}`),
    rosterDateId,
    startTime,
    schoolName,
    studentCount: normalizeStudentCount(studentCount),
  };
}

export function encodeSchoolTourTask(tour: SchoolTourInput) {
  return {
    id: tour.id || randomUUID(),
    type: SCHOOL_TOUR_RECORD_TYPE,
    label: tour.schoolName,
    col: 0,
    startRow: 0,
    span: 0,
    color: null,
    waitingMinutes: 0,
    packingMinutes: 0,
    employeeId: null,
    locked: false,
    isLocked: false,
    readOnly: true,
    rosterDateId: tour.rosterDateId,
    startTime: tour.startTime,
    schoolName: tour.schoolName,
    studentCount: normalizeStudentCount(tour.studentCount),
  };
}

function readTaskJson(value: unknown) {
  return Array.isArray(value) ? [...value] : [];
}

function sortTours(tours: SchoolTour[]) {
  return tours.sort((a, b) => {
    if (a.rosterDateId !== b.rosterDateId) return a.rosterDateId.localeCompare(b.rosterDateId);
    if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
    return a.schoolName.localeCompare(b.schoolName);
  });
}

function revalidateTourSurfaces(rosterDateId: string) {
  revalidateTag(CACHE_TAGS.rosters, "max");
  revalidatePath("/tours");
  revalidatePath("/rosters");
  revalidatePath("/editor");
  revalidatePath(`/rosters/${rosterDateId}`);
  revalidatePath(`/rosters/months/${rosterDateId.slice(0, 7)}`);
}

export async function getSchoolTours(): Promise<SchoolTour[]> {
  await ensureAppPersistenceSeeded();
  const rosters = await prisma.appRoster.findMany({
    orderBy: { date: "asc" },
    select: {
      id: true,
      tasks: true,
      updatedAt: true,
    },
  });

  const tours: SchoolTour[] = [];
  rosters.forEach((roster) => {
    readTaskJson(roster.tasks).forEach((task, index) => {
      const tour = normalizeSchoolTourTask(task, roster.id, index);
      if (tour) tours.push({ ...tour, updatedAt: roster.updatedAt.toISOString() });
    });
  });

  return sortTours(tours);
}

export async function upsertSchoolTour(input: SchoolTourInput): Promise<SchoolTour> {
  await ensureAppPersistenceSeeded();

  const date = parseLocalId(input.rosterDateId);
  if (!date) throw new Error("Invalid date");

  const schoolName = input.schoolName.trim();
  const startTime = input.startTime.trim();
  if (!schoolName || !startTime) throw new Error("School name and time are required");

  const id = input.id || randomUUID();
  const encoded = encodeSchoolTourTask({
    ...input,
    id,
    schoolName,
    startTime,
    studentCount: normalizeStudentCount(input.studentCount),
  });

  const existing = await prisma.appRoster.findUnique({
    where: { id: input.rosterDateId },
    select: { tasks: true },
  });
  const tasks = readTaskJson(existing?.tasks);
  const withoutCurrent = tasks.filter((task) => !isSchoolTourTask(task) || String((task as any)?.id ?? "") !== id);
  const nextTasks = [...withoutCurrent, encoded];
  const tourCount = nextTasks.filter(isSchoolTourTask).length;

  await prisma.appRoster.upsert({
    where: { id: input.rosterDateId },
    update: {
      tasks: nextTasks as never,
      tours: tourCount,
      updatedLabel: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    },
    create: {
      id: input.rosterDateId,
      date,
      title: formatFullDay(date),
      status: "Draft",
      updatedLabel: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      tours: tourCount,
      people: 0,
      employees: [],
      tasks: nextTasks as never,
    },
  });

  revalidateTourSurfaces(input.rosterDateId);
  return {
    id,
    rosterDateId: input.rosterDateId,
    startTime,
    schoolName,
    studentCount: normalizeStudentCount(input.studentCount),
  };
}

export async function deleteSchoolTour(id: string): Promise<boolean> {
  await ensureAppPersistenceSeeded();
  const rosters = await prisma.appRoster.findMany({
    select: { id: true, tasks: true },
  });

  for (const roster of rosters) {
    const tasks = readTaskJson(roster.tasks);
    const nextTasks = tasks.filter((task) => !isSchoolTourTask(task) || String((task as any)?.id ?? "") !== id);
    if (nextTasks.length === tasks.length) continue;

    await prisma.appRoster.update({
      where: { id: roster.id },
      data: {
        tasks: nextTasks as never,
        tours: nextTasks.filter(isSchoolTourTask).length,
        updatedLabel: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
      },
    });
    revalidateTourSurfaces(roster.id);
    return true;
  }

  return false;
}
