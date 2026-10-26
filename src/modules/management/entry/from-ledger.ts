// 월간 입력 [경영지원 관리에서 불러오기] 계산 (순수 함수 — 화면·Server Action·테스트 공용, 2026-10-26 결정 05-1·24·25)
// - 경영지원 관리 총액 = 월간 입력과 같은 숫자 (원본 H열 메모): 외상매입금 = 당월 매입, 미지급비용-직원 = 당월 경비,
//   미지급비용-업체 = 당월 그 외 지출
// - 미지급비용-업체는 자동이체 포함(그 달에 실제로 나간 돈). 원본 F열 총액(자동이체 제외)과 다르므로 둘 다 보여 준다
// - 경영지원 관리는 부가세 포함 금액 → 블록별 "÷1.1 공급가액으로 환산" 체크 (외상매입금·업체 기본 체크, 직원 기본 해제)
// - 결과는 입력란에만 채운다. 저장은 사람이 [임시저장]·[확정]으로 (자동 덮어쓰기 없음)
import { TERMS } from "../terms";
import type { ExpenseType, LedgerKind, PurchaseType } from "../ledger/labels";
import type { EntryField } from "./schemas";

export type FromLedgerBlock = Exclude<LedgerKind, "AR">;
export const FROM_LEDGER_BLOCKS: FromLedgerBlock[] = [
  "AP",
  "ACCRUED_STAFF",
  "ACCRUED_VENDOR",
];

/** ÷1.1 환산 기본값 (05-1 결정) */
export const DEFAULT_VAT_CONVERT: Record<FromLedgerBlock, boolean> = {
  AP: true,
  ACCRUED_STAFF: false,
  ACCRUED_VENDOR: true,
};

/** 서버가 넘기는 그 달 행 요약 (숨긴 행 제외, 외상매출금 제외) */
export type LedgerSourceRow = {
  kind: FromLedgerBlock;
  amount: bigint;
  purchaseType: PurchaseType | null;
  expenseType: ExpenseType | null;
  autoTransfer: boolean;
};

/** 업체 지출 종류 → 그 외 지출 항목 이름 (이름이 같은 항목을 기본으로 고른다) */
export const VENDOR_KEYS = ["ADVERTISING", "ENTERTAINMENT", "OTHER"] as const;
export type VendorKey = (typeof VENDOR_KEYS)[number];
/** 업체 행에 지출 종류가 비어 있으면 "기타" 로 본다 (화면 기본값과 같음) */
const vendorKeyOf = (t: ExpenseType | null): VendorKey => t ?? "OTHER";

/** 외상매입금 매입유형 → 월간 입력 칸. 비어 있으면 사람이 고른다 (기본: 채우지 않음) */
export const PURCHASE_FIELD: Record<PurchaseType, EntryField> = {
  GOODS: "goodsPurchase",
  RAW_MATERIAL: "materialPurchase",
};

export type Choice = {
  vat: Record<FromLedgerBlock, boolean>;
  /** 매입유형이 빈 외상매입금을 넣을 칸 (null = 채우지 않음) */
  unclassifiedPurchase: EntryField | null;
  /** 업체 지출 종류별 그 외 지출 항목 id (null = 채우지 않음) */
  vendorCategory: Record<VendorKey, string | null>;
};

export type BlockSum = { amount: bigint; count: number };
const zero = (): BlockSum => ({ amount: 0n, count: 0 });
const add = (s: BlockSum, amount: bigint) => {
  s.amount += amount;
  s.count += 1;
};

export type LedgerSums = {
  purchase: Record<PurchaseType, BlockSum>;
  /** 매입유형이 빈 외상매입금 */
  unclassifiedPurchase: BlockSum;
  staff: BlockSum;
  vendor: Record<VendorKey, BlockSum>;
  /** 업체 중 자동이체 행 (vendor 합계에 이미 포함) */
  vendorAuto: BlockSum;
  /** 블록 합계 (부가세 포함 원본 금액) */
  blockTotal: Record<FromLedgerBlock, BlockSum>;
  rowCount: number;
};

export function sumLedgerRows(rows: LedgerSourceRow[]): LedgerSums {
  const s: LedgerSums = {
    purchase: { GOODS: zero(), RAW_MATERIAL: zero() },
    unclassifiedPurchase: zero(),
    staff: zero(),
    vendor: { ADVERTISING: zero(), ENTERTAINMENT: zero(), OTHER: zero() },
    vendorAuto: zero(),
    blockTotal: { AP: zero(), ACCRUED_STAFF: zero(), ACCRUED_VENDOR: zero() },
    rowCount: rows.length,
  };
  for (const r of rows) {
    add(s.blockTotal[r.kind], r.amount);
    if (r.kind === "AP") {
      add(
        r.purchaseType ? s.purchase[r.purchaseType] : s.unclassifiedPurchase,
        r.amount,
      );
    } else if (r.kind === "ACCRUED_STAFF") {
      add(s.staff, r.amount);
    } else {
      add(s.vendor[vendorKeyOf(r.expenseType)], r.amount);
      if (r.autoTransfer) add(s.vendorAuto, r.amount);
    }
  }
  return s;
}

/** 부가세 포함 → 공급가액: ÷1.1, 원 단위 반올림 (BigInt) */
export function toSupplyAmount(amount: bigint): bigint {
  const negative = amount < 0n;
  const abs = negative ? -amount : amount;
  const result = (abs * 10n + 5n) / 11n;
  return negative ? -result : result;
}

export type FillTarget =
  | { type: "field"; field: EntryField }
  | { type: "category"; categoryId: string };

export type FillLine = {
  target: FillTarget;
  block: FromLedgerBlock;
  /** 이 칸에 들어가는 원본(부가세 포함) 합계 */
  source: bigint;
  /** 환산 후 넣을 값 */
  value: bigint;
  /** 이 칸에 들어가는 행 수 */
  count: number;
};

/** 칸마다 원본 금액을 모아서 블록 체크에 따라 환산 (칸 단위로 반올림 — 입력란 값과 같은 숫자) */
export function planFill(sums: LedgerSums, choice: Choice): FillLine[] {
  const lines = new Map<string, FillLine>();
  const put = (target: FillTarget, block: FromLedgerBlock, s: BlockSum) => {
    if (s.count === 0) return;
    const key =
      target.type === "field" ? `f:${target.field}` : `c:${target.categoryId}`;
    const line = lines.get(key) ?? {
      target,
      block,
      source: 0n,
      value: 0n,
      count: 0,
    };
    line.source += s.amount;
    line.count += s.count;
    lines.set(key, line);
  };

  put({ type: "field", field: "goodsPurchase" }, "AP", sums.purchase.GOODS);
  put(
    { type: "field", field: "materialPurchase" },
    "AP",
    sums.purchase.RAW_MATERIAL,
  );
  if (choice.unclassifiedPurchase) {
    put(
      { type: "field", field: choice.unclassifiedPurchase },
      "AP",
      sums.unclassifiedPurchase,
    );
  }
  put(
    { type: "field", field: "operatingExpense" },
    "ACCRUED_STAFF",
    sums.staff,
  );
  for (const key of VENDOR_KEYS) {
    const categoryId = choice.vendorCategory[key];
    if (categoryId) {
      put({ type: "category", categoryId }, "ACCRUED_VENDOR", sums.vendor[key]);
    }
  }

  return [...lines.values()].map((line) => ({
    ...line,
    value: choice.vat[line.block] ? toSupplyAmount(line.source) : line.source,
  }));
}

/** 업체 지출 종류 이름 → 같은 이름의 그 외 지출 항목 (없으면 null). "기타" 는 "기타…" 로 시작하는 항목도 찾는다 */
export function defaultVendorCategory(
  categories: { id: string; name: string; inactive?: boolean }[],
  labels: Record<VendorKey, string>,
): Record<VendorKey, string | null> {
  const active = categories.filter((c) => !c.inactive);
  const find = (key: VendorKey) => {
    const label = labels[key];
    const exact = active.find((c) => c.name === label);
    if (exact) return exact.id;
    if (key === "OTHER")
      return active.find((c) => c.name.startsWith(label))?.id ?? null;
    return null;
  };
  return {
    ADVERTISING: find("ADVERTISING"),
    ENTERTAINMENT: find("ENTERTAINMENT"),
    OTHER: find("OTHER"),
  };
}

/** 채우지 않는 금액 안내 (원본 금액 기준) — 화면 미리보기에 그대로 */
export function skippedNotes(
  sums: LedgerSums,
  choice: Choice,
  vendorLabels: Record<VendorKey, string>,
  won: (v: bigint) => string,
): string[] {
  const notes: string[] = [];
  if (sums.unclassifiedPurchase.count > 0 && !choice.unclassifiedPurchase) {
    notes.push(
      `매입유형이 빈 외상매입금 ${sums.unclassifiedPurchase.count}행(${won(sums.unclassifiedPurchase.amount)})은 채우지 않습니다. 넣을 칸을 고르거나 ${TERMS.ledger}에서 매입유형을 정하세요.`,
    );
  }
  for (const key of VENDOR_KEYS) {
    const s = sums.vendor[key];
    if (s.count > 0 && !choice.vendorCategory[key]) {
      notes.push(
        `미지급비용-업체 "${vendorLabels[key]}" ${s.count}행(${won(s.amount)})은 넣을 그 외 지출 항목이 없어 채우지 않습니다.`,
      );
    }
  }
  return notes;
}
