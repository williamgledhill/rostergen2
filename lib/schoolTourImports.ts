import * as XLSX from "xlsx";

export type ImportedSchoolTour = {
  rosterDateId: string;
  startTime: string;
  schoolName: string;
  studentCount: number;
};

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function padTime(value: number) {
  return String(value).padStart(2, "0");
}

function formatDateId(year: number, month: number, day: number) {
  return `${String(year).padStart(4, "0")}-${padTime(month)}-${padTime(day)}`;
}

function parseExcelDate(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDateId(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed && Number.isFinite(parsed.y) && Number.isFinite(parsed.m) && Number.isFinite(parsed.d)) {
      return formatDateId(parsed.y, parsed.m, parsed.d);
    }
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (isoMatch) {
      return formatDateId(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
    }

    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) {
      return formatDateId(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
    }
  }

  return null;
}

function parseExcelTime(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    const totalMinutes = Math.round(value * 24 * 60);
    const normalized = ((totalMinutes % (24 * 60)) + (24 * 60)) % (24 * 60);
    const hours = Math.floor(normalized / 60);
    const minutes = normalized % 60;
    return `${padTime(hours)}:${padTime(minutes)}`;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    const match = trimmed.match(/^(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?$/);
    if (!match) return null;
    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    const meridiem = match[3]?.toLowerCase();
    if (!Number.isFinite(hours) || !Number.isFinite(minutes) || minutes < 0 || minutes > 59) return null;
    if (meridiem) {
      if (hours < 1 || hours > 12) return null;
      if (hours === 12) hours = 0;
      if (meridiem === "pm") hours += 12;
    }
    if (hours < 0 || hours > 23) return null;
    return `${padTime(hours)}:${padTime(minutes)}`;
  }

  return null;
}

function parseStudentCount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value));
  if (typeof value === "string") {
    const numeric = Number(value.trim());
    if (Number.isFinite(numeric)) return Math.max(0, Math.round(numeric));
  }
  return null;
}

export function parseSchoolTourWorkbook(buffer: ArrayBuffer): ImportedSchoolTour[] {
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) return [];

  const sheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<(string | number | Date | null)[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });
  if (rows.length < 2) return [];

  const headerRow = rows[0];
  const headerMap = new Map<string, number>();
  headerRow.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    if (normalized) headerMap.set(normalized, index);
  });

  const dateIndex = headerMap.get("date");
  const timeIndex = headerMap.get("time");
  const schoolIndex = headerMap.get("school");
  const studentsIndex = headerMap.get("students");
  if (
    dateIndex === undefined ||
    timeIndex === undefined ||
    schoolIndex === undefined ||
    studentsIndex === undefined
  ) {
    throw new Error("The workbook must include Date, Time, School, and Students columns.");
  }

  const imported: ImportedSchoolTour[] = [];
  rows.slice(1).forEach((row) => {
    const rosterDateId = parseExcelDate(row[dateIndex]);
    const startTime = parseExcelTime(row[timeIndex]);
    const schoolName = String(row[schoolIndex] ?? "").trim();
    const studentCount = parseStudentCount(row[studentsIndex]);

    if (!rosterDateId || !startTime || !schoolName || studentCount === null) return;
    imported.push({
      rosterDateId,
      startTime,
      schoolName,
      studentCount,
    });
  });

  imported.sort((a, b) => {
    if (a.rosterDateId !== b.rosterDateId) return a.rosterDateId.localeCompare(b.rosterDateId);
    if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
    return a.schoolName.localeCompare(b.schoolName);
  });

  return imported;
}
