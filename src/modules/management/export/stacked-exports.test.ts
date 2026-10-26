// 엑셀 PR ②: 목표 대비 실적·미수금 통계 (+ 미수금 상세) — 배치·원본 비교·대시보드와 같은 숫자
import { readFile } from "node:fs/promises";

import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";

import { targetCardModel } from "../components/dashboard/model";
import { TEMPLATE_PATH } from "../ledger/import/test-helpers";
import { computeManagementSummary } from "../metrics/summary";
import {
  buildReceivablesLayout,
  receivablesListSheet,
} from "../receivables/export/receivables-layout";
import { buildTargetsLayout } from "../settings/export/targets-layout";
import { comparePackage, unintended } from "./compare";
import { stackedComparison } from "./compare-stacked";
import { buildStackedWorkbook } from "./stacked";
import { readPackageParts } from "./testing/dump-workbook";
import {
  FIXTURE_TODAY,
  fixtureInput,
  fixtureItemResult,
} from "./testing/summary-fixture";

const NOW = new Date("2026-10-25T03:00:00Z");
const YEAR = { unit: "year", year: 2026 } as const;

const yearSummary = () => computeManagementSummary(fixtureInput(YEAR));
const targetsSheet = () =>
  buildTargetsLayout({
    summary: yearSummary(),
    months: fixtureInput(YEAR).financeMonths,
    today: FIXTURE_TODAY,
  });

type Cell = {
  row: number;
  col: number;
  value?: unknown;
  warn?: boolean;
  role: string;
};
const cellsOf = (layout: {
  rows: { row: number; cells: Omit<Cell, "row">[] }[];
}) =>
  layout.rows.flatMap((r) =>
    r.cells.map((c) => ({ ...c, row: r.row })),
  ) as Cell[];
const at = (cells: Cell[], row: number, col: number) =>
  cells.find((c) => c.row === row && c.col === col);
const rowOf = (cells: Cell[], text: string) =>
  cells.find((c) => c.value === text)?.row ?? -1;

async function workbook() {
  const template = await readFile(TEMPLATE_PATH);
  const t = targetsSheet();
  const r = buildReceivablesLayout(fixtureItemResult());
  const buf = await buildStackedWorkbook({
    template,
    sheets: [
      { name: "2026", layout: t.layout, maxAux: t.maxAux },
      { name: "2026-Q3", layout: r.layout, maxAux: r.maxAux },
    ],
    lists: [receivablesListSheet(fixtureItemResult())],
    now: NOW,
  });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  const tpl = new ExcelJS.Workbook();
  await tpl.xlsx.load(template as unknown as ArrayBuffer);
  return { buf, wb, source: tpl.worksheets[0], template, t, r };
}

describe("목표 대비 실적 시트 배치", () => {
  it("연간 목표매출액 블록 → 목표매출 달성률 블록 (월 행 + 분기 그룹, 이름은 대시보드 표기)", () => {
    const cells = cellsOf(targetsSheet().layout);
    expect(at(cells, 1, 3)?.value).toBe("연간 목표매출액");
    expect(at(cells, 3, 3)?.value).toBe("1분기 목표");
    expect(at(cells, 3, 5)?.value).toBe("자동 배분");
    expect(
      cells.some((c) => c.value === "목표매출 달성률" && c.role === "title"),
    ).toBe(true);
    const jul = rowOf(cells, "7월");
    expect(at(cells, jul, 5)?.value).toBe("월 목표 234,166,666 (분기 ÷ 3)");
    expect(at(cells, rowOf(cells, "8월"), 5)?.value).toBe(
      "월 목표 234,166,666 (분기 ÷ 3)",
    );
    // 12월은 나머지 원이 붙은 마지막 달
    expect(at(cells, rowOf(cells, "12월"), 5)?.value).toBe(
      "월 목표 234,166,668 (분기 ÷ 3)",
    );
  });

  it("임시저장 달: D 빈칸 + E 빨간 '임시저장 — 합계 제외' / 4분기 달은 월 목표만", () => {
    const cells = cellsOf(targetsSheet().layout);
    const sep = rowOf(cells, "9월");
    expect(at(cells, sep, 4)?.value ?? null).toBeNull();
    expect(at(cells, sep, 5)).toMatchObject({
      value: "임시저장 — 합계 제외",
      warn: true,
    });
    // 10월(진행 중, 입력 없음)은 마감 전이라 안내 없이 월 목표만
    expect(at(cells, rowOf(cells, "10월"), 5)?.value).toBe(
      "월 목표 234,166,666 (분기 ÷ 3)",
    );
  });

  it("분기 메모·빨간색 = 대시보드 규칙 (끝났고 3개월 모두 확정 + 미달만)", () => {
    const s = yearSummary();
    const card = targetCardModel(s, FIXTURE_TODAY);
    const cells = cellsOf(targetsSheet().layout);
    const memos = cells.filter(
      (c) =>
        c.col === 8 &&
        String(c.value).startsWith("← ") &&
        /분기/.test(String(c.value)),
    );
    const pct = (v: number | null) => `${((v ?? 0) * 100).toFixed(1)}%`;
    expect(memos).toHaveLength(4);
    for (const q of [0, 1]) {
      expect(String(memos[q].value)).toMatch(
        new RegExp(
          `^← ${q + 1}분기 달성률 ${pct(card.quarters[q].rate).replace(".", "\\.")} \\((.+ 부족|달성)\\)$`,
        ),
      );
    }
    expect(memos[2].value).toBe(
      `← 3분기 달성률 ${pct(card.quarters[2].rate)} (9월 미확정)`,
    );
    expect(memos[3].value).toBe(
      "← 4분기 진행 중 (경과 1/3개월, 확정된 달 없음)",
    );
    // 빨간 메모·빨간 총액 = 대시보드 warn
    expect(memos.map((m) => m.warn === true)).toEqual(
      card.quarters.map((q) => q.warn),
    );
    expect(card.quarters[2].warn).toBe(false);
    const totals = cells.filter(
      (c) => c.col === 6 && c.role === "total" && "formula" in c,
    );
    expect(totals.slice(1).map((c) => c.warn === true)).toEqual(
      card.quarters.map((q) => q.warn),
    );
  });

  it("분기 그룹 F = 확정 월 합계 = 대시보드 분기 실적, 연간 달성률 = 대시보드 연간 보기", () => {
    const s = yearSummary();
    const cells = cellsOf(targetsSheet().layout) as (Cell & {
      formula?: { result: number };
    })[];
    const groupTotals = cells
      .filter((c) => c.col === 6 && c.formula)
      .map((c) => c.formula!.result);
    // 첫째 = 연간 목표 블록 합계(분기 목표 합), 나머지 4개 = 분기 실적
    expect(groupTotals[0]).toBe(
      Number(s.targets.quarterTargets!.quarters.reduce((a, b) => a + b, 0n)),
    );
    expect(groupTotals.slice(1)).toEqual(s.targets.quarterActuals!.map(Number));
    const rate = cells.find(
      (c) => c.col === 9 && c.role === "auxPercent",
    ) as Cell & { formula: { result: number } };
    expect(rate.formula.result).toBe(s.targets.period!.rate);
    expect(targetsSheet().check.annualRate).toBe(s.targets.period!.rate);
  });
});

describe("분기에 확정된 달이 없을 때 — 달성률(0.0%)을 쓰지 않는다", () => {
  const memosFor = (
    patch: (
      m: ReturnType<typeof fixtureInput>["financeMonths"][number],
    ) => void,
    today: Date,
  ) => {
    const input = fixtureInput(YEAR);
    input.financeMonths.forEach(patch);
    input.today = today;
    const sheet = buildTargetsLayout({
      summary: computeManagementSummary(input),
      months: input.financeMonths,
      today,
    });
    return cellsOf(sheet.layout)
      .filter((c) => c.col === 8 && /^← \d분기/.test(String(c.value)))
      .map((c) => c.value);
  };

  it("끝난 분기가 모두 미확정이면 '(7·8·9월 미확정, 확정된 달 없음)'", () => {
    const memos = memosFor((m) => {
      if (m.year === 2026 && m.month >= 7) m.status = "DRAFT";
    }, FIXTURE_TODAY);
    expect(memos[2]).toBe("← 3분기 (7·8·9월 미확정, 확정된 달 없음)");
  });

  it("진행 중 분기에 확정된 달이 있으면 달성률을 쓴다 (경과 2/3개월)", () => {
    const today = new Date("2026-11-10T00:00:00Z");
    const input = fixtureInput(YEAR);
    input.financeMonths.push({
      ...input.financeMonths.at(-1)!,
      month: 10,
      status: "CONFIRMED",
    });
    input.today = today;
    const sheet = buildTargetsLayout({
      summary: computeManagementSummary(input),
      months: input.financeMonths,
      today,
    });
    const memo = cellsOf(sheet.layout).find(
      (c) => c.col === 8 && String(c.value).startsWith("← 4분기"),
    );
    expect(String(memo?.value)).toMatch(
      /^← 4분기 달성률 \d+\.\d% · 진행 중 \(경과 2\/3개월\)$/,
    );
  });
});

// 미수금 건별 기록 엑셀 — 2026-10-26부터 대시보드 미수금(외상매출금)과 기준이 달라 건별 결과와 비교
describe("미수금 통계 시트 배치 (미수금 건별 기록)", () => {
  it("제목 기준일, 경과일 그룹 순서·90일 초과 빨간 행", () => {
    const r = fixtureItemResult();
    const cells = cellsOf(buildReceivablesLayout(r).layout);
    expect(at(cells, 1, 3)?.value).toBe("미수금 통계 (9/30 기준)");
    const memos = cells.filter((c) => c.col === 8).map((c) => c.value);
    expect(memos.slice(0, 4)).toEqual([
      "← 90일 초과 1건",
      "← 61~90일 1건",
      "← 31~60일 1건",
      "← 0~30일 1건",
    ]);
    const over90 = cells.filter((c) => c.row === 3);
    expect(over90.map((c) => c.role)).toEqual(
      expect.arrayContaining([
        "warnName",
        "warnAmount",
        "warnNote",
        "warnTotal",
      ]),
    );
    // 예정일 지남은 적요 글자로만 (빨간색 아님)
    const overdue = cells.find((c) =>
      String(c.value).startsWith("08/10 발생"),
    )!;
    expect(overdue).toMatchObject({ role: "note" });
    expect(overdue.warn).toBeUndefined();
    expect(overdue.value).toBe("08/10 발생·51일·예정 09/15 지남");
  });

  it("빈 그룹도 빈 행 1개 + 총액 0 + 메모", () => {
    const r = fixtureItemResult();
    const only = {
      ...r,
      items: r.items.filter((i) => i.bucket === "0-30"),
    };
    const cells = cellsOf(buildReceivablesLayout(only).layout) as (Cell & {
      formula?: { result: number };
    })[];
    expect(at(cells, 3, 3)?.value ?? null).toBeNull();
    expect(cells.find((c) => c.row === 3 && c.col === 6)?.formula?.result).toBe(
      0,
    );
    expect(at(cells, 3, 8)?.value).toBe("← 90일 초과 0건");
  });

  it("거래처별 미수금: 금액 큰 순, '2건 · 최장 180일', H·I 90일 초과 = 건별 결과", () => {
    const r = fixtureItemResult();
    const sheet = buildReceivablesLayout(r);
    const cells = cellsOf(sheet.layout) as (Cell & {
      formula?: { result: number };
    })[];
    const start = rowOf(cells, "거래처별 미수금");
    const names = cells
      .filter((c) => c.row > start + 1 && c.col === 3)
      .map((c) => c.value);
    expect(names).toEqual(r.byCustomer.map((c) => c.customerName));
    expect(cells.find((c) => c.row === start + 2 && c.col === 5)?.value).toBe(
      "2건 · 최장 180일",
    );
    const over90Amount = r.aging.find((a) => a.bucket === "90+")?.amount ?? 0n;
    const total = cells.filter((c) => c.col === 6 && c.formula).at(-1)!.formula!
      .result;
    expect(total).toBe(Number(r.total));
    const over90 = cells.find((c) => c.col === 9 && c.formula)!.formula!.result;
    expect(over90).toBe(Number(over90Amount));
    expect(sheet.check).toMatchObject({ total: r.total, over90: over90Amount });
  });

  it("미수금 상세(목록형): 7열, 숨긴·수금 건 제외, 경과일 큰 순", () => {
    const list = receivablesListSheet(fixtureItemResult());
    expect(list.columns.map((c) => c.header)).toEqual([
      "거래처명",
      "발생일",
      "예정일",
      "경과일",
      "구간",
      "금액",
      "비고",
    ]);
    expect(list.rows.map((r) => r[3])).toEqual([180, 70, 51, 25]);
    expect(list.rows.some((r) => r[0] === "사아오일(가상)")).toBe(false);
    expect(list.rows[2]).toEqual([
      "거나수도(가상)",
      "2026-08-10",
      "2026-09-15",
      51,
      "31~60일",
      21_300_000,
      "분할 입금 예정",
    ]);
  });
});

describe("원본 양식과 셀 단위 비교 — 의도하지 않은 차이 0건", () => {
  it("목표 대비 실적 시트·미수금 통계 시트", async () => {
    const { wb, source, t, r } = await workbook();
    for (const [name, layout] of [
      ["2026", t.layout],
      ["2026-Q3", r.layout],
    ] as const) {
      const rows = stackedComparison(source, wb, name, layout);
      expect(rows.length, name).toBeGreaterThan(40);
      expect(unintended(rows), name).toEqual([]);
    }
  });

  it("비교가 실제 차이를 잡는다 (빨간 행 글꼴 크기 바꾸면 실패)", async () => {
    const { wb, source, r } = await workbook();
    const ws = wb.getWorksheet("2026-Q3")!;
    ws.getCell("C3").font = { ...ws.getCell("C3").font, size: 12 };
    expect(
      unintended(stackedComparison(source, wb, "2026-Q3", r.layout)).map(
        (d) => d.item,
      ),
    ).toEqual([expect.stringContaining("warnName — 글꼴")]);
  });

  it("테마·문서 속성 (원본 테마, 개인 이름 없음)", async () => {
    const { buf, template } = await workbook();
    expect(
      unintended(
        comparePackage(
          await readPackageParts(template),
          await readPackageParts(buf),
        ),
      ),
    ).toEqual([]);
  });

  it("인쇄 A4 가로 너비 맞춤, 미수금 상세는 첫 행 고정·자동 필터", async () => {
    const { wb } = await workbook();
    expect(wb.worksheets.map((w) => w.name)).toEqual([
      "2026",
      "2026-Q3",
      "미수금 상세",
    ]);
    for (const ws of wb.worksheets) {
      expect(ws.pageSetup).toMatchObject({
        paperSize: 9,
        orientation: "landscape",
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      });
    }
    const detail = wb.getWorksheet("미수금 상세")!;
    expect(detail.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
    expect(detail.autoFilter).toBeDefined();
    expect(wb.getWorksheet("2026")!.autoFilter).toBeUndefined();
  });

  it("F열 계산값 = 같은 그룹 D열 합 (수식 범위 확인)", async () => {
    const { wb } = await workbook();
    for (const name of ["2026", "2026-Q3"]) {
      const ws = wb.getWorksheet(name)!;
      ws.eachRow((row, r) => {
        const f = row.getCell(6);
        if (!f.formula) return;
        const [, from, to] = /SUM\(D(\d+):D(\d+)\)/
          .exec(f.formula)!
          .map(Number);
        expect(from, `${name}!F${r}`).toBe(r);
        let sum = 0;
        for (let i = from; i <= to; i++)
          sum += Number(ws.getCell(i, 4).value ?? 0);
        expect(f.result, `${name}!F${r}`).toBe(sum);
      });
    }
  });
});
