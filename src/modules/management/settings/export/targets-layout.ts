// 목표 대비 실적 엑셀 — 시트 한 장("2026")의 행 배치 (순수 함수, exceljs 모름)
// 원본 양식처럼 세로로 쌓기: "연간 목표매출액" 블록(1~4분기 목표, F = SUM) → "목표매출 달성률" 블록(월 행 + 분기 그룹 F = SUM)
// - 분기 달성률은 H 메모, 연간 합계·달성률·부족분은 H 라벨 + I 금액 (2026-10-25 결정)
// - 빨간색은 대시보드와 같은 규칙(targetCardModel): 분기가 끝났고 3개월 모두 확정됐는데 미달일 때만
//   미확정 달이 있으면 "← 3분기 달성률 68.6% (9월 미확정)", 진행 중이면 "← 4분기 달성률 12.3% · 진행 중 (경과 2/3개월)"
//   분기에 확정된 달이 하나도 없으면 달성률 없이 "← 4분기 진행 중 (경과 1/3개월, 확정된 달 없음)"
// - 월 행 적요: 확정 = "월 목표 234,166,666 (분기 ÷ 3)", 임시저장 = 빨간 "임시저장 — 합계 제외" (D 빈칸, 월간 입력 엑셀과 같은 방식)
// - 이름은 대시보드 표기와 같게 ("연간 목표매출액", "목표매출 달성률")
import { formatAmount, formatWonShort } from "@/shared/format/money";
import { monthIndex } from "@/shared/period/period";

import { targetCardModel } from "../../components/dashboard/model";
import { SheetBuilder, type GroupStyle } from "../../export/blocks";
import { COL } from "../../export/draw";
import type { StackedLayout, StackedRole } from "../../export/stacked";
import { monthRevenue } from "../../metrics/revenue";
import type { FinanceMonth, ManagementSummary } from "../../metrics/types";

export const TARGET_SHEET_LABELS = {
  annualTitle: "연간 목표매출액",
  rateTitle: "목표매출 달성률",
  monthNote: (target: bigint) => `월 목표 ${formatAmount(target)} (분기 ÷ 3)`,
  draft: "임시저장 — 합계 제외",
  missing: "입력 없음 — 합계 제외",
  noTarget: "목표가 설정되지 않았습니다 — 목표·항목 설정에서 입력하세요",
} as const;

const STYLE: GroupStyle<StackedRole> = {
  name: "name",
  amount: "amount",
  note: "note",
  total: "total",
  memo: "memo",
};

const pct = (v: number | null) =>
  v === null ? "-" : `${(v * 100).toFixed(1)}%`;

const HEADER = (b: SheetBuilder<StackedRole, number>) =>
  b.header([
    { col: COL.C, role: "header", value: "구분" },
    { col: COL.D, role: "header", value: "금액" },
    { col: COL.E, role: "header", value: "적요" },
    { col: COL.F, role: "header", value: "총액" },
  ]);

export type TargetsSheet = {
  layout: StackedLayout;
  maxAux: number;
  /** 대조용 (export:report · 테스트): 분기·연간 달성률 */
  check: {
    quarters: { quarter: number; rate: number | null; warn: boolean }[];
    annualRate: number | null;
  };
};

/**
 * @param summary 연간 기간(그 해)의 지표 — 대시보드와 같은 계산 결과
 * @param months 그 해 월별 재무 (임시저장 포함)
 * @param today 한국 날짜 — 끝난 분기·마감된 달 판단
 */
export function buildTargetsLayout(input: {
  summary: ManagementSummary;
  months: FinanceMonth[];
  today: Date;
}): TargetsSheet {
  const b = new SheetBuilder<StackedRole, number>();
  const result = appendTargetBlocks(b, input, 0);
  return { layout: b.layout(), ...result };
}

/**
 * 목표 두 블록을 builder 뒤에 이어 붙인다 (단독 다운로드·월별 종합 리포트 공용)
 * @param separator 두 블록 사이 빈 행 순서 (원본 38·50·63행 높이 고르기)
 */
export function appendTargetBlocks(
  b: SheetBuilder<StackedRole, number>,
  input: {
    summary: ManagementSummary;
    months: FinanceMonth[];
    today: Date;
  },
  separator: number,
): Omit<TargetsSheet, "layout"> {
  const { summary, months, today } = input;
  const year = summary.period.year;
  const { targets } = summary;
  const card = targetCardModel(summary, today);
  const thisMonth = monthIndex({
    year: today.getUTCFullYear(),
    month: today.getUTCMonth() + 1,
  });
  // ── 연간 목표매출액 (1~4분기 목표) ──
  const titleRow = b.title(TARGET_SHEET_LABELS.annualTitle, "title");
  HEADER(b);
  const qt = targets.quarterTargets;
  const annualGroup = b.group(
    [1, 2, 3, 4].map((q) => ({
      name: `${q}분기 목표`,
      amount: qt ? Number(qt.quarters[q - 1]) : null,
      note: qt
        ? qt.sources[q - 1] === "input"
          ? "직접 입력"
          : "자동 배분"
        : null,
    })),
    STYLE,
    { text: `${year}년 ${TARGET_SHEET_LABELS.annualTitle}` },
  );
  if (!qt) {
    b.cell(titleRow, {
      col: COL.H,
      role: "memo",
      value: TARGET_SHEET_LABELS.noTarget,
      warn: true,
    });
  } else if (qt.warning && targets.annual) {
    // 분기 목표 합계 ≠ 입력한 연간 목표 — 입력값을 보조 칸으로
    b.cell(annualGroup.memoRow + 1, {
      col: COL.H,
      role: "auxLabel",
      value: "입력한 연간 목표 (분기 합계와 다름)",
      warn: true,
    });
    b.cell(annualGroup.memoRow + 1, {
      col: COL.I,
      role: "auxAmount",
      value: Number(targets.annual.target),
    });
  }
  b.separator(separator);

  // ── 목표매출 달성률 (월 행 + 분기 그룹) ──
  b.title(TARGET_SHEET_LABELS.rateTitle, "title");
  HEADER(b);
  const byMonth = new Map(
    months.filter((m) => m.year === year).map((m) => [m.month, m]),
  );
  const groupFirstRows: number[] = [];
  let lastMemoRow = 0;
  for (const q of [1, 2, 3, 4] as const) {
    const row = card.quarters.find((x) => x.quarter === q);
    const items = [1, 2, 3].map((k) => {
      const month = (q - 1) * 3 + k;
      const m = byMonth.get(month);
      const closed = monthIndex({ year, month }) < thisMonth;
      const monthTarget = targets.monthTargets?.[month - 1] ?? null;
      if (m?.status === "CONFIRMED") {
        return {
          name: `${month}월`,
          amount: Number(monthRevenue(m)),
          note:
            monthTarget === null
              ? null
              : TARGET_SHEET_LABELS.monthNote(monthTarget),
        };
      }
      if (m?.status === "DRAFT") {
        return {
          name: `${month}월`,
          amount: null,
          note: TARGET_SHEET_LABELS.draft,
          noteWarn: true,
        };
      }
      if (closed) {
        return {
          name: `${month}월`,
          amount: null,
          note: TARGET_SHEET_LABELS.missing,
          noteWarn: true,
        };
      }
      return {
        name: `${month}월`,
        amount: null,
        note:
          monthTarget === null
            ? null
            : TARGET_SHEET_LABELS.monthNote(monthTarget),
      };
    });

    // 확정된 달이 하나도 없으면 달성률(0.0%)을 쓰지 않는다 — "실적이 없다"로 읽힐 수 있어서 (2026-10-26 결정)
    const confirmedCount = [1, 2, 3].filter(
      (k) => byMonth.get((q - 1) * 3 + k)?.status === "CONFIRMED",
    ).length;
    let memo: string;
    if (!row) {
      memo = `${q}분기`;
    } else if (row.state === "future") {
      memo = `${q}분기 시작 전`;
    } else if (row.state === "current") {
      const first = monthIndex({ year, month: (q - 1) * 3 + 1 });
      const elapsed = `경과 ${thisMonth - first + 1}/3개월`;
      memo =
        confirmedCount === 0
          ? `${q}분기 진행 중 (${elapsed}, 확정된 달 없음)`
          : `${q}분기 달성률 ${pct(row.rate)} · 진행 중 (${elapsed})`;
    } else if (confirmedCount === 0) {
      memo = `${q}분기 (${row.unconfirmedMonths.join("·")}월 미확정, 확정된 달 없음)`;
    } else if (row.unconfirmedMonths.length > 0) {
      memo = `${q}분기 달성률 ${pct(row.rate)} (${row.unconfirmedMonths.join("·")}월 미확정)`;
    } else {
      const gap = row.target - row.actual;
      memo = `${q}분기 달성률 ${pct(row.rate)}${gap > 0n ? ` (${formatWonShort(gap)} 부족)` : " (달성)"}`;
    }
    const g = b.group(
      items,
      STYLE,
      { text: memo, warn: row?.warn ?? false },
      { totalWarn: row?.warn ?? false },
    );
    groupFirstRows.push(g.first);
    lastMemoRow = g.memoRow;
  }

  // ── 연간 합계·달성률·부족분 (H 라벨 + I 금액) ──
  // 분모 = 입력한 연간 목표 (대시보드 연간 달성률과 같은 기준 — 분기 합계와 다르면 위에 빨간 보조 칸)
  const annualTarget = targets.annual?.target ?? null;
  const actual = targets.quarterActuals
    ? targets.quarterActuals.reduce((n, v) => n + v, 0n)
    : card.quarters.reduce((n, q) => n + q.actual, 0n);
  const annualRate = targets.period?.rate ?? null;
  const yearEnded = monthIndex({ year, month: 12 }) < thisMonth;
  const allConfirmed = [...Array(12)].every(
    (_, i) => byMonth.get(i + 1)?.status === "CONFIRMED",
  );
  const short = annualTarget !== null && actual < annualTarget;
  const actualRow = lastMemoRow + 1;
  const auxLines: [
    string,
    string,
    number,
    "auxAmount" | "auxPercent",
    boolean,
  ][] = [
    [
      "연간 실적 합계",
      groupFirstRows.map((r) => `F${r}`).join("+"),
      Number(actual),
      "auxAmount",
      false,
    ],
  ];
  if (annualTarget !== null) {
    auxLines.push(
      [
        TARGET_SHEET_LABELS.rateTitle,
        `IF(${annualTarget}=0,0,I${actualRow}/${annualTarget})`,
        annualRate ?? 0,
        "auxPercent",
        false,
      ],
      [
        "부족분",
        `MAX(${annualTarget}-I${actualRow},0)`,
        Number(short ? annualTarget - actual : 0n),
        "auxAmount",
        yearEnded && allConfirmed && short,
      ],
    );
  }
  auxLines.forEach(([label, expr, result, role, warn], i) => {
    const row = actualRow + i;
    b.cell(row, {
      col: COL.H,
      role: "auxLabel",
      value: label,
      ...(warn ? { warn: true } : {}),
    });
    b.cell(row, {
      col: COL.I,
      role,
      formula: { expr, result },
      ...(warn ? { warn: true } : {}),
    });
  });

  return {
    maxAux: Math.max(
      Number(actual),
      Number(annualTarget ?? 0n),
      Number(targets.annual?.target ?? 0n),
    ),
    check: {
      quarters: card.quarters.map((q) => ({
        quarter: q.quarter,
        rate: q.rate,
        warn: q.warn,
      })),
      annualRate,
    },
  };
}
