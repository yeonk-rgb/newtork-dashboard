// 엑셀 PR ③ 월별 종합 리포트 — 블록 순서·대시보드와 같은 숫자·원본 비교·쪽 나눔·채권·채무 왕복
import { readFile } from "node:fs/promises";

import ExcelJS from "exceljs";
import JSZip from "jszip";
import { describe, expect, it } from "vitest";

import { readStyledXlsx } from "@/shared/upload/read-styled-sheet";
import type { Period } from "@/shared/period/period";

import {
  dashboardKpis,
  expenseMixDonut,
  revenueMixDonut,
  targetCardModel,
} from "../components/dashboard/model";
import { unintended } from "../export/compare";
import { stackedComparison } from "../export/compare-stacked";
import { planPages } from "../export/page-plan";
import { buildStackedWorkbook } from "../export/stacked";
import {
  FIXTURE_TODAY,
  fixtureInput,
  fixtureMonths,
} from "../export/testing/summary-fixture";
import {
  parseLedgerSheet,
  selectLedgerSheet,
} from "../ledger/import/parse-ledger-sheet";
import { TEMPLATE_PATH } from "../ledger/import/test-helpers";
import { SAMPLE_ROWS } from "../ledger/export/test-rows";
import { DEFAULT_METRICS_SETTINGS } from "../metrics/settings";
import { computeManagementSummary } from "../metrics/summary";
import { computeTrend } from "../metrics/trend";
import { receivablesListSheet } from "../receivables/export/receivables-layout";
import { buildReportLayout } from "./report-layout";

const NOW = new Date("2026-10-25T03:00:00Z");
const Q3: Period = { unit: "quarter", year: 2026, quarter: 3 };
const AUG: Period = { unit: "month", year: 2026, month: 8 };

function reportFor(period: Period) {
  const summary = computeManagementSummary(fixtureInput(period));
  const yearInput = fixtureInput({ unit: "year", year: 2026 });
  const report = buildReportLayout({
    summary,
    yearSummary: computeManagementSummary(yearInput),
    yearMonths: yearInput.financeMonths,
    trend: computeTrend(
      period,
      fixtureMonths(),
      FIXTURE_TODAY,
      DEFAULT_METRICS_SETTINGS.costMode,
    ),
    today: FIXTURE_TODAY,
    writtenOn: "2026-10-26",
    author: "윤경영",
  });
  return { summary, report };
}

type Cell = {
  row: number;
  col: number;
  value?: unknown;
  formula?: { expr: string; result: number };
  warn?: boolean;
  role: string;
};
const cellsOf = (layout: { rows: { row: number; cells: object[] }[] }) =>
  layout.rows.flatMap((r) =>
    r.cells.map((c) => ({ ...(c as Omit<Cell, "row">), row: r.row })),
  );
const rowOf = (cells: Cell[], text: string, col = 3) =>
  cells.find((c) => c.col === col && c.value === text)?.row ?? -1;
const at = (cells: Cell[], row: number, col: number) =>
  cells.find((c) => c.row === row && c.col === col);
const num = (c: Cell | undefined) =>
  c?.formula ? c.formula.result : (c?.value as number);

async function workbook(period: Period, ledgerName = "채권·채무 2026-10") {
  const { summary, report } = reportFor(period);
  const buf = await buildStackedWorkbook({
    template: await readFile(TEMPLATE_PATH),
    sheets: [
      {
        name: "2026-Q3",
        layout: report.layout,
        maxAux: report.maxAux,
        print: { blocks: report.blocks },
      },
    ],
    ledger: {
      sheets: [{ sheetName: ledgerName, month: "2026-10", rows: SAMPLE_ROWS }],
      detailName: "채권·채무 상세",
    },
    lists: [receivablesListSheet(summary.receivables)],
    now: NOW,
  });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const tpl = new ExcelJS.Workbook();
  await tpl.xlsx.load(
    (await readFile(TEMPLATE_PATH)) as unknown as ArrayBuffer,
  );
  return { buf, wb, source: tpl.worksheets[0], report, summary };
}

describe("리포트 블록 순서 = 새 대시보드 순서", () => {
  it("머리말 → 요약 → 분기별 목표 달성 현황 → 매출 → 지출 → 매출·지출 추이 → 이익 구조 → BEP → 미수금 통계", () => {
    const { report } = reportFor(Q3);
    expect(report.blocks.map((b) => b.name)).toEqual([
      "머리말",
      "요약",
      "분기별 목표 달성 현황",
      "매출",
      "지출",
      "매출·지출 추이",
      "이익 구조",
      "손익분기점(BEP)",
      "미수금 통계",
    ]);
    const titles = cellsOf(report.layout)
      .filter((c) => c.role === "title")
      .map((c) => c.value);
    expect(titles).toEqual([
      "요약 (2026년 3분기)",
      "연간 목표매출액",
      "목표매출 달성률",
      "매출 (2026년 3분기 합계)",
      "지출 (2026년 3분기 합계)",
      "매출·지출 추이 (2025.10 ~ 2026.9)",
      "이익 구조 (참고)",
      "손익분기점(BEP) — 적용 기준 (참고)",
      "미수금 통계 (9/30 기준)",
    ]);
    // 넣지 않는 것: 산업 분야별·제품별 매출(샘플), AI 분석
    const all = JSON.stringify(report.layout);
    expect(all).not.toMatch(/산업 분야|제품별|시리즈|AI/);
  });

  it("머리말: 경 영 리 포 트 + 회사명·기간·작성일·작성자 / 집계 기준·비용 기준·확정 현황·생성 (직인·대표자·주소·연락처 없음)", () => {
    const cells = cellsOf(reportFor(Q3).report.layout);
    expect(at(cells, 1, 3)).toMatchObject({
      role: "reportTitle",
      value: "경 영 리 포 트",
    });
    expect(reportFor(Q3).report.layout.rows[0].height).toBe(30);
    const pairs = [3, 4, 5, 6].map((r) => [
      at(cells, r, 3)?.value,
      at(cells, r, 4)?.value,
      at(cells, r, 6)?.value,
      at(cells, r, 7)?.value,
    ]);
    expect(pairs).toEqual([
      [
        "회사명",
        "뉴토크코리아㈜",
        "집계 기준",
        "확정된 달만 (대시보드와 같음)",
      ],
      [
        "기간",
        "2026년 3분기 (7/1 ~ 9/30)",
        "비용 기준",
        "매입 포함 (매입액 = 원가)",
      ],
      ["작성일", "2026-10-26", "확정 현황", "7·8월 확정 · 9월 임시저장"],
      ["작성자", "윤경영", "생성", "NEWTORK 경영 대시보드"],
    ]);
    expect(at(cells, 5, 7)?.warn).toBe(true);
    expect(JSON.stringify(cells)).not.toMatch(/대표|직인|주소|전화|연락처/);
    expect(reportFor(Q3).report.layout.merges).toEqual(
      expect.arrayContaining(["C1:I1", "D3:E3", "G3:I3"]),
    );
  });
});

describe("리포트 숫자 = 대시보드 화면 숫자", () => {
  for (const [name, period] of [
    ["2026-Q3", Q3],
    ["2026-08", AUG],
  ] as const) {
    it(`${name}: 요약 KPI 4개·이름, 매출·지출 구성, BEP`, () => {
      const { summary, report } = reportFor(period);
      const cells = cellsOf(report.layout);
      const kpis = dashboardKpis(summary);
      for (const k of kpis) {
        const r = rowOf(cells, k.title);
        expect(r, k.title).toBeGreaterThan(0);
        expect(num(at(cells, r, 4)), k.title).toBe(Number(k.value));
      }
      // 추정 이익 = 매출 − 지출 수식
      const profitRow = rowOf(cells, "추정 이익");
      expect(at(cells, profitRow, 4)?.formula?.expr).toBe(
        `D${rowOf(cells, "매출")}-D${rowOf(cells, "지출")}`,
      );
      expect(at(cells, profitRow, 5)?.value).toBe("적용 기준: 매입액 = 원가");
      // 매출 구성 (제품·상품·용역) = 대시보드 매출 구성 도넛
      const kind = period.unit === "month" ? "월간 " : "";
      const rev = revenueMixDonut(summary).slices.map((s) => Number(s.value));
      expect(
        ["제품 매출액", "상품 매출액", "용역 매출액"].map((n) =>
          num(at(cells, rowOf(cells, kind + n), 4)),
        ),
      ).toEqual(rev);
      // 지출 구성 4조각 = 대시보드 지출 구성 도넛
      const exp = expenseMixDonut(summary);
      expect(
        [
          `${kind}상품 매입액`,
          `${kind}원재료 매입액`,
          `${kind}경비 지출액`,
          "기타 (그 외 지출액)",
        ].map((n) => num(at(cells, rowOf(cells, n), 4))),
      ).toEqual(exp.donut.slices.map((s) => Number(s.value)));
      // BEP 달성률 (I열) = 대시보드 BEP
      const bepRow = rowOf(cells, "BEP 달성률", 8);
      expect(at(cells, bepRow, 9)?.value).toBe(summary.breakEven.rate);
    });
  }

  it("분기별 목표 달성 현황 = 목표 엑셀 블록 (대시보드 목표 카드와 같은 달성률·빨간색)", () => {
    const { report } = reportFor(Q3);
    const cells = cellsOf(report.layout);
    const memos = cells.filter(
      (c) =>
        c.col === 8 && /^← \d분기 (달성률|진행 중|\()/.test(String(c.value)),
    );
    const card = targetCardModel(
      computeManagementSummary(fixtureInput({ unit: "year", year: 2026 })),
      FIXTURE_TODAY,
    );
    expect(memos[2].value).toBe(
      `← 3분기 달성률 ${((card.quarters[2].rate ?? 0) * 100).toFixed(1)}% (9월 미확정)`,
    );
    expect(memos[3].value).toBe(
      "← 4분기 진행 중 (경과 1/3개월, 확정된 달 없음)",
    );
    expect(memos.map((m) => m.warn === true)).toEqual(
      card.quarters.map((q) => q.warn),
    );
  });

  it("매출·지출 추이: 12개월 월별 표 (확정 달만 숫자, 임시저장은 빨간 안내)", () => {
    const { report } = reportFor(Q3);
    const cells = cellsOf(report.layout);
    const start = rowOf(cells, "2025.10");
    expect(cells.filter((c) => c.role === "trendAmount").length).toBe(36);
    expect(num(at(cells, start, 4))).toBeGreaterThan(0);
    const sep = rowOf(cells, "2026.9");
    expect(at(cells, sep, 4)?.value ?? null).toBeNull();
    expect(at(cells, sep, 8)).toMatchObject({
      value: "← 임시저장 — 합계 제외",
      warn: true,
    });
  });

  it("지출: 기타 항목별 합 = 기타", () => {
    const cells = cellsOf(reportFor(Q3).report.layout);
    const other = num(at(cells, rowOf(cells, "기타 (그 외 지출액)"), 4));
    const groupTotal = cells.find(
      (c) => c.col === 8 && c.value === "← 기타 항목별 (광고선전비·접대비 등)",
    );
    expect(groupTotal).toBeDefined();
    expect(other).toBe(0); // 가짜 데이터에는 그 외 지출이 없다 (빈 그룹 1행 + 0)
  });
});

describe("쪽 나눔 (블록 단위)", () => {
  it("배율 = 너비 1페이지에 들어가는 정수 %, 블록 중간에서 끊지 않는다", () => {
    const plan = planPages({
      columnWidths: [0, 6.125, 26.5, 15.125, 30.625, 16, 3.125, 15.5, 24],
      rowHeights: Array(120).fill(15),
      blocks: [
        { first: 1, last: 20 },
        { first: 22, last: 40 },
        { first: 42, last: 60 },
        { first: 62, last: 90 },
      ],
      orientation: "landscape",
      margins: { left: 0.7, right: 0.7, top: 0.75, bottom: 0.75 },
    });
    expect(plan.scale).toBeGreaterThanOrEqual(85);
    expect(plan.scale).toBeLessThanOrEqual(95);
    const blocks = [20, 40, 60, 90];
    // 나눔 행은 늘 블록 바로 앞 (빈 행)
    for (const br of plan.breaks) expect([21, 41, 61]).toContain(br);
    expect(plan.breaks.length).toBeGreaterThan(0);
    void blocks;
  });

  it("리포트 시트: 고정 배율·인쇄 범위 A:I·쪽 나눔이 블록 경계에", async () => {
    const { wb, report } = await workbook(Q3);
    const ws = wb.getWorksheet("2026-Q3")!;
    expect(ws.pageSetup).toMatchObject({
      orientation: "landscape",
      paperSize: 9,
      fitToPage: false,
    });
    expect(ws.pageSetup.scale).toBeGreaterThan(50);
    expect(ws.pageSetup.printArea).toBe(`A1:I${report.layout.rows.length}`);
    // exceljs 는 다시 읽을 때 쪽 나눔을 읽지 않아 시트 XML 에서 직접 확인
    const { buf } = await workbook(Q3);
    const xml = await (
      await JSZip.loadAsync(buf)
    )
      .file("xl/worksheets/sheet1.xml")!
      .async("string");
    const breaks = [...xml.matchAll(/<brk id="(\d+)"[^>]*man="1"/g)].map((m) =>
      Number(m[1]),
    );
    const starts = report.blocks.map((b) => b.first - 1);
    expect(breaks.length).toBeGreaterThan(0);
    for (const br of breaks) expect(starts).toContain(br);
  });
});

describe("원본 양식과 셀 단위 비교 — 의도하지 않은 차이 0건", () => {
  it("리포트 시트", async () => {
    const { wb, source, report } = await workbook(Q3);
    const rows = stackedComparison(source, wb, "2026-Q3", report.layout, {
      paged: true,
    });
    expect(rows.length).toBeGreaterThan(60);
    expect(unintended(rows)).toEqual([]);
  });

  it("시트 구성: 리포트 → 채권·채무 2026-10 → 채권·채무 상세 → 미수금 상세", async () => {
    const { wb } = await workbook(Q3);
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      "2026-Q3",
      "채권·채무 2026-10",
      "채권·채무 상세",
      "미수금 상세",
    ]);
  });
});

describe("리포트 안 채권·채무 시트 → 2단계 업로드 왕복", () => {
  it("기준년월 2026-10 이면 '채권·채무 2026-10' 을 자동 선택, 같은 행·총액 전부 일치", async () => {
    const { buf } = await workbook(Q3);
    const read = await readStyledXlsx(
      "경영지원_리포트_2026-10.xlsx",
      new Uint8Array(buf).buffer,
    );
    if (!read.ok) throw new Error(read.error);
    const selection = selectLedgerSheet(read.sheets, {
      month: "2026-10",
      requested: null,
    });
    expect(selection).toMatchObject({ ok: true, note: null });
    if (!selection.ok) return;
    expect(selection.sheet.name).toBe("채권·채무 2026-10");
    const parsed = parseLedgerSheet(selection.sheet, {
      year: 2026,
      month: 10,
      today: "2026-10-25",
    });
    expect(parsed.fatal).toEqual([]);
    expect(parsed.blocks.flatMap((b) => b.rows)).toHaveLength(
      SAMPLE_ROWS.length,
    );
    const totals = parsed.blocks.flatMap((b) => b.totals);
    expect(totals.every((t) => t.state === "match")).toBe(true);
  });

  it("분기 리포트처럼 채권·채무 시트가 여러 장이면 이름 끝 기준년월로 고른다", () => {
    const sheet = (name: string) => ({
      name,
      rowCount: 1,
      columnCount: 3,
      cells: new Map([["1:3", { value: "외상매출금" }]]),
      merges: [],
      hiddenColumns: [],
    });
    const r = selectLedgerSheet(
      [sheet("채권·채무 2026-09"), sheet("채권·채무 2026-10")],
      { month: "2026-10", requested: null },
    );
    expect(r).toMatchObject({ ok: true, note: null });
    expect(r.ok && r.sheet.name).toBe("채권·채무 2026-10");
  });
});
