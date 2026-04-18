import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { parseSchoolTourWorkbook } from "../lib/schoolTourImports";

function buildWorkbookBuffer(rows: (string | number)[][]) {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, sheet, "Worksheet");
  return XLSX.write(workbook, { type: "array", bookType: "xlsx" });
}

describe("parseSchoolTourWorkbook", () => {
  it("parses school tour rows from the workbook", () => {
    const buffer = buildWorkbookBuffer([
      ["Date", "Time", "Program", "School", "Students"],
      [46136, 0.35416666666667, "RAM - Guided School Program", "Oakhill Drive Public School", 40],
      [46136, 0.39583333333333, "RAM - Guided School Program", "Kingswood College", 53],
    ]);

    expect(parseSchoolTourWorkbook(buffer)).toEqual([
      {
        rosterDateId: "2026-04-24",
        startTime: "08:30",
        schoolName: "Oakhill Drive Public School",
        studentCount: 40,
      },
      {
        rosterDateId: "2026-04-24",
        startTime: "09:30",
        schoolName: "Kingswood College",
        studentCount: 53,
      },
    ]);
  });

  it("parses browser-style Date time cells", () => {
    const buffer = buildWorkbookBuffer([
      ["Date", "Time", "Program", "School", "Students"],
      [new Date(2026, 3, 24), new Date(1899, 11, 30, 8, 30), "RAM - Guided School Program", "Oakhill Drive Public School", 40],
    ]);

    expect(parseSchoolTourWorkbook(buffer)).toEqual([
      {
        rosterDateId: "2026-04-24",
        startTime: "08:30",
        schoolName: "Oakhill Drive Public School",
        studentCount: 40,
      },
    ]);
  });

  it("throws when required columns are missing", () => {
    const buffer = buildWorkbookBuffer([
      ["Date", "Program", "School"],
      [46136, "RAM - Guided School Program", "Oakhill Drive Public School"],
    ]);

    expect(() => parseSchoolTourWorkbook(buffer)).toThrow(/Date, Time, School, and Students/);
  });
});
