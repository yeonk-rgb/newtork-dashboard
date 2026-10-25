import { readFile } from "node:fs/promises";

import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { unintended } from "../../export/compare";
import { parseExportPeriod } from "../../export/period";
import { TEMPLATE_PATH } from "../../ledger/import/test-helpers";
import { computeManagementSummary } from "../../metrics/summary";
import type { FinanceMonth } from "../../metrics/types";
import { buildEntryWorkbook } from "./build-entry-workbook";
import { entryComparison } from "./compare-entry";
import { buildEntrySheetLayout } from "./layout";
import { planEntrySheets, type EntryMonthData } from "./plan";
import { SAMPLE_CATEGORIES, SAMPLE_MONTHS } from "./test-data";

const NOW = new Date("2026-10-25T03:00:00Z");
const Q3 = [7, 8, 9].map((month) => ({ year: 2026, month }));

function sheetsFor(param: string, months = Q3) {
  return planEntrySheets({
    period: parseExportPeriod(param)!,
    months,
    data: SAMPLE_MONTHS,
    categories: SAMPLE_CATEGORIES,
  });
}

async function open(param: string, months = Q3) {
  const template = await readFile(TEMPLATE_PATH);
  const sheets = sheetsFor(param, months);
  const buf = await buildEntryWorkbook({ template, sheets, now: NOW });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const tpl = new ExcelJS.Workbook();
  await tpl.xlsx.load(template as unknown as ArrayBuffer);
  return { wb, sheets, source: tpl.worksheets[0] };
}

/** 화면과 같은 계산 함수(computeManagementSummary)로 기간 지표를 구한다 */
function summaryOf(param: string) {
  const toFinance = (d: EntryMonthData): FinanceMonth => ({
    year: d.year,
    month: d.month,
    status: d.status,
    ...d.values,
    otherExpenses: [...d.others].map(([categoryId, amount]) => {
      const c = SAMPLE_CATEGORIES.find((x) => x.id === categoryId)!;
      return {
        categoryId,
        name: c.name,
        sortOrder: c.sortOrder,
        costType: null,
        amount,
      };
    }),
  });
  return computeManagementSummary({
    period: parseExportPeriod(param)!,
    financeMonths: SAMPLE_MONTHS.map(toFinance),
    annualTarget: null,
    receivables: [],
    today: new Date("2026-10-25T00:00:00Z"),
  });
}

/** 블록 제목 행부터 그 블록 F열 총액 계산값 */
function blockTotals(ws: ExcelJS.Worksheet) {
  const totals: Record<string, number> = {};
  let title = "";
  ws.eachRow((row) => {
    const c = row.getCell(3).value;
    if (
      row.getCell(3).style.font?.bold &&
      typeof c === "string" &&
      c !== "항목"
    ) {
      title = c;
    }
    const f = row.getCell(6);
    if (f.formula) totals[title.split(" (")[0]] = f.result as number;
  });
  return totals;
}

describe("배치 — 원본처럼 세로로 쌓기", () => {
  it("월 시트 행 번호: 매입 1~4 · 빈 행 5 · 경비 6~8 · 그 외 지출 10~ · 매출", () => {
    const [, july] = sheetsFor("2026-Q3");
    const layout = buildEntrySheetLayout(july);
    const text = (r: number, c: number) =>
      layout.rows[r - 1].cells.find((x) => x.col === c)?.value;
    expect([text(1, 3), text(2, 3), text(3, 3), text(4, 3)]).toEqual([
      "매입",
      "항목",
      "월간 상품 매입액",
      "월간 원재료 매입액",
    ]);
    expect(layout.rows[4].kind).toBe("separator");
    expect([text(6, 3), text(8, 3)]).toEqual(["경비", "월간 경비 지출액"]);
    expect(text(10, 3)).toBe("그 외 지출액(광고선전비, 접대비 등)");
    expect(text(3, 8)).toBe("← 당월 매입 (월간 입력)");
    expect(text(8, 8)).toBe("← 당월 경비 지출 (월간 입력)");
    expect(text(1, 8)).toBe("상태: 확정 (2026-08-03)");
    // 협회비(비활성, 7월 금액 있음) 적요
    const old = layout.rows.find((r) =>
      r.cells.some((c) => c.value === "협회비"),
    )!;
    expect(old.cells.find((c) => c.col === 5)?.value).toBe("비활성 항목");
    expect(layout.merges).toContain("C1:F1");
    expect(layout.merges).toContain("F3:F4");
  });

  it("합계 시트: '월간'을 빼고, 제목에 기간, 메모는 기간에 맞게", () => {
    const [total] = sheetsFor("2026-Q3");
    const layout = buildEntrySheetLayout(total);
    const values = layout.rows.flatMap((r) => r.cells.map((c) => c.value));
    expect(values).toContain("매입 (2026년 3분기 합계)");
    expect(values).toContain(
      "그 외 지출액(광고선전비, 접대비 등) (2026년 3분기 합계)",
    );
    expect(values).toContain("상품 매입액");
    expect(values).toContain("제품 매출액");
    expect(
      values.some((v) => typeof v === "string" && v.startsWith("월간")),
    ).toBe(false);
    expect(values).toContain("← 3분기 매입 (월간 입력)");
    expect(values).toContain("← 3분기 매출 (월간 입력)");
  });
});

describe("원본 양식과 셀 단위 비교 — 의도하지 않은 차이 0건", () => {
  it("월 시트 (확정 7월)", async () => {
    const { wb, sheets, source } = await open("2026-Q3");
    const rows = entryComparison(source, wb, sheets[1]);
    expect(rows.length).toBeGreaterThan(40);
    expect(unintended(rows)).toEqual([]);
  });

  it("합계 시트·임시저장 달 시트 (빨간 안내 포함)", async () => {
    const { wb, sheets, source } = await open("2026-Q3");
    for (const sheet of [sheets[0], sheets[3]]) {
      expect(
        unintended(entryComparison(source, wb, sheet)),
        sheet.sheetName,
      ).toEqual([]);
    }
  });
});

describe("비교가 실제 차이를 잡는지", () => {
  it("새 파일 칸 서식을 바꾸면 의도하지 않은 차이로 나온다", async () => {
    const { wb, sheets, source } = await open("2026-Q3");
    const ws = wb.getWorksheet("2026-07")!;
    ws.getCell("C3").font = { ...ws.getCell("C3").font, size: 11 };
    ws.getColumn(5).width = 20;
    const diffs = unintended(entryComparison(source, wb, sheets[1]));
    expect(diffs.map((d) => d.item)).toEqual([
      expect.stringContaining("name — 글꼴"),
      expect.stringContaining("E열 너비"),
    ]);
  });
});

describe("빨간 안내 — 원본 빨간 글씨 색", () => {
  it("임시저장 달 H1, 합계 시트 H2 (제외한 달)", async () => {
    const { wb, source } = await open("2026-Q3");
    const red = source.getCell("C3").font.color;
    const draft = wb.getWorksheet("2026-09")!;
    expect(draft.getCell("H1").value).toBe(
      "상태: 임시저장 (확정 전 — 대시보드 합계 제외)",
    );
    expect(draft.getCell("H1").font.color).toEqual(red);
    const total = wb.getWorksheet("2026-Q3")!;
    expect(total.getCell("H1").font.color).not.toEqual(red);
    expect(total.getCell("H2").value).toBe("제외: 9월 임시저장");
    expect(total.getCell("H2").font.color).toEqual(red);
    // 확정 달은 빨간 글씨 없음
    expect(wb.getWorksheet("2026-07")!.getCell("H1").font.color).not.toEqual(
      red,
    );
  });
});

describe("엑셀 합계 = 화면 숫자 (같은 계산 함수)", () => {
  it("분기 합계 시트: 매출·매입·경비·그 외 지출 = computeManagementSummary(2026-Q3)", async () => {
    const { wb } = await open("2026-Q3");
    const totals = blockTotals(wb.getWorksheet("2026-Q3")!);
    const s = summaryOf("2026-Q3");
    const item = (key: string) =>
      Number(s.expenses.items.find((i) => i.key === key)!.amount);
    expect(totals["매출"]).toBe(Number(s.revenue.total));
    expect(totals["매입"]).toBe(
      item("goodsPurchase") + item("materialPurchase"),
    );
    expect(totals["경비"]).toBe(item("operatingExpense"));
    expect(totals["그 외 지출액(광고선전비, 접대비 등)"]).toBe(
      item("otherExpense"),
    );
    expect(
      totals["매입"] +
        totals["경비"] +
        totals["그 외 지출액(광고선전비, 접대비 등)"],
    ).toBe(Number(s.expenses.total));
  });

  it("월 시트(확정 8월) = computeManagementSummary(2026-08)", async () => {
    const { wb } = await open("2026-08", [{ year: 2026, month: 8 }]);
    const totals = blockTotals(wb.getWorksheet("2026-08")!);
    const s = summaryOf("2026-08");
    expect(totals["매출"]).toBe(Number(s.revenue.total));
    expect(totals["경비"]).toBe(33_648_000);
    expect(
      totals["매입"] +
        totals["경비"] +
        totals["그 외 지출액(광고선전비, 접대비 등)"],
    ).toBe(Number(s.expenses.total));
  });

  it("F열 계산값 = 같은 그룹 D열 합 (수식 범위 확인)", async () => {
    const { wb } = await open("2026-Q3");
    for (const ws of wb.worksheets) {
      ws.eachRow((row, r) => {
        const f = row.getCell(6);
        if (!f.formula) return;
        const [, from, to] = /SUM\(D(\d+):D(\d+)\)/
          .exec(f.formula)!
          .map(Number);
        expect(from, `${ws.name}!F${r}`).toBe(r);
        let sum = 0;
        for (let i = from; i <= to; i++)
          sum += Number(ws.getCell(i, 4).value ?? 0);
        expect(f.result, `${ws.name}!F${r}`).toBe(sum);
      });
    }
  });
});

describe("시트·인쇄", () => {
  it("시트 이름 = 기간, A4 가로 너비 1페이지, A열 숨김, 첫 행 고정·자동 필터 없음", async () => {
    const { wb } = await open("2026-Q3");
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      "2026-Q3",
      "2026-07",
      "2026-08",
      "2026-09",
    ]);
    for (const ws of wb.worksheets) {
      expect(ws.pageSetup).toMatchObject({
        paperSize: 9,
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      });
      expect(ws.getColumn(1).hidden).toBe(true);
      expect(ws.views[0].state).toBe("normal");
      expect(ws.autoFilter).toBeUndefined();
    }
  });
});
