import ExcelJS from "exceljs";
import { MIN_ROW, formatShortRange } from "@/lib/rosterTimeline";
import type { GridTask } from "@/lib/rosterTypes";
import { SLOT_MINUTES, type TaskSegmentRows } from "@/lib/taskSegments";

const INVALID_FILE_NAME_CHARS = /[<>:"/\\|?*]/g;
const INVALID_SHEET_NAME_CHARS = /[:\\/?*\[\]]/g;
const MAX_SHEET_NAME_LENGTH = 31;

const FONT = { name: "Calibri", size: 11 };
const LINE_COLOR = "FF7F7F7F";
const HEADER_ROWS = 2;
/** Column A holds times, B is a narrow gap, employees start at C. */
const FIRST_EMPLOYEE_SHEET_COL = 3;

export function sanitizeExportFileName(value: string) {
  return value.replace(INVALID_FILE_NAME_CHARS, "").trim() || "roster";
}

export function sanitizeWorksheetName(value: string) {
  const sanitized = value.replace(INVALID_SHEET_NAME_CHARS, " ").replace(/\s+/g, " ").trim();
  return sanitized.slice(0, MAX_SHEET_NAME_LENGTH) || "Roster";
}

export function formatExportTitle(date: Date) {
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" })
    .format(date)
    .replace(",", "");
}

export type RosterExportColumn = { col: number; name: string; hoursLabel: string };

export type RosterExportInput = {
  title: string;
  dayStartMin: number;
  dayEndMin: number;
  columns: RosterExportColumn[];
  tasks: GridTask[];
  colorForTask: (task: GridTask) => string;
  segmentsForTask: (task: GridTask) => TaskSegmentRows;
  waitingLabelForTask: (task: GridTask) => string;
  /** Small-print lines under the roster, such as the school tour key. */
  notes?: string[];
};

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: LINE_COLOR } },
  left: { style: "thin", color: { argb: LINE_COLOR } },
  bottom: { style: "thin", color: { argb: LINE_COLOR } },
  right: { style: "thin", color: { argb: LINE_COLOR } },
};

/** "#abc" or "#aabbcc" → Excel's "FFAABBCC"; anything else gets no fill. */
function toArgb(color: string) {
  const hex = color.trim().replace(/^#/, "");
  const full = hex.length === 3 ? hex.replace(/(.)/g, "$1$1") : hex;
  return /^[0-9a-f]{6}$/i.test(full) ? `FF${full.toUpperCase()}` : null;
}

/**
 * Lays the roster out as a printable sheet: names and hours across the top,
 * half-hour times down the side, and each task as a bordered, coloured block
 * with its name at the top. Time outside someone's tasks stays blank.
 */
export function buildRosterWorksheet(workbook: ExcelJS.Workbook, input: RosterExportInput) {
  const sheet = workbook.addWorksheet(sanitizeWorksheetName(input.title), {
    pageSetup: { orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
    views: [{ state: "frozen", xSplit: 1, ySplit: HEADER_ROWS, showGridLines: false }],
  });
  const { columns, dayStartMin, dayEndMin } = input;
  const slotCount = Math.max(1, Math.ceil((dayEndMin - dayStartMin) / SLOT_MINUTES));
  const sheetRowForSlot = (slot: number) => HEADER_ROWS + 1 + slot;

  sheet.getColumn(1).width = 13;
  sheet.getColumn(2).width = 1.5;
  columns.forEach((_, index) => {
    sheet.getColumn(FIRST_EMPLOYEE_SHEET_COL + index).width = 16;
  });
  for (let row = 1; row <= sheetRowForSlot(slotCount - 1); row += 1) {
    sheet.getRow(row).height = row <= HEADER_ROWS ? 16 : 13.5;
  }

  const style = (cell: ExcelJS.Cell, options: { fill?: string | null; valign?: "top" | "middle"; size?: number } = {}) => {
    cell.font = { ...FONT, size: options.size ?? FONT.size };
    cell.alignment = { horizontal: "center", vertical: options.valign ?? "middle", wrapText: true };
    cell.border = thinBorder;
    if (options.fill) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: options.fill } };
  };

  columns.forEach((column, index) => {
    const sheetCol = FIRST_EMPLOYEE_SHEET_COL + index;
    const nameCell = sheet.getCell(1, sheetCol);
    nameCell.value = column.name;
    style(nameCell);
    const hoursCell = sheet.getCell(2, sheetCol);
    hoursCell.value = column.hoursLabel;
    style(hoursCell);
  });

  // Half-hour labels where the day allows it, otherwise a single 15-minute slot.
  for (let slot = 0; slot < slotCount; ) {
    const startMin = dayStartMin + slot * SLOT_MINUTES;
    const span = startMin % 30 === 0 && slot + 1 < slotCount ? 2 : 1;
    const top = sheetRowForSlot(slot);
    if (span > 1) sheet.mergeCells(top, 1, top + span - 1, 1);
    const cell = sheet.getCell(top, 1);
    cell.value = formatShortRange(startMin, startMin + span * SLOT_MINUTES);
    style(cell);
    slot += span;
  }

  const columnIndexByGridCol = new Map(columns.map((column, index) => [column.col, index]));
  for (const task of input.tasks) {
    const index = columnIndexByGridCol.get(task.col);
    const firstSlot = task.startRow - MIN_ROW;
    if (index === undefined || firstSlot < 0 || firstSlot >= slotCount) continue;
    const sheetCol = FIRST_EMPLOYEE_SHEET_COL + index;
    const fill = toArgb(input.colorForTask(task));
    const { waitingRows, mainRows, packingRows } = input.segmentsForTask(task);
    const segments = [
      { rows: waitingRows, label: input.waitingLabelForTask(task) },
      { rows: mainRows, label: task.label },
      { rows: packingRows, label: "Packing up" },
    ].filter((segment) => segment.rows > 0);

    let slot = firstSlot;
    for (const segment of segments) {
      const lastSlot = Math.min(slot + segment.rows, slotCount) - 1;
      if (lastSlot < slot) break;
      const top = sheetRowForSlot(slot);
      const bottom = sheetRowForSlot(lastSlot);
      if (bottom > top) sheet.mergeCells(top, sheetCol, bottom, sheetCol);
      const cell = sheet.getCell(top, sheetCol);
      cell.value = segment.label;
      style(cell, { fill, valign: "top" });
      slot += segment.rows;
    }
  }

  const notes = input.notes ?? [];
  if (notes.length) {
    const lastCol = Math.max(1, FIRST_EMPLOYEE_SHEET_COL + columns.length - 1);
    notes.forEach((note, index) => {
      const row = sheetRowForSlot(slotCount) + 1 + index;
      sheet.mergeCells(row, 1, row, lastCol);
      const cell = sheet.getCell(row, 1);
      cell.value = note;
      cell.font = { ...FONT, size: 9, color: { argb: "FF4B5563" } };
      cell.alignment = { horizontal: "left", vertical: "middle" };
    });
  }

  return sheet;
}

export async function buildRosterWorkbook(input: RosterExportInput) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Roster Generator";
  buildRosterWorksheet(workbook, input);
  return workbook.xlsx.writeBuffer();
}

/** Hands a built workbook to the browser as a download. */
export function downloadWorkbook(buffer: ArrayBuffer, title: string) {
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${sanitizeExportFileName(title)}.xlsx`;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 0);
}
