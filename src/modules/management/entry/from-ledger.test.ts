import { describe, expect, it } from "vitest";

import { EXPENSE_TYPE_LABEL } from "../ledger/labels";
import {
  DEFAULT_VAT_CONVERT,
  defaultVendorCategory,
  planFill,
  skippedNotes,
  sumLedgerRows,
  toSupplyAmount,
  type Choice,
  type LedgerSourceRow,
} from "./from-ledger";

const row = (r: Partial<LedgerSourceRow> & Pick<LedgerSourceRow, "kind">) =>
  ({
    amount: 0n,
    purchaseType: null,
    expenseType: null,
    autoTransfer: false,
    ...r,
  }) as LedgerSourceRow;

const ROWS: LedgerSourceRow[] = [
  row({ kind: "AP", amount: 11_000_000n, purchaseType: "GOODS" }),
  row({ kind: "AP", amount: 22_000_000n, purchaseType: "RAW_MATERIAL" }),
  row({ kind: "AP", amount: 3_300_000n, purchaseType: "RAW_MATERIAL" }),
  row({ kind: "AP", amount: 1_100_000n }), // 매입유형 비어 있음
  row({ kind: "ACCRUED_STAFF", amount: 4_500_000n }),
  row({ kind: "ACCRUED_STAFF", amount: 500_000n }),
  row({
    kind: "ACCRUED_VENDOR",
    amount: 2_200_000n,
    expenseType: "ADVERTISING",
  }),
  row({
    kind: "ACCRUED_VENDOR",
    amount: 550_000n,
    expenseType: "ENTERTAINMENT",
  }),
  row({ kind: "ACCRUED_VENDOR", amount: 330_000n, expenseType: "OTHER" }),
  // 자동이체 (원본 F열 총액에서는 빠지지만 그 달에 나간 돈 → 포함, 05-25)
  row({
    kind: "ACCRUED_VENDOR",
    amount: 1_100_000n,
    expenseType: "OTHER",
    autoTransfer: true,
  }),
];

const CATEGORIES = [
  { id: "ad", name: "광고선전비" },
  { id: "ent", name: "접대비" },
  { id: "welfare", name: "복리후생비" },
  { id: "etc", name: "기타(엑셀 이관)" },
];

const choice = (over: Partial<Choice> = {}): Choice => ({
  vat: DEFAULT_VAT_CONVERT,
  unclassifiedPurchase: null,
  vendorCategory: defaultVendorCategory(CATEGORIES, EXPENSE_TYPE_LABEL),
  ...over,
});

const valueOf = (lines: ReturnType<typeof planFill>, key: string) =>
  lines.find((l) =>
    l.target.type === "field"
      ? l.target.field === key
      : l.target.categoryId === key,
  );

describe("÷1.1 공급가액 환산", () => {
  it("원 단위 반올림 (BigInt)", () => {
    expect(toSupplyAmount(11_000_000n)).toBe(10_000_000n);
    expect(toSupplyAmount(1_000n)).toBe(909n); // 909.09
    expect(toSupplyAmount(1_006n)).toBe(915n); // 914.5 → 915
    expect(toSupplyAmount(0n)).toBe(0n);
  });
});

describe("경영지원 관리 → 월간 입력 칸", () => {
  const sums = sumLedgerRows(ROWS);

  it("블록 합계와 업체 자동이체 (원본 F열 총액 = 전체 − 자동이체)", () => {
    expect(sums.blockTotal.AP).toEqual({ amount: 37_400_000n, count: 4 });
    expect(sums.blockTotal.ACCRUED_STAFF).toEqual({
      amount: 5_000_000n,
      count: 2,
    });
    expect(sums.blockTotal.ACCRUED_VENDOR).toEqual({
      amount: 4_180_000n,
      count: 4,
    });
    expect(sums.vendorAuto).toEqual({ amount: 1_100_000n, count: 1 });
    expect(sums.unclassifiedPurchase).toEqual({ amount: 1_100_000n, count: 1 });
  });

  it("기본: 외상매입금·업체 ÷1.1, 직원은 그대로, 자동이체 포함, 매입유형 빈 행은 채우지 않음", () => {
    const lines = planFill(sums, choice());
    expect(valueOf(lines, "goodsPurchase")?.value).toBe(10_000_000n);
    expect(valueOf(lines, "materialPurchase")).toMatchObject({
      source: 25_300_000n,
      value: 23_000_000n,
      count: 2,
    });
    expect(valueOf(lines, "operatingExpense")).toMatchObject({
      source: 5_000_000n,
      value: 5_000_000n,
    });
    expect(valueOf(lines, "ad")?.value).toBe(2_000_000n);
    expect(valueOf(lines, "ent")?.value).toBe(500_000n);
    // 기타 = 330,000 + 자동이체 1,100,000 → ÷1.1
    expect(valueOf(lines, "etc")).toMatchObject({
      source: 1_430_000n,
      value: 1_300_000n,
      count: 2,
    });
    expect(valueOf(lines, "welfare")).toBeUndefined();
  });

  it("체크를 바꾸면 그 블록만 원본 금액 그대로", () => {
    const lines = planFill(
      sums,
      choice({ vat: { AP: false, ACCRUED_STAFF: true, ACCRUED_VENDOR: true } }),
    );
    expect(valueOf(lines, "materialPurchase")?.value).toBe(25_300_000n);
    expect(valueOf(lines, "operatingExpense")?.value).toBe(4_545_455n);
    expect(valueOf(lines, "ad")?.value).toBe(2_000_000n);
  });

  it("매입유형이 빈 행을 넣을 칸을 고르면 그 칸에 더한다", () => {
    const lines = planFill(
      sums,
      choice({ unclassifiedPurchase: "materialPurchase" }),
    );
    expect(valueOf(lines, "materialPurchase")).toMatchObject({
      source: 26_400_000n,
      value: 24_000_000n,
      count: 3,
    });
  });

  it("같은 이름 항목이 없으면 채우지 않고 안내", () => {
    const c = choice({
      vendorCategory: defaultVendorCategory(
        [{ id: "ad", name: "광고선전비" }],
        EXPENSE_TYPE_LABEL,
      ),
    });
    expect(c.vendorCategory).toEqual({
      ADVERTISING: "ad",
      ENTERTAINMENT: null,
      OTHER: null,
    });
    const notes = skippedNotes(sums, c, EXPENSE_TYPE_LABEL, String);
    expect(notes).toEqual([
      "매입유형이 빈 외상매입금 1행(1100000)은 채우지 않습니다. 넣을 칸을 고르거나 경영지원 관리에서 매입유형을 정하세요.",
      '미지급비용-업체 "접대비" 1행(550000)은 넣을 그 외 지출 항목이 없어 채우지 않습니다.',
      '미지급비용-업체 "기타" 2행(1430000)은 넣을 그 외 지출 항목이 없어 채우지 않습니다.',
    ]);
  });

  it("비활성 항목은 기본으로 고르지 않는다, 행이 없으면 칸도 없음", () => {
    expect(
      defaultVendorCategory(
        [{ id: "ad", name: "광고선전비", inactive: true }],
        EXPENSE_TYPE_LABEL,
      ).ADVERTISING,
    ).toBeNull();
    expect(planFill(sumLedgerRows([]), choice())).toEqual([]);
  });
});
