// 채권·채무 엑셀 다운로드 — 시트 한 장의 행 배치 (순수 함수, exceljs 모름)
// 고객사 원본 양식(ledger-template.xlsx)과 같은 순서·열 위치로, 행 수만 실제 데이터 수만큼
// - 블록: 제목(C:F 병합) → 머리글 → 데이터 → 빈 행. 순서 외상매출금 → 외상매입금 → 미지급비용-직원 → 미지급비용-업체
// - 그룹(외상매출금 상태별·다른 블록 전체)마다 행 수 = max(데이터 수, 1). 빈 그룹도 빈 행 1개 + 총액 0 + H열 메모
// - 총액: F열 그룹 병합 + =SUM(D첫행:D끝행) + 계산값 (엑셀을 열자마자 숫자가 보이고, 2단계 업로드 비교도 ✓)
// - 미지급비용-업체: 자동이체 행을 위에(연두, E:F 병합), 총액은 자동이체 제외 SUM (원본과 같음),
//   H·I열에 "자동이체 합계 / 전체 합계" (2026-10-25 결정 — 블록 아래 행으로 두면 업로드가 거래처로 읽음)
import {
  AR_GROUP_TOTAL_LABEL,
  AR_STATUSES,
  KIND_LABEL,
  KIND_TOTAL_LABEL,
  type ArStatus,
  type LedgerKind,
} from "../labels";
import type { LedgerRow } from "../rules";

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

/** 총액 칸 위치 — 병합 범위의 테두리(위·가운데·아래)를 정한다 */
export type TotalPart = "top" | "middle" | "bottom" | "single";

export type CellSpec = {
  /** 1부터 (A=1) */
  col: number;
  role: StyleRole;
  value?: string | number | null;
  formula?: { expr: string; result: number };
  /** 글자로 저장 (서식 "@") — 코드, 자동이체 적요 */
  asText?: boolean;
  totalPart?: TotalPart;
};

export type RowKind = "title" | "header" | "data" | "separator";

export type RowSpec = {
  row: number;
  kind: RowKind;
  /** 빈 행(구분) 뒤 블록 — 원본의 블록 사이 빈 행 높이를 가져온다 */
  after?: LedgerKind;
  cells: CellSpec[];
};

export type SheetLayout = {
  rows: RowSpec[];
  /** "C1:F1" 같은 병합 범위 */
  merges: string[];
  /** I열에 들어가는 가장 큰 금액 (열 너비 계산용) */
  maxExtraAmount: number;
};

export const COL = { A: 1, C: 3, D: 4, E: 5, F: 6, H: 8, I: 9 };

const toNumber = (amount: string) => Number(amount);

type GroupStyle = {
  name: StyleRole;
  amount: StyleRole;
  note: StyleRole;
  total: StyleRole;
  memo: StyleRole;
  /** 원본 총액 칸 테두리를 그대로 쓴다 (업체 F67:F79 는 칸마다 네 면 테두리 — 위·가운데·아래 규칙을 적용하지 않음) */
  keepTotalBorder?: boolean;
};

const GROUP_STYLE: Record<ArStatus | Exclude<LedgerKind, "AR">, GroupStyle> = {
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

const partOf = (i: number, n: number): TotalPart =>
  n === 1 ? "single" : i === 0 ? "top" : i === n - 1 ? "bottom" : "middle";

class Builder {
  rows: RowSpec[] = [];
  merges: string[] = [];
  maxExtraAmount = 0;

  get next() {
    return this.rows.length + 1;
  }

  push(kind: RowKind, cells: CellSpec[], after?: LedgerKind): number {
    const row = this.next;
    this.rows.push({ row, kind, cells, ...(after ? { after } : {}) });
    return row;
  }

  cell(row: number, spec: CellSpec) {
    this.rows[row - 1].cells.push(spec);
  }

  title(kind: LedgerKind) {
    const row = this.push("title", [
      { col: COL.C, role: "title", value: KIND_LABEL[kind] },
    ]);
    this.merges.push(`C${row}:F${row}`);
  }

  header(withCode: boolean) {
    this.push("header", [
      ...(withCode
        ? [{ col: COL.A, role: "codeHeader" as const, value: "코드" }]
        : []),
      { col: COL.C, role: "header", value: "거래처명" },
      { col: COL.D, role: "header", value: "잔액" },
      { col: COL.E, role: "header", value: "적요" },
      { col: COL.F, role: "header", value: "총액" },
    ]);
  }

  /** 그룹 하나: 행들 + F열 총액 병합·SUM + H열 메모. 첫 행·끝 행 번호를 돌려준다 */
  group(
    rows: LedgerRow[],
    style: GroupStyle,
    memo: string,
    withCode: boolean,
  ): { first: number; last: number; memoRow: number } {
    const n = Math.max(rows.length, 1);
    const first = this.next;
    const last = first + n - 1;
    const sum = rows.reduce((s, r) => s + toNumber(r.amount), 0);
    const memoRow = first + Math.floor((n - 1) / 2);
    for (let i = 0; i < n; i++) {
      const r = rows[i];
      const row = first + i;
      const cells: CellSpec[] = [];
      if (withCode) {
        cells.push({
          col: COL.A,
          role: "code",
          value: r?.partnerCode ?? null,
          asText: true,
        });
      }
      cells.push(
        { col: COL.C, role: style.name, value: r?.partnerName ?? null },
        {
          col: COL.D,
          role: style.amount,
          value: r ? toNumber(r.amount) : null,
        },
        { col: COL.E, role: style.note, value: r?.note ?? null },
        {
          col: COL.F,
          role: style.total,
          ...(style.keepTotalBorder ? {} : { totalPart: partOf(i, n) }),
          ...(i === 0
            ? { formula: { expr: `SUM(D${first}:D${last})`, result: sum } }
            : {}),
        },
      );
      if (row === memoRow) {
        cells.push({ col: COL.H, role: style.memo, value: `← ${memo}` });
      }
      this.push("data", cells);
    }
    if (n > 1) this.merges.push(`F${first}:F${last}`);
    return { first, last, memoRow };
  }

  separator(after: LedgerKind) {
    this.push("separator", [], after);
  }
}

/** 기준년월 한 달의 행(숨긴 행 제외, 화면 순서) → 시트 배치 */
export function buildSheetLayout(rows: LedgerRow[]): SheetLayout {
  const b = new Builder();
  const of = (kind: LedgerKind) =>
    rows.filter((r) => r.kind === kind && !r.hidden);

  // 외상매출금: 상태별 그룹 (장기미수 → 당월수금완료 → 당월수금예정)
  b.title("AR");
  b.header(true);
  for (const status of AR_STATUSES) {
    b.group(
      of("AR").filter((r) => r.arStatus === status),
      GROUP_STYLE[status],
      AR_GROUP_TOTAL_LABEL[status],
      true,
    );
  }
  b.separator("AR");

  for (const kind of ["AP", "ACCRUED_STAFF"] as const) {
    b.title(kind);
    b.header(false);
    b.group(of(kind), GROUP_STYLE[kind], KIND_TOTAL_LABEL[kind], false);
    b.separator(kind);
  }

  // 미지급비용-업체: 자동이체 행(연두, E:F 병합) → 일반 행(총액 = 자동이체 제외)
  b.title("ACCRUED_VENDOR");
  b.header(false);
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
  const g = b.group(
    normal,
    GROUP_STYLE.ACCRUED_VENDOR,
    KIND_TOTAL_LABEL.ACCRUED_VENDOR,
    false,
  );

  // H·I열: 자동이체 합계 / 전체 합계 (메모 아래 두 줄, 블록보다 길면 행을 더 쓴다)
  const autoSum = auto.reduce((s, r) => s + toNumber(r.amount), 0);
  const allSum = autoSum + normal.reduce((s, r) => s + toNumber(r.amount), 0);
  const extras: [string, string, number][] = [
    ["자동이체 합계", `SUM(D${autoFirst}:D${autoLast})`, autoSum],
    ["전체 합계", `SUM(D${autoFirst}:D${g.last})`, allSum],
  ];
  extras.forEach(([label, expr, result], i) => {
    const row = g.memoRow + 1 + i;
    while (b.rows.length < row) b.push("data", []);
    b.cell(row, { col: COL.H, role: "extraLabel", value: label });
    b.cell(row, {
      col: COL.I,
      role: "extraAmount",
      formula: { expr, result },
    });
  });
  b.maxExtraAmount = allSum;

  return { rows: b.rows, merges: b.merges, maxExtraAmount: b.maxExtraAmount };
}
