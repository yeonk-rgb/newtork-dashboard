import { describe, expect, it } from "vitest";

import { draftFromRow, draftToFields, emptyDraft, withArStatus } from "./draft";
import {
  createLedgerSchema,
  ledgerFieldsSchema,
  toLedgerData,
  updateLedgerSchema,
} from "./schemas";

const common = {
  partnerName: "  가나  상사(가상) ",
  amount: "12500000",
  note: "  ",
  dueOn: "",
  settledOn: "",
};

describe("ledgerFieldsSchema", () => {
  it("외상매출금: 이름 공백 정리, 금액 BigInt, 코드 앞자리 0 유지, 빈 칸은 null", () => {
    expect(
      ledgerFieldsSchema.parse({
        kind: "AR",
        arStatus: "LONG_OVERDUE",
        partnerCode: " 0000000087 ",
        ...common,
      }),
    ).toEqual({
      kind: "AR",
      arStatus: "LONG_OVERDUE",
      partnerCode: "0000000087",
      partnerName: "가나 상사(가상)",
      amount: 12_500_000n,
      note: null,
      dueOn: null,
      settledOn: null,
    });
  });

  it("거래처코드: 빈칸은 null, 10자리 숫자가 아니면 거부", () => {
    const ar = { kind: "AR", arStatus: "SCHEDULED", ...common };
    expect(ledgerFieldsSchema.parse({ ...ar, partnerCode: "" })).toMatchObject({
      partnerCode: null,
    });
    for (const partnerCode of ["87", "00000000871", "00000-0087"]) {
      const r = ledgerFieldsSchema.safeParse({ ...ar, partnerCode });
      expect(r.success).toBe(false);
      expect(r.error?.issues[0].message).toContain("숫자 10자리");
    }
  });

  it("구분별 필수 선택: 상태·매입유형·비용유형", () => {
    const cases = [
      { kind: "AR", partnerCode: "", arStatus: "" },
      { kind: "AP", purchaseType: "" },
      { kind: "ACCRUED_VENDOR", expenseType: "", autoTransfer: false },
    ];
    const messages = cases.map(
      (c) =>
        ledgerFieldsSchema.safeParse({ ...c, ...common }).error?.issues[0]
          .message,
    );
    expect(messages).toEqual([
      "상태를 고르세요.",
      "매입유형을 고르세요.",
      "비용유형을 고르세요.",
    ]);
  });

  it("잔액: 0원·빈칸·콤마·16자리는 거부, 거래처명 빈칸 거부", () => {
    const staff = { kind: "ACCRUED_STAFF", ...common };
    for (const amount of ["0", "", "1,000", "1234567890123456", "-5"]) {
      expect(ledgerFieldsSchema.safeParse({ ...staff, amount }).success).toBe(
        false,
      );
    }
    expect(
      ledgerFieldsSchema.safeParse({ ...staff, partnerName: "  " }).success,
    ).toBe(false);
  });

  it("알 수 없는 구분은 거부", () => {
    expect(
      ledgerFieldsSchema.safeParse({ kind: "ETC", ...common }).success,
    ).toBe(false);
  });
});

describe("toLedgerData", () => {
  it("구분에 맞지 않는 칸은 null, 자동이체는 업체만", () => {
    const vendor = ledgerFieldsSchema.parse({
      kind: "ACCRUED_VENDOR",
      expenseType: "OTHER",
      autoTransfer: true,
      ...common,
    });
    expect(toLedgerData(vendor)).toMatchObject({
      kind: "ACCRUED_VENDOR",
      expenseType: "OTHER",
      autoTransfer: true,
      arStatus: null,
      partnerCode: null,
      purchaseType: null,
    });
    // 업체가 아닌데 autoTransfer 가 와도 스키마가 버리고 false 로 저장
    const staff = ledgerFieldsSchema.parse({
      kind: "ACCRUED_STAFF",
      autoTransfer: true,
      ...common,
    });
    expect(toLedgerData(staff).autoTransfer).toBe(false);
  });
});

describe("create·update 요청", () => {
  const fields = { kind: "ACCRUED_STAFF", ...common };

  it("기준년월 범위", () => {
    expect(
      createLedgerSchema.safeParse({ year: 2026, month: 10, fields }).success,
    ).toBe(true);
    for (const [year, month] of [
      [2026, 13],
      [1999, 1],
      [2026, 1.5],
    ]) {
      expect(
        createLedgerSchema.safeParse({ year, month, fields }).success,
      ).toBe(false);
    }
  });

  it("update 는 id·updatedAt 필수", () => {
    expect(updateLedgerSchema.safeParse({ fields }).success).toBe(false);
    expect(
      updateLedgerSchema.safeParse({
        id: "x",
        expectedUpdatedAt: "2026-10-24T01:02:03.000Z",
        fields,
      }).success,
    ).toBe(true);
  });
});

describe("입력 행(draft)", () => {
  it("새 행 기본값: 외상매출금 = 당월수금예정, 업체 = 기타, 매입유형은 비움", () => {
    expect(emptyDraft("AR").arStatus).toBe("SCHEDULED");
    expect(emptyDraft("ACCRUED_VENDOR").expenseType).toBe("OTHER");
    expect(emptyDraft("AP").purchaseType).toBe("");
  });

  it("당월수금완료가 아니게 바꾸면 완료일을 지운다", () => {
    const done = withArStatus(emptyDraft("AR"), "COLLECTED", "2026-10-20");
    expect(done).toMatchObject({
      arStatus: "COLLECTED",
      settledOn: "2026-10-20",
    });
    expect(withArStatus(done, "SCHEDULED").settledOn).toBe("");
  });

  it("draftToFields → 스키마 통과, 저장된 행 ↔ draft 왕복", () => {
    const draft = {
      ...emptyDraft("AR"),
      partnerCode: "0000000087",
      partnerName: "가나상사",
      amount: "1000",
    };
    const parsed = ledgerFieldsSchema.parse(draftToFields("AR", draft));
    expect(parsed).toMatchObject({ partnerCode: "0000000087", amount: 1000n });

    const row = {
      id: "r1",
      kind: "AR" as const,
      arStatus: "COLLECTED" as const,
      purchaseType: null,
      expenseType: null,
      autoTransfer: false,
      partnerCode: "0000000102",
      partnerName: "다라",
      amount: "3300000",
      note: null,
      dueOn: null,
      settledOn: "2026-10-10",
      updatedAt: "2026-10-24T00:00:00.000Z",
      updatedBy: "seed",
      hidden: false,
      deletedAt: null,
      deletedBy: null,
    };
    expect(draftFromRow(row)).toMatchObject({
      arStatus: "COLLECTED",
      partnerCode: "0000000102",
      note: "",
      settledOn: "2026-10-10",
    });
  });
});
