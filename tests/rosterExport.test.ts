import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { buildRosterWorkbook, sanitizeWorksheetName, type RosterExportInput } from "../lib/rosterExport";
import { getTaskSegmentRows } from "../lib/taskSegments";

const input: RosterExportInput = {
  title: "Wednesday 30 September",
  dayStartMin: 9 * 60,
  dayEndMin: 11 * 60,
  columns: [
    { col: 2, name: "Claire & <Jo>", hoursLabel: "9:00-11:00" },
    { col: 3, name: "William", hoursLabel: "10:00-11:00" },
  ],
  tasks: [
    { id: "t1", type: "desk", label: "Front Desk", col: 2, startRow: 2, span: 2 },
    { id: "t2", type: "tour", label: "Public Tour", col: 3, startRow: 6, span: 4, waitingMinutes: 15 },
  ],
  colorForTask: (task) => (task.type === "desk" ? "#FFFF00" : "#9DC3E6"),
  segmentsForTask: (task) => getTaskSegmentRows(task),
  waitingLabelForTask: (task) => (task.type === "tour" ? "Waiting for tour" : "Waiting for"),
  notes: ["School Tour 1: 9:30 Perth College (25 students)"],
};

async function readBack() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load((await buildRosterWorkbook(input)) as ArrayBuffer);
  return workbook.worksheets[0];
}

describe("buildRosterWorkbook", () => {
  it("puts names and hours across the top and half-hour times down the side", async () => {
    const sheet = await readBack();
    expect(sheet.name).toBe("Wednesday 30 September");
    expect(sheet.getCell("C1").value).toBe("Claire & <Jo>");
    expect(sheet.getCell("C2").value).toBe("9:00-11:00");
    expect(sheet.getCell("A3").value).toBe("9:00-9:30");
    expect(sheet.getCell("A5").value).toBe("9:30-10:00");
    expect(sheet.getCell("A4").isMerged).toBe(true);
  });

  it("draws each task as a coloured, bordered block with its name at the top", async () => {
    const sheet = await readBack();
    const desk = sheet.getCell("C3");
    expect(desk.value).toBe("Front Desk");
    expect(sheet.getCell("C4").isMerged).toBe(true);
    expect(desk.fill).toMatchObject({ pattern: "solid", fgColor: { argb: "FFFFFF00" } });
    expect(desk.border?.top?.style).toBe("thin");
    expect(desk.alignment?.vertical).toBe("top");

    expect(sheet.getCell("D7").value).toBe("Waiting for tour");
    expect(sheet.getCell("D8").value).toBe("Public Tour");
    expect(sheet.getCell("D8").fill).toMatchObject({ fgColor: { argb: "FF9DC3E6" } });
  });

  it("leaves time outside tasks blank and adds the school tour key underneath", async () => {
    const sheet = await readBack();
    expect(sheet.getCell("D3").value).toBeNull();
    expect(sheet.getCell("D3").border).toBeUndefined();
    const key = sheet.getRow(12).getCell(1).value;
    expect(key).toBe("School Tour 1: 9:30 Perth College (25 students)");
  });

  it("sanitizes worksheet names to valid Excel sheet names", () => {
    const sheetName = sanitizeWorksheetName("Roster: Friday / This sheet name is definitely too long*[]");
    expect(sheetName).not.toMatch(/[:\\/?*\[\]]/);
    expect(sheetName.length).toBeLessThanOrEqual(31);
  });
});
