export type PairedPosition = "before" | "after";

export type TaskTemplate = {
  id: string;
  name: string;
  description: string;
  category?: string;
  color?: string;
  mustManned?: boolean;
  overwriteExistingTasks?: boolean;
  attendedByAll?: boolean;
  autogenStart?: string;
  autogenEnd?: string;
  regularDays?: string[];
  regularTimes?: string[];
  regularTimesByDay?: Record<string, string[]>;
  regularDayWindows?: Record<string, { start?: string; end?: string }>;
  /** Further time ranges on a day, after the one in regularDayWindows (e.g. 14:00-16:00 as well as 10:00-12:00). */
  extraDayWindows?: Record<string, { start?: string; end?: string }[]>;
  minPerEmployeePerDay?: number;
  maxPerEmployeePerDay?: number;
  durationMinutes?: number;
  maxConsecutiveMinutes?: number;
  waitingMinutes?: number;
  /** If nobody is free for the waiting lead-in, an all-staff task or sole cover may keep it. */
  waitingCanBeCovered?: boolean;
  /** Autofill places this straight before or after every block of that task, for the same person. */
  pairedWithTaskId?: string;
  pairedPosition?: PairedPosition;
  packingMinutes?: number;
  limitPerDay?: number;
  maxConcurrentPerTimeslot?: number;
  schoolTourImportTarget?: boolean;
  enabled?: boolean;
};

/** Templates in this category are tours: listed separately and always preceded by a waiting block. */
export const TOUR_CATEGORY = "Tours";
/** Every tour starts with this "Waiting for" lead-in. */
export const TOUR_WAITING_MINUTES = 15;

export function isTourTemplate(template: Pick<TaskTemplate, "category"> | null | undefined) {
  const category = template?.category?.trim().toLowerCase();
  return category === "tours" || category === "tour";
}

/**
 * Floor tasks (like Gallery or Front Desk) have no set times or per-person
 * minimums, so autofill uses them to fill people's spare time. Must-be-manned
 * floor tasks always keep at least one person and can take more when there's room.
 */
export function isFloorTemplate(template: TaskTemplate) {
  const hasSetTimes =
    (template.regularTimes?.length ?? 0) > 0 ||
    Object.values(template.regularTimesByDay ?? {}).some((times) => (times?.length ?? 0) > 0);
  return (
    !isTourTemplate(template) &&
    !template.pairedWithTaskId &&
    !template.attendedByAll &&
    !template.overwriteExistingTasks &&
    !((template.minPerEmployeePerDay ?? 0) > 0) &&
    !hasSetTimes
  );
}

export const TASK_TEMPLATE_REFRESH_EVENT = "task-templates-updated";
export const TASK_TEMPLATE_REFRESH_STORAGE_KEY = "rosterplanner:task-templates-updated-at";
export const TASK_TEMPLATE_DELETED_STORAGE_KEY = "rosterplanner:task-template-deleted-id";

export const defaultTaskTemplates: TaskTemplate[] = [
  {
    id: "front",
    name: "Front Desk",
    description: "Welcome visitors, manage check-ins, and handle general inquiries.",
    category: "Guest services",
    color: "#FDE68A",
    mustManned: true,
  },
  {
    id: "gallery",
    name: "Gallery Floor",
    description: "Monitor gallery spaces and provide guidance to visitors.",
    category: "Guest services",
    color: "#BBF7D0",
    mustManned: true,
  },
  {
    id: "tour",
    name: "Public Tour",
    description: "Lead scheduled tours and answer questions about exhibits.",
    category: "Programming",
    color: "#BFDBFE",
    mustManned: false,
  },
  {
    id: "school-program",
    name: "School Program",
    description: "Facilitate school group sessions and activities.",
    category: "Programming",
    color: "#BFDBFE",
    mustManned: false,
  },
  {
    id: "prep",
    name: "Prep",
    description: "Prepare materials, exhibits, or rooms ahead of scheduled programs.",
    category: "Support",
    color: "#BFDBFE",
    mustManned: false,
  },
  {
    id: "break",
    name: "Break",
    description: "Scheduled break time for staff coverage planning.",
    category: "Support",
    color: "#E9D5FF",
    mustManned: false,
    maxConcurrentPerTimeslot: 1,
  },
  {
    id: "tidy",
    name: "Finish",
    description: "End-of-day tidy and reset of spaces.",
    category: "Support",
    color: "#FED7AA",
    mustManned: false,
  },
  {
    id: "school-pre",
    name: "School Pre",
    description: "Prep tasks specifically for school visits.",
    category: "Programming",
    color: "#BFDBFE",
    mustManned: false,
  },
];

export function slugifyName(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "task";
}
