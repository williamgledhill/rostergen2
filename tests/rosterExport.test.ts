import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildWorkbookFromHtmlTable, sanitizeWorksheetName } from "../lib/rosterExport";

describe("buildWorkbookFromHtmlTable", () => {
  it("creates a real xlsx workbook from the exported roster HTML", () => {
    const html = `<!DOCTYPE html>
<html>
<body>
  <table>
    <tr>
      <th colspan="3">Friday 24 April</th>
    </tr>
    <tr>
      <td rowspan="2">08:30-09:00</td>
      <td>Alex</td>
      <td>Jordan</td>
    </tr>
    <tr>
      <td>Waiting for</td>
      <td>Packing up</td>
    </tr>
  </table>
</body>
</html>`;

    const buffer = buildWorkbookFromHtmlTable(html, "Friday 24 April");
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];

    expect(workbook.SheetNames).toEqual(["Friday 24 April"]);
    expect(sheet["A1"]?.v).toBe("Friday 24 April");
    expect(sheet["A2"]?.v).toBe("08:30-09:00");
    expect(sheet["B2"]?.v).toBe("Alex");
    expect(sheet["C3"]?.v).toBe("Packing up");
    expect(sheet["!merges"]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }),
        expect.objectContaining({ s: { r: 1, c: 0 }, e: { r: 2, c: 0 } }),
      ])
    );
  });

  it("sanitizes worksheet names to valid Excel sheet names", () => {
    const sheetName = sanitizeWorksheetName("Roster: Friday / This sheet name is definitely too long*[]");

    expect(sheetName).not.toMatch(/[:\\/?*\[\]]/);
    expect(sheetName.length).toBeLessThanOrEqual(31);
  });
});
