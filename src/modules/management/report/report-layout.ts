// 월별 종합 리포트 — 리포트 시트 한 장의 행 배치 (순수 함수, exceljs 모름, 2026-10-26)
// 담당자님이 대표님께 매달 드리는 리포트. 블록 순서 = 새 경영 대시보드 순서:
//   머리말(견적서 제목·정보 칸 배치) → 요약(KPI 4개) → 분기별 목표 달성 현황(목표 엑셀과 같은 블록) → 매출 → 지출
//   → 매출·지출 추이(월별 표, 그래프 없음) → 참고: 이익 구조 / 손익분기점(BEP, 임시 기준) / 미수금 통계(경과일 그룹)
// 넣지 않는 것: 산업 분야별·제품별 매출(샘플 데이터), AI 분석
// 숫자는 모두 대시보드와 같은 계산(summary·표시 모델·추이)에서 — 이 파일은 배치만 한다
import { formatWonShort } from "@/shared/format/money";
import {
  periodMonths,
  type Period,
  type YearMonth,
} from "@/shared/period/period";

import { dashboardKpis, type KpiModel } from "../components/dashboard/model";
import { itemLabel } from "../entry/export/layout";
import { SheetBuilder, type GroupStyle } from "../export/blocks";
import { COL, type CellSpec } from "../export/draw";
import { periodMemoLabel, periodTotalSuffix } from "../export/period";
import type { StackedLayout, StackedRole } from "../export/stacked";
import { WORKBOOK_AUTHOR } from "../export/template";
import type { TrendPoint } from "../metrics/trend";
import type { FinanceMonth, ManagementSummary } from "../metrics/types";
import { appendAgingBlock } from "../receivables/export/receivables-layout";
import { appendTargetBlocks } from "../settings/export/targets-layout";

type Builder = SheetBuilder<StackedRole, number>;

const NORMAL: GroupStyle<StackedRole> = {
  name: "name",
  amount: "amount",
  note: "note",
  total: "total",
  memo: "memo",
};

export const REPORT_LABELS = {
  title: "경 영 리 포 트",
  company: "뉴토크코리아㈜",
  basis: "확정된 달만 (대시보드와 같음)",
  cost: {
    purchases: "매입 포함 (임시 기준)",
    excludePurchases: "매입 제외 (참고 기준)",
  },
  otherExpense: "기타 (그 외 지출액)",
  otherItems: "기타 항목별 (광고선전비·접대비 등)",
} as const;

const pct = (v: number | null | undefined) =>
  v === null || v === undefined ? "-" : `${(v * 100).toFixed(1)}%`;
const rateText = (v: number | null) =>
  v === null
    ? "-"
    : `${v > 0 ? "▲" : v < 0 ? "▼" : ""}${Math.abs(v * 100).toFixed(1)}%`;
const amountDiffText = (v: bigint | null) =>
  v === null
    ? "-"
    : `${v > 0n ? "▲" : v < 0n ? "▼" : ""}${formatWonShort(v < 0n ? -v : v)}`;
const monthsText = (list: YearMonth[]) =>
  `${list.map((m) => m.month).join("·")}월`;

/** 리포트 블록 (쪽 나눔 단위): 제목 행 ~ 마지막 행 */
export type ReportBlock = { name: string; first: number; last: number };

export type ReportLayout = {
  layout: StackedLayout;
  maxAux: number;
  blocks: ReportBlock[];
};

function periodRange(period: Period): string {
  const months = periodMonths(period);
  const first = months[0];
  const last = months.at(-1)!;
  const lastDay = new Date(Date.UTC(last.year, last.month, 0)).getUTCDate();
  return `${first.month}/1 ~ ${last.month}/${lastDay}`;
}

function confirmationText(summary: ManagementSummary): {
  text: string;
  warn: boolean;
} {
  const c = summary.confirmation;
  const draft = c.unconfirmedMonths.filter((m) => m.reason === "DRAFT");
  const missing = c.unconfirmedMonths.filter((m) => m.reason === "MISSING");
  const parts = [
    c.confirmedMonths.length > 0
      ? `${monthsText(c.confirmedMonths)} 확정`
      : "확정된 달 없음",
    draft.length > 0 && `${monthsText(draft)} 임시저장`,
    missing.length > 0 && `${monthsText(missing)} 입력 없음`,
    c.pendingMonths.length > 0 && `${monthsText(c.pendingMonths)} 마감 전`,
  ].filter((p): p is string => !!p);
  return {
    text: parts.join(" · "),
    warn: draft.length > 0 || missing.length > 0 || !c.hasData,
  };
}

/** 머리말: 제목(C:I 병합, 16pt, 높이 30) + 왼쪽 [회사명·기간·작성일·작성자] / 오른쪽 [집계 기준·비용 기준·확정 현황·생성] */
function header(
  b: Builder,
  summary: ManagementSummary,
  meta: { writtenOn: string; author: string },
) {
  const titleRow = b.push("title", [
    { col: COL.C, role: "reportTitle", value: REPORT_LABELS.title },
  ]);
  b.rows[titleRow - 1].height = 30;
  b.merges.push(`C${titleRow}:I${titleRow}`);
  b.separator(0);
  const confirm = confirmationText(summary);
  const lines: [string, string, string, string, boolean][] = [
    ["회사명", REPORT_LABELS.company, "집계 기준", REPORT_LABELS.basis, false],
    [
      "기간",
      `${summary.label} (${periodRange(summary.period)})`,
      "비용 기준",
      REPORT_LABELS.cost[summary.profit.costMode],
      false,
    ],
    ["작성일", meta.writtenOn, "확정 현황", confirm.text, confirm.warn],
    ["작성자", meta.author, "생성", WORKBOOK_AUTHOR, false],
  ];
  for (const [l1, v1, l2, v2, warn] of lines) {
    const row = b.push("data", [
      { col: COL.C, role: "infoLabel", value: l1 },
      { col: COL.D, role: "infoValue", value: v1 },
      { col: COL.E, role: "infoValue" },
      { col: COL.F, role: "infoLabel", value: l2 },
      {
        col: COL.G,
        role: "infoValue",
        value: v2,
        ...(warn ? { warn: true } : {}),
      },
      { col: COL.H, role: "infoValue" },
      { col: COL.I, role: "infoValue" },
    ]);
    b.merges.push(`D${row}:E${row}`, `G${row}:I${row}`);
  }
}

function headerRow(b: Builder, labels: [string, string, string, string]) {
  b.header(
    [COL.C, COL.D, COL.E, COL.F].map((col, i) => ({
      col,
      role: "header" as const,
      value: labels[i],
    })),
  );
}

/** 요약: 대시보드 KPI 4개 (같은 숫자·이름). F = 직전 기간 대비, H = 전년 동기 대비 */
function summaryBlock(b: Builder, summary: ManagementSummary) {
  const kpis = dashboardKpis(summary);
  const by = (key: KpiModel["key"]) => kpis.find((k) => k.key === key)!;
  const revenue = by("revenue");
  const expense = by("expense");
  const profit = by("profit");
  const receivables = by("receivables");
  const prevLabel =
    revenue.deltas?.kind === "rate" ? revenue.deltas.rows[0].label : "직전";
  b.title(`요약 (${summary.label})`, "title");
  headerRow(b, ["구분", "금액", "적요", `${prevLabel} 대비`]);

  const delta = (k: KpiModel, i: number) => {
    if (!k.deltas) return null;
    const row = k.deltas.rows[i];
    if (!row) return null;
    return k.deltas.kind === "rate"
      ? rateText(row.value as number | null)
      : amountDiffText(row.value as bigint | null);
  };
  const lastYearMemo = (k: KpiModel) => {
    const row = k.deltas?.rows[1];
    return row ? `← ${row.label} ${delta(k, 1)}` : null;
  };
  const line = (
    k: KpiModel,
    note: string,
    opts: {
      formula?: { expr: string; result: number };
      warn?: boolean;
      memo?: string | null;
      memoWarn?: boolean;
    } = {},
  ) => {
    const warn = opts.warn ?? false;
    const cells: CellSpec<StackedRole>[] = [
      { col: COL.C, role: warn ? "warnName" : "name", value: k.title },
      {
        col: COL.D,
        role: warn ? "warnAmount" : "amount",
        ...(opts.formula
          ? { formula: opts.formula }
          : { value: Number(k.value) }),
      },
      { col: COL.E, role: warn ? "warnNote" : "note", value: note },
      {
        col: COL.F,
        role: "total",
        totalPart: "single",
        value: delta(k, 0) ?? "-",
        ...(warn ? { warn: true } : {}),
      },
    ];
    const memo = opts.memo === undefined ? lastYearMemo(k) : opts.memo;
    if (memo) {
      cells.push({
        col: COL.H,
        role: "memo",
        value: memo,
        ...(opts.memoWarn ? { warn: true } : {}),
      });
    }
    return b.push("data", cells);
  };

  const revenueRow = line(revenue, revenue.sub ?? "");
  const expenseRow = line(expense, expense.note ?? "");
  line(
    profit,
    // E열 너비 안에 들어가게 한 줄만 (이익률은 아래 "이익 구조" 블록 메모에)
    summary.profit.costMode === "purchases"
      ? "매입액을 원가로 본 임시 기준"
      : "매입을 뺀 참고 기준",
    {
      warn: profit.warn,
      // 지금 비용 기준(매입 포함)에서 추정 이익 = 매출 − 지출 (대시보드와 같음, 테스트 고정)
      ...(summary.profit.costMode === "purchases"
        ? {
            formula: {
              expr: `D${revenueRow}-D${expenseRow}`,
              result: Number(profit.value),
            },
          }
        : {}),
    },
  );
  const over90 = receivables.details?.[0];
  line(receivables, `${receivables.sub} · ${receivables.note}`, {
    memo: over90
      ? `← 90일 초과 ${formatWonShort(over90.amount)} (${over90.count}건)`
      : null,
    memoWarn: over90?.warn ?? false,
  });
}

/** 매출: 제품·상품·용역 (월간 입력 엑셀 매출 블록과 같은 이름 — 당월 "월간 제품 매출액", 합계 "제품 매출액") */
function revenueBlock(b: Builder, summary: ManagementSummary) {
  const { period } = summary;
  const kind = period.unit === "month" ? "month" : "total";
  const suffix = periodTotalSuffix(period);
  b.title(suffix ? `매출 ${suffix}` : "매출", "title");
  headerRow(b, ["항목", "금액", "적요", "총액"]);
  const field = {
    product: "productSales",
    goods: "goodsSales",
    service: "serviceSales",
  } as const;
  const g = b.group(
    summary.revenue.items.map((i) => ({
      name: itemLabel(field[i.key as keyof typeof field], kind),
      amount: Number(i.amount),
      note: null,
    })),
    NORMAL,
    { text: `${periodMemoLabel(period)} 매출 (확정된 달)` },
  );
  return { totalRow: g.first };
}

/** 지출: 상품 매입·원재료 매입·경비·기타 (+ 기타 항목별) */
function expenseBlock(b: Builder, summary: ManagementSummary) {
  const { period, expenses } = summary;
  const kind = period.unit === "month" ? "month" : "total";
  const suffix = periodTotalSuffix(period);
  b.title(suffix ? `지출 ${suffix}` : "지출", "title");
  headerRow(b, ["항목", "금액", "적요", "총액"]);
  const amount = (key: string) =>
    Number(expenses.items.find((i) => i.key === key)?.amount ?? 0n);
  const main = b.group(
    [
      {
        name: itemLabel("goodsPurchase", kind),
        amount: amount("goodsPurchase"),
        note: null,
      },
      {
        name: itemLabel("materialPurchase", kind),
        amount: amount("materialPurchase"),
        note: null,
      },
      {
        name: itemLabel("operatingExpense", kind),
        amount: amount("operatingExpense"),
        note: null,
      },
      {
        name: REPORT_LABELS.otherExpense,
        amount: amount("otherExpense"),
        note: "아래 항목별 합계",
      },
    ],
    NORMAL,
    { text: `${periodMemoLabel(period)} 지출 (확정된 달)` },
  );
  b.group(
    expenses.otherItems.map((i) => ({
      name: i.label,
      amount: Number(i.amount),
      note: null,
    })),
    NORMAL,
    { text: REPORT_LABELS.otherItems },
  );
  return {
    goodsRow: main.first,
    materialRow: main.first + 1,
    operatingRow: main.first + 2,
    otherRow: main.first + 3,
  };
}

/** 매출·지출 추이: 월별 표 (월 | 매출 | 지출 | 추정 이익) — 대시보드 추이와 같은 12개월, 그래프 없음 */
function trendBlock(b: Builder, trend: TrendPoint[]) {
  const first = trend[0];
  const last = trend.at(-1)!;
  b.title(
    `매출·지출 추이 (${first.year}.${first.month} ~ ${last.year}.${last.month})`,
    "title",
  );
  headerRow(b, ["월", "매출", "지출", "추정 이익"]);
  const STATUS_MEMO = {
    DRAFT: { text: "← 임시저장 — 합계 제외", warn: true },
    MISSING: { text: "← 입력 없음", warn: true },
    PENDING: { text: "← 마감 전", warn: false },
  } as const;
  for (const p of trend) {
    const confirmed = p.status === "CONFIRMED";
    const loss = confirmed && p.profit !== null && p.profit < 0n;
    const cells: CellSpec<StackedRole>[] = [
      { col: COL.C, role: "name", value: `${p.year}.${p.month}` },
      {
        col: COL.D,
        role: "trendAmount",
        value: confirmed ? Number(p.revenue) : null,
      },
      {
        col: COL.E,
        role: "trendAmount",
        value: confirmed ? Number(p.expense) : null,
      },
      {
        col: COL.F,
        role: "trendAmount",
        value: confirmed ? Number(p.profit) : null,
        ...(loss ? { warn: true } : {}),
      },
    ];
    if (!confirmed) {
      const memo = STATUS_MEMO[p.status as keyof typeof STATUS_MEMO];
      if (memo) {
        cells.push({
          col: COL.H,
          role: "memo",
          value: memo.text,
          ...(memo.warn ? { warn: true } : {}),
        });
      }
    }
    b.push("data", cells);
  }
}

/** 참고 — 이익 구조: 매출 − 매입 − 경비 − 기타 = 추정 이익 (위 매출·지출 블록 칸을 가리키는 수식) */
function profitBlock(
  b: Builder,
  summary: ManagementSummary,
  rows: {
    revenueTotal: number;
    goods: number;
    material: number;
    operating: number;
    other: number;
  },
) {
  const { revenue, expenses, profit } = summary;
  const amount = (key: string) =>
    Number(expenses.items.find((i) => i.key === key)?.amount ?? 0n);
  const purchases = profit.costMode === "purchases";
  b.title("이익 구조 (참고)", "title");
  headerRow(b, ["구분", "금액", "적요", "총액"]);
  const first = b.next;
  const items = [
    { name: "매출", amount: Number(revenue.total), note: "위 매출 총액" },
    {
      name: "매입 (상품·원재료)",
      amount: purchases
        ? -(amount("goodsPurchase") + amount("materialPurchase"))
        : null,
      note: purchases
        ? "비용 — 매입액을 원가로 본 임시 기준"
        : "비용 제외 (참고 기준)",
    },
    { name: "경비", amount: -amount("operatingExpense"), note: "비용" },
    { name: "기타", amount: -amount("otherExpense"), note: "비용" },
  ];
  const g = b.group(
    items,
    NORMAL,
    {
      text: `추정 이익 (이익률 ${pct(profit.margin)})`,
      warn: profit.profit < 0n,
    },
    { totalWarn: profit.profit < 0n },
  );
  // D열을 위 블록 칸을 가리키는 수식으로 (값도 함께 저장 — 엑셀에서 숫자를 고치면 따라 바뀜)
  const exprs = [
    `F${rows.revenueTotal}`,
    purchases ? `-(D${rows.goods}+D${rows.material})` : null,
    `-D${rows.operating}`,
    `-D${rows.other}`,
  ];
  exprs.forEach((expr, i) => {
    if (!expr) return;
    const cell = b.rows[first + i - 1].cells.find((c) => c.col === COL.D)!;
    cell.formula = { expr, result: items[i].amount ?? 0 };
    delete cell.value;
  });
  return g;
}

const BASIS_LABEL = {
  provisional: "임시 기준",
  category: "항목 설정",
  unclassified: "임시 기준 (미분류)",
} as const;

/** 참고 — 손익분기점(BEP): 변동비·고정비 그룹 + H·I 공헌이익·BEP 매출·달성률, 아래 한 줄 임시 기준 */
function breakEvenBlock(b: Builder, summary: ManagementSummary) {
  const be = summary.breakEven;
  b.title(
    `손익분기점(BEP)${be.provisionalNotes.length > 0 ? " — 임시 기준" : ""} (참고)`,
    "title",
  );
  headerRow(b, ["구분", "금액", "적요", "총액"]);
  const of = (cls: "VARIABLE" | "FIXED") =>
    be.items
      .filter((i) => i.costClass === cls)
      .map((i) => ({
        name: i.label,
        amount: Number(i.amount),
        note: BASIS_LABEL[i.basis],
      }));
  b.group(of("VARIABLE"), NORMAL, {
    text: `변동비 (매출 대비 ${pct(be.revenue === 0n ? null : Number(be.variableCost) / Number(be.revenue))})`,
  });
  const fixed = b.group(of("FIXED"), NORMAL, { text: "고정비" });
  const reached = be.rate !== null && be.rate >= 1;
  const lines: [string, CellSpec<StackedRole>, boolean][] = [
    [
      "매출",
      { col: COL.I, role: "auxAmount", value: Number(be.revenue) },
      false,
    ],
    [
      "공헌이익",
      { col: COL.I, role: "auxAmount", value: Number(be.contribution) },
      false,
    ],
    [
      "BEP 매출",
      be.bepRevenue === null
        ? { col: COL.I, role: "auxAmount", value: "-" }
        : { col: COL.I, role: "auxAmount", value: Number(be.bepRevenue) },
      false,
    ],
    [
      "BEP 달성률",
      be.rate === null
        ? {
            col: COL.I,
            role: "auxPercent",
            value: be.reason === "not-reachable" ? "도달 불가" : "-",
          }
        : { col: COL.I, role: "auxPercent", value: be.rate },
      !reached,
    ],
  ];
  lines.forEach(([label, cell, warn], i) => {
    const row = fixed.memoRow + 1 + i;
    b.cell(row, {
      col: COL.H,
      role: "auxLabel",
      value: label,
      ...(warn ? { warn: true } : {}),
    });
    b.cell(row, { ...cell, ...(warn ? { warn: true } : {}) });
  });
  // 임시 기준 — 기준 하나에 한 줄씩 (한 줄로 이으면 인쇄 폭을 넘어 잘린다)
  be.provisionalNotes.forEach((note, i) => {
    b.push("data", [
      {
        col: COL.C,
        role: "footnote",
        value: `${i === 0 ? "임시 기준 — " : "　　　　　 "}${note}`,
      },
    ]);
  });
  return {
    maxAux: Math.max(
      Number(be.revenue),
      Number(be.contribution),
      Number(be.bepRevenue ?? 0n),
    ),
  };
}

export function buildReportLayout(input: {
  /** 리포트 기간의 지표 (대시보드와 같은 계산) */
  summary: ManagementSummary;
  /** 그 해 연간 지표·월별 재무 — 분기별 목표 달성 현황 블록 (목표 엑셀과 같음) */
  yearSummary: ManagementSummary;
  yearMonths: FinanceMonth[];
  /** 대시보드 매출·지출 추이와 같은 12개월 */
  trend: TrendPoint[];
  today: Date;
  writtenOn: string;
  author: string;
}): ReportLayout {
  const b: Builder = new SheetBuilder<StackedRole, number>();
  const blocks: ReportBlock[] = [];
  let sep = 0;
  const nextSep = () => Math.min(++sep, 2);
  const block = (name: string, draw: () => void) => {
    if (b.rows.length > 0) b.separator(nextSep());
    const first = b.next;
    draw();
    blocks.push({ name, first, last: b.rows.length });
  };

  block("머리말", () => header(b, input.summary, input));
  block("요약", () => summaryBlock(b, input.summary));
  let targetsAux = 0;
  // 분기별 목표 달성 현황: 연간 목표매출액·목표매출 달성률 두 블록 (사이 빈 행 포함 한 단위로 쪽 나눔)
  block("분기별 목표 달성 현황", () => {
    targetsAux = appendTargetBlocks(
      b,
      {
        summary: input.yearSummary,
        months: input.yearMonths,
        today: input.today,
      },
      nextSep(),
    ).maxAux;
  });
  let revenueRows = { totalRow: 0 };
  block("매출", () => {
    revenueRows = revenueBlock(b, input.summary);
  });
  let expenseRows = {
    goodsRow: 0,
    materialRow: 0,
    operatingRow: 0,
    otherRow: 0,
  };
  block("지출", () => {
    expenseRows = expenseBlock(b, input.summary);
  });
  block("매출·지출 추이", () => trendBlock(b, input.trend));
  block("이익 구조", () => {
    profitBlock(b, input.summary, {
      revenueTotal: revenueRows.totalRow,
      goods: expenseRows.goodsRow,
      material: expenseRows.materialRow,
      operating: expenseRows.operatingRow,
      other: expenseRows.otherRow,
    });
  });
  let bepAux = 0;
  block("손익분기점(BEP)", () => {
    bepAux = breakEvenBlock(b, input.summary).maxAux;
  });
  block("미수금 통계", () => {
    appendAgingBlock(b, input.summary.receivables);
  });

  return {
    layout: b.layout(),
    maxAux: Math.max(targetsAux, bepAux),
    blocks,
  };
}
