// 경영지원 관리 엑셀 다운로드 — 시트 한 장의 행 배치 (순수 함수, exceljs 모름)
// 고객사 원본 양식(ledger-template.xlsx)과 같은 순서·열 위치로, 행 수만 실제 데이터 수만큼
// - 블록: 제목(C:F 병합) → 머리글 → 데이터 → 빈 행. 순서 외상매출금 → 외상매입금 → 미지급비용-직원 → 미지급비용-업체
// - 그룹(외상매출금 상태별·다른 블록 전체)마다 행 수 = max(데이터 수, 1). 빈 그룹도 빈 행 1개 + 총액 0 + H열 메모
// - 총액: F열 그룹 병합 + =SUM(D첫행:D끝행) + 계산값 (엑셀을 열자마자 숫자가 보이고, 2단계 업로드 비교도 ✓)
// - 미지급비용-업체: 자동이체 행을 위에(연두, E:F 병합), 총액은 자동이체 제외 SUM (원본과 같음),
//   H·I열에 "자동이체 합계 / 전체 합계" (2026-10-25 결정 — 블록 아래 행으로 두면 업로드가 거래처로 읽음)
import {
  SheetBuilder,
  type GroupItem,
  type GroupStyle,
} from "../../export/blocks";
import {
  COL,
  type CellSpec as SharedCellSpec,
  type RowSpec as SharedRowSpec,
} from "../../export/draw";
import {
  AR_GROUP_TOTAL_LABEL,
  AR_STATUSES,
  KIND_LABEL,
  KIND_TOTAL_LABEL,
  type ArStatus,
  type LedgerKind,
} from "../labels";
import type { LedgerRow } from "../rules";

export { COL };
export type { TotalPart } from "../../export/draw";

/** 원본 양식에서 서식을 가져올 칸의 역할 (template.ts 의 ROLE_CELLS 와 짝) */
export type StyleRole =
  | "title"
  | "codeHeader"
  | "header"
  | "code"
  | "longName"
  | "longAmount"
  | "longNote"
  | "longTotal"
  | "collectedName"
  | "collectedAmount"
  | "collectedNote"
  | "scheduledName"
  | "scheduledAmount"
  | "scheduledNote"
  | "arTotal"
  | "apName"
  | "apAmount"
  | "apNote"
  | "staffName"
  | "staffAmount"
  | "staffNote"
  | "vendorName"
  | "vendorAmount"
  | "vendorNote"
  | "autoName"
  | "autoAmount"
  | "autoNote"
  | "autoTotalCol"
  | "otherTotal"
  | "vendorTotal"
  | "memo"
  | "memoAp"
  | "memoStaff"
  | "memoVendor"
  | "extraLabel"
  | "extraAmount";

export type CellSpec = SharedCellSpec<StyleRole>;
export type RowSpec = SharedRowSpec<StyleRole, LedgerKind>;

export type SheetLayout = {
  rows: RowSpec[];
  /** "C1:F1" 같은 병합 범위 */
  merges: string[];
  /** I열에 들어가는 가장 큰 금액 (열 너비 계산용) */
  maxExtraAmount: number;
};

const toNumber = (amount: string) => Number(amount);

const GROUP_STYLE: Record<
  ArStatus | Exclude<LedgerKind, "AR">,
  GroupStyle<StyleRole>
> = {
  LONG_OVERDUE: {
    name: "longName",
    amount: "longAmount",
    note: "longNote",
    total: "longTotal",
    memo: "memo",
  },
  COLLECTED: {
    name: "collectedName",
    amount: "collectedAmount",
    note: "collectedNote",
    total: "arTotal",
    memo: "memo",
  },
  SCHEDULED: {
    name: "scheduledName",
    amount: "scheduledAmount",
    note: "scheduledNote",
    total: "arTotal",
    memo: "memo",
  },
  AP: {
    name: "apName",
    amount: "apAmount",
    note: "apNote",
    total: "otherTotal",
    memo: "memoAp",
  },
  ACCRUED_STAFF: {
    name: "staffName",
    amount: "staffAmount",
    note: "staffNote",
    total: "otherTotal",
    memo: "memoStaff",
  },
  ACCRUED_VENDOR: {
    name: "vendorName",
    amount: "vendorAmount",
    note: "vendorNote",
    total: "vendorTotal",
    memo: "memoVendor",
    keepTotalBorder: true,
  },
};

const items = (rows: LedgerRow[]): GroupItem[] =>
  rows.map((r) => ({
    code: r.partnerCode,
    name: r.partnerName,
    amount: toNumber(r.amount),
    note: r.note,
  }));

const withCode = (style: GroupStyle<StyleRole>): GroupStyle<StyleRole> => ({
  ...style,
  code: "code",
});

function header(b: SheetBuilder<StyleRole, LedgerKind>, code: boolean) {
  b.header([
    ...(code
      ? [{ col: COL.A, role: "codeHeader" as const, value: "코드" }]
      : []),
    { col: COL.C, role: "header", value: "거래처명" },
    { col: COL.D, role: "header", value: "잔액" },
    { col: COL.E, role: "header", value: "적요" },
    { col: COL.F, role: "header", value: "총액" },
  ]);
}

/** 기준년월 한 달의 행(숨긴 행 제외, 화면 순서) → 시트 배치 */
export function buildSheetLayout(rows: LedgerRow[]): SheetLayout {
  const b = new SheetBuilder<StyleRole, LedgerKind>();
  const of = (kind: LedgerKind) =>
    rows.filter((r) => r.kind === kind && !r.hidden);

  // 외상매출금: 상태별 그룹 (장기 미수금 → 당월 수금 → 당월 수금예정)
  b.title(KIND_LABEL.AR, "title");
  header(b, true);
  for (const status of AR_STATUSES) {
    b.group(
      items(of("AR").filter((r) => r.arStatus === status)),
      withCode(GROUP_STYLE[status]),
      { text: AR_GROUP_TOTAL_LABEL[status] },
    );
  }
  b.separator("AR");

  for (const kind of ["AP", "ACCRUED_STAFF"] as const) {
    b.title(KIND_LABEL[kind], "title");
    header(b, false);
    b.group(items(of(kind)), GROUP_STYLE[kind], {
      text: KIND_TOTAL_LABEL[kind],
    });
    b.separator(kind);
  }

  // 미지급비용-업체: 자동이체 행(연두, E:F 병합) → 일반 행(총액 = 자동이체 제외)
  b.title(KIND_LABEL.ACCRUED_VENDOR, "title");
  header(b, false);
  const vendor = of("ACCRUED_VENDOR");
  const auto = vendor.filter((r) => r.autoTransfer);
  const normal = vendor.filter((r) => !r.autoTransfer);
  const autoFirst = b.next;
  const autoCount = Math.max(auto.length, 1);
  for (let i = 0; i < autoCount; i++) {
    const r = auto[i];
    const row = b.push("data", [
      { col: COL.C, role: "autoName", value: r?.partnerName ?? null },
      { col: COL.D, role: "autoAmount", value: r ? toNumber(r.amount) : null },
      // 원본 E66:F66 병합 "자동이체" 자리에 적요 원문 (없으면 "자동이체"). 날짜 서식(m/d)으로 바뀌지 않게 글자로
      {
        col: COL.E,
        role: "autoNote",
        value: r?.note || "자동이체",
        asText: true,
      },
      { col: COL.F, role: "autoTotalCol" },
    ]);
    b.merges.push(`E${row}:F${row}`);
  }
  const autoLast = autoFirst + autoCount - 1;
  const g = b.group(items(normal), GROUP_STYLE.ACCRUED_VENDOR, {
    text: KIND_TOTAL_LABEL.ACCRUED_VENDOR,
  });

  // H·I열: 자동이체 합계 / 전체 합계 (메모 아래 두 줄, 블록보다 길면 행을 더 쓴다)
  const autoSum = auto.reduce((s, r) => s + toNumber(r.amount), 0);
  const allSum = autoSum + normal.reduce((s, r) => s + toNumber(r.amount), 0);
  const extras: [string, string, number][] = [
    ["자동이체 합계", `SUM(D${autoFirst}:D${autoLast})`, autoSum],
    ["전체 합계", `SUM(D${autoFirst}:D${g.last})`, allSum],
  ];
  extras.forEach(([label, expr, result], i) => {
    const row = g.memoRow + 1 + i;
    b.cell(row, { col: COL.H, role: "extraLabel", value: label });
    b.cell(row, {
      col: COL.I,
      role: "extraAmount",
      formula: { expr, result },
    });
  });
  return { ...b.layout(), maxExtraAmount: allSum };
}
