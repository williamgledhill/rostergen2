export const SCHOOL_TOUR_RECORD_TYPE = "__school-tour-import";

export type SchoolTour = {
  id: string;
  rosterDateId: string;
  startTime: string;
  schoolName: string;
  studentCount: number;
  updatedAt?: string;
};

export type SchoolTourInput = {
  id?: string;
  rosterDateId: string;
  startTime: string;
  schoolName: string;
  studentCount: number;
};

export function isSchoolTourTask(task: unknown) {
  return String((task as { type?: unknown })?.type ?? "") === SCHOOL_TOUR_RECORD_TYPE;
}
