// 미수금 건별 기록 엑셀 — 시트 배치 (순수 함수, exceljs 모름)
// 2026-10-26부터 대시보드 미수금은 경영지원 관리 외상매출금 기준이고, 이 엑셀은 미수금 건별 기록 화면의 건별 참고 자료
// 기준일 = min(기간 말일, 오늘) (computeItemReceivables — 숨긴 건은 이미 빠짐)
// "미수금 통계 (9/30 기준)" 블록: 경과일 그룹 90일 초과 → 61~90일 → 31~60일 → 0~30일 (원본 외상매출금의 상태별 그룹처럼)
//   - 90일 초과 그룹은 원본 장기 미수금처럼 행 전체 빨간 글씨, "예정일 지남"은 새 색 없이 적요 글자로만
//   - 빈 그룹도 빈 행 1개 + 총액 0 + 메모
// "거래처별 미수금" 블록: 금액 큰 순, 적요 "3건 · 최장 135일", H·I에 "90일 초과" 합계
// "미수금 상세" 시트만 목록형 (첫 행 고정·자동 필터)
import { SheetBuilder, type GroupStyle } from "../../export/blocks";
import { COL } from "../../export/draw";
import type {
  ListSheet,
  StackedLayout,
  StackedRole,
} from "../../export/stacked";
import type { AgingBucket, ItemReceivableResult } from "../../metrics/types";

export const AGING_ORDER: { bucket: AgingBucket; label: string }[] = [
  { bucket: "90+", label: "90일 초과" },
  { bucket: "61-90", label: "61~90일" },
  { bucket: "31-60", label: "31~60일" },
  { bucket: "0-30", label: "0~30일" },
];

const NORMAL: GroupStyle<StackedRole> = {
  name: "name",
  amount: "amount",
  note: "note",
  total: "total",
  memo: "memo",
};
/** 원본 장기 미수금(C3~F3) — 행 전체 빨간 글씨 */
const WARN: GroupStyle<StackedRole> = {
  name: "warnName",
  amount: "warnAmount",
  note: "warnNote",
  total: "warnTotal",
  memo: "memo",
};

const pad = (n: number) => String(n).padStart(2, "0");
const md = (d: Date) => `${pad(d.getUTCMonth() + 1)}/${pad(d.getUTCDate())}`;
const iso = (d: Date) => d.toISOString().slice(0, 10);
export const asOfLabel = (d: Date) =>
  `${d.getUTCMonth() + 1}/${d.getUTCDate()}`;

function header(b: SheetBuilder<StackedRole, number>) {
  b.header([
    { col: COL.C, role: "header", value: "거래처명" },
    { col: COL.D, role: "header", value: "미수 금액" },
    { col: COL.E, role: "header", value: "적요" },
    { col: COL.F, role: "header", value: "총액" },
  ]);
}

export type ReceivablesSheet = {
  layout: StackedLayout;
  maxAux: number;
  /** 대조용: 그룹 총액 (대시보드 경과일 구간·KPI 와 비교) */
  check: { total: bigint; over90: bigint; count: number };
};

export function buildReceivablesLayout(
  r: ItemReceivableResult,
): ReceivablesSheet {
  const b = new SheetBuilder<StackedRole, number>();
  const { over90Row } = appendAgingBlock(b, r);
  b.separator(0);
  const result = appendCustomerBlock(b, r, over90Row);
  return { layout: b.layout(), ...result };
}

/** "미수금 통계 (9/30 기준)" 경과일 그룹 블록 (단독 다운로드·월별 종합 리포트 공용) — 90일 초과 그룹 첫 행을 돌려준다 */
export function appendAgingBlock(
  b: SheetBuilder<StackedRole, number>,
  r: ItemReceivableResult,
): { over90Row: number } {
  // ── 미수금 통계 (경과일 그룹) ──
  b.title(`미수금 통계 (${asOfLabel(r.asOf)} 기준)`, "title");
  header(b);
  let over90Row = 0;
  for (const { bucket, label } of AGING_ORDER) {
    const list = r.items.filter((i) => i.bucket === bucket);
    const g = b.group(
      list.map((i) => ({
        name: i.customerName,
        amount: Number(i.amount),
        note:
          `${md(i.occurredOn)} 발생·${i.ageDays}일` +
          (i.dueOn ? `·예정 ${md(i.dueOn)}${i.isOverdue ? " 지남" : ""}` : ""),
      })),
      bucket === "90+" ? WARN : NORMAL,
      {
        text: `${label} ${list.length}건`,
        warn: bucket === "90+" && list.length > 0,
      },
    );
    if (bucket === "90+") over90Row = g.first;
  }
  return { over90Row };
}

/** "거래처별 미수금" 블록 + H·I 90일 초과·수금 예정일 지남 */
export function appendCustomerBlock(
  b: SheetBuilder<StackedRole, number>,
  r: ItemReceivableResult,
  over90Row: number,
): Omit<ReceivablesSheet, "layout"> {
  // ── 거래처별 미수금 ──
  b.title("거래처별 미수금", "title");
  header(b);
  const maxAge = new Map<string, number>();
  for (const i of r.items) {
    maxAge.set(
      i.customerName,
      Math.max(maxAge.get(i.customerName) ?? 0, i.ageDays),
    );
  }
  const customers = b.group(
    r.byCustomer.map((c) => ({
      name: c.customerName,
      amount: Number(c.amount),
      note: `${c.count}건 · 최장 ${maxAge.get(c.customerName) ?? 0}일`,
    })),
    NORMAL,
    { text: `미수금 총액 ${r.count}건` },
  );
  const over90 = r.aging.find((a) => a.bucket === "90+");
  const aux: [string, string, number, boolean][] = [
    [
      "90일 초과",
      `F${over90Row}`,
      Number(over90?.amount ?? 0n),
      (over90?.amount ?? 0n) > 0n,
    ],
    [
      "수금 예정일 지남",
      String(r.expected.overdue.amount),
      Number(r.expected.overdue.amount),
      false,
    ],
  ];
  aux.forEach(([label, expr, result, warn], i) => {
    const row = customers.memoRow + 1 + i;
    b.cell(row, {
      col: COL.H,
      role: "auxLabel",
      value: label,
      ...(warn ? { warn: true } : {}),
    });
    b.cell(row, {
      col: COL.I,
      role: "auxAmount",
      // 예정일 지남은 시트 안 다른 칸으로 다시 계산할 수 없어(건별 예정일) 값만
      ...(i === 0 ? { formula: { expr, result } } : { value: result }),
      ...(warn ? { warn: true } : {}),
    });
  });

  return {
    maxAux: Math.max(
      Number(over90?.amount ?? 0n),
      Number(r.expected.overdue.amount),
    ),
    check: { total: r.total, over90: over90?.amount ?? 0n, count: r.count },
  };
}

/** "미수금 상세" 목록형 시트 — 건별 전체 (경과일 큰 순), 숨긴 건 제외 */
export function receivablesListSheet(r: ItemReceivableResult): ListSheet {
  const label = new Map(AGING_ORDER.map((a) => [a.bucket, a.label]));
  return {
    name: "미수금 상세",
    columns: [
      { header: "거래처명", width: 26 },
      { header: "발생일", width: 12, numFmt: "@" },
      { header: "예정일", width: 12, numFmt: "@" },
      { header: "경과일", width: 8, numFmt: "#,##0" },
      { header: "구간", width: 10 },
      { header: "금액", width: 15, numFmt: "#,##0" },
      { header: "비고", width: 30, numFmt: "@" },
    ],
    rows: [...r.items]
      .sort((a, b) => b.ageDays - a.ageDays || Number(b.amount - a.amount))
      .map((i) => [
        i.customerName,
        iso(i.occurredOn),
        i.dueOn ? iso(i.dueOn) : null,
        i.ageDays,
        label.get(i.bucket) ?? i.bucket,
        Number(i.amount),
        i.note,
      ]),
  };
}
