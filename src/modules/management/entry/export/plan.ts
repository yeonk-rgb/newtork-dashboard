// 월간 입력 엑셀 다운로드 — 월별 데이터 → 시트 구성 (순수 함수)
// - 당월: 그 달 시트 1장 (입력이 없어도 빈 모양 + "상태: 입력 없음")
// - 분기·연간·연초 누적: 맨 앞 합계 시트("2026-Q3") + 데이터가 있는 달(임시저장 포함)의 월 시트
// - 합계는 확정된 달만 (대시보드와 같은 숫자). 임시저장·입력 없는 달은 합계 시트 H2 에 빨간 글씨로 "제외: …"
// - 그 외 지출 항목: 사용 중인 항목 + 비활성이지만 그 시트 기간에 0원이 아닌 금액이 있는 항목 (월간 입력 화면과 같은 규칙)
import type { Period, YearMonth } from "@/shared/period/period";

import {
  monthName,
  periodMemoLabel,
  periodSheetName,
  periodTotalSuffix,
} from "../../export/period";
import { ENTRY_FIELDS, type EntryField } from "../schemas";

export type EntryMonthData = YearMonth & {
  status: "DRAFT" | "CONFIRMED";
  confirmedAt: Date | null;
  values: Record<EntryField, bigint>;
  /** categoryId → 금액 */
  others: Map<string, bigint>;
};

export type EntryCategoryInfo = {
  id: string;
  name: string;
  isActive: boolean;
  sortOrder: number;
};

export type SheetNote = { text: string; warn: boolean };

export type EntrySheet = {
  sheetName: string;
  /** month = 그 달 입력값 그대로, total = 확정된 달 합계 */
  kind: "month" | "total";
  /** 블록 제목 뒤 기간 "(2026년 3분기 합계)" — 월 시트는 null */
  titleSuffix: string | null;
  /** H열 메모의 기간 "당월" / "3분기" */
  memoLabel: string;
  /** null = 빈칸 (입력 없음) */
  values: Record<EntryField, number | null>;
  others: { name: string; amount: number | null; inactive: boolean }[];
  /** H1 상태 */
  status: SheetNote;
  /** H2 (합계 시트의 제외한 달) */
  status2: SheetNote | null;
};

const KST_MS = 9 * 60 * 60 * 1000;
const kstDate = (d: Date) =>
  new Date(d.getTime() + KST_MS).toISOString().slice(0, 10);

const sumOf = (list: bigint[]) => list.reduce((s, v) => s + v, 0n);

function sortCategories(categories: EntryCategoryInfo[]) {
  return [...categories].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, "ko"),
  );
}

function monthStatus(d: EntryMonthData | undefined): SheetNote {
  if (!d) return { text: "상태: 입력 없음", warn: true };
  if (d.status === "DRAFT") {
    return {
      text: "상태: 임시저장 (확정 전 — 대시보드 합계 제외)",
      warn: true,
    };
  }
  return {
    text: d.confirmedAt
      ? `상태: 확정 (${kstDate(d.confirmedAt)})`
      : "상태: 확정",
    warn: false,
  };
}

export function monthSheet(
  ym: YearMonth,
  d: EntryMonthData | undefined,
  categories: EntryCategoryInfo[],
): EntrySheet {
  const values = Object.fromEntries(
    ENTRY_FIELDS.map((f) => [f, d ? Number(d.values[f]) : null]),
  ) as Record<EntryField, number | null>;
  const others = sortCategories(categories)
    .filter((c) => c.isActive || (d?.others.get(c.id) ?? 0n) !== 0n)
    .map((c) => {
      const amount = d?.others.get(c.id);
      return {
        name: c.name,
        amount: amount === undefined ? null : Number(amount),
        inactive: !c.isActive,
      };
    });
  return {
    sheetName: monthName(ym),
    kind: "month",
    titleSuffix: null,
    memoLabel: periodMemoLabel({ unit: "month", ...ym }),
    values,
    others,
    status: monthStatus(d),
    status2: null,
  };
}

const monthList = (months: YearMonth[]) =>
  `${months.map((m) => m.month).join("·")}월`;

export function totalSheet(
  period: Period,
  months: YearMonth[],
  byMonth: Map<string, EntryMonthData>,
  categories: EntryCategoryInfo[],
): EntrySheet {
  const confirmed = months
    .map((ym) => byMonth.get(monthName(ym)))
    .filter((d): d is EntryMonthData => d?.status === "CONFIRMED");
  const has = confirmed.length > 0;
  const values = Object.fromEntries(
    ENTRY_FIELDS.map((f) => [
      f,
      has ? Number(sumOf(confirmed.map((d) => d.values[f]))) : null,
    ]),
  ) as Record<EntryField, number | null>;
  const otherSum = (id: string) =>
    sumOf(confirmed.map((d) => d.others.get(id) ?? 0n));
  const others = sortCategories(categories)
    .filter((c) => c.isActive || otherSum(c.id) !== 0n)
    .map((c) => ({
      name: c.name,
      amount: has ? Number(otherSum(c.id)) : null,
      inactive: !c.isActive,
    }));

  const excluded = months.flatMap((ym) => {
    const d = byMonth.get(monthName(ym));
    if (d?.status === "CONFIRMED") return [];
    return [`${ym.month}월 ${d ? "임시저장" : "입력 없음"}`];
  });
  return {
    sheetName: periodSheetName(period),
    kind: "total",
    titleSuffix: periodTotalSuffix(period),
    memoLabel: periodMemoLabel(period),
    values,
    others,
    status: has
      ? { text: `집계: 확정된 달만 (${monthList(confirmed)})`, warn: false }
      : { text: "집계: 확정된 달 없음", warn: true },
    status2:
      excluded.length > 0
        ? { text: `제외: ${excluded.join(" · ")}`, warn: true }
        : null,
  };
}

/** 기간의 시트 목록 (months = 기간 안 이번 달까지) */
export function planEntrySheets(input: {
  period: Period;
  months: YearMonth[];
  data: EntryMonthData[];
  categories: EntryCategoryInfo[];
}): EntrySheet[] {
  const byMonth = new Map(input.data.map((d) => [monthName(d), d]));
  const sheetOf = (ym: YearMonth) =>
    monthSheet(ym, byMonth.get(monthName(ym)), input.categories);
  if (input.period.unit === "month") return input.months.map(sheetOf);
  return [
    totalSheet(input.period, input.months, byMonth, input.categories),
    ...input.months.filter((ym) => byMonth.has(monthName(ym))).map(sheetOf),
  ];
}
