// 업로드 양식(.xlsx) 만들기: 시트 "연간목표"(연도, 목표매출액), "월별실적"(연도, 월, 금액 9칸)
// 머리글만 넣고 금액 칸은 천 단위 쉼표 서식 — 내려받아 그대로 채워 올린다
import ExcelJS from "exceljs";

import { COLUMNS, KIND_COLUMNS } from "./columns";

export const TEMPLATE_FILE_NAME = "뉴토크_업로드양식.xlsx";

export async function buildTemplate(): Promise<ArrayBuffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "뉴토크 경영 대시보드";

  const sheets = [
    { name: "연간목표", keys: KIND_COLUMNS.annualTarget },
    { name: "월별실적", keys: KIND_COLUMNS.monthly },
  ] as const;

  for (const { name, keys } of sheets) {
    const ws = workbook.addWorksheet(name, {
      views: [{ state: "frozen", ySplit: 1 }],
    });
    ws.columns = keys.map((key) => ({
      header: COLUMNS[key].label,
      key,
      width: key === "year" || key === "month" ? 8 : 16,
      style:
        key === "year" || key === "month"
          ? { numFmt: "0" }
          : { numFmt: "#,##0" },
    }));
    const header = ws.getRow(1);
    header.font = { bold: true };
    header.alignment = { horizontal: "center" };
    header.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE8F0FE" },
    };
  }

  return (await workbook.xlsx.writeBuffer()) as ArrayBuffer;
}
