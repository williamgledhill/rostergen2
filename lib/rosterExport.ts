import * as XLSX from "xlsx";

const INVALID_FILE_NAME_CHARS = /[<>:"/\\|?*]/g;
const INVALID_SHEET_NAME_CHARS = /[:\\/?*\[\]]/g;
const MAX_SHEET_NAME_LENGTH = 31;

export function sanitizeExportFileName(value: string) {
  return value.replace(INVALID_FILE_NAME_CHARS, "").trim() || "roster";
}

export function sanitizeWorksheetName(value: string) {
  const sanitized = value.replace(INVALID_SHEET_NAME_CHARS, " ").replace(/\s+/g, " ").trim();
  return sanitized.slice(0, MAX_SHEET_NAME_LENGTH) || "Roster";
}

export function buildWorkbookFromHtmlTable(html: string, sheetName: string) {
  const workbook = XLSX.read(html, { type: "string" });
  const originalSheetName = workbook.SheetNames[0];

  if (!originalSheetName) {
    throw new Error("The roster export did not contain a worksheet.");
  }

  const worksheet = workbook.Sheets[originalSheetName];
  const nextSheetName = sanitizeWorksheetName(sheetName);

  workbook.SheetNames = [nextSheetName];
  workbook.Sheets = { [nextSheetName]: worksheet };

  return XLSX.write(workbook, {
    type: "array",
    bookType: "xlsx",
    compression: true,
  });
}
