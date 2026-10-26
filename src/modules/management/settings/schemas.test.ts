import { describe, expect, it } from "vitest";

import {
  categoryNameErrors,
  normalizeName,
  saveCategoriesSchema,
  saveTargetSchema,
} from "./schemas";

describe("saveTargetSchema", () => {
  const base = {
    year: 2026,
    revenueTarget: "2800000000",
    quarters: ["", "", "", ""],
    expectedUpdatedAt: null,
  };

  it("빈 분기는 null(자동 배분), 입력한 분기는 bigint", () => {
    const parsed = saveTargetSchema.parse({
      ...base,
      quarters: ["", "600000000", "", ""],
    });
    expect(parsed.revenueTarget).toBe(2_800_000_000n);
    expect(parsed.quarters).toEqual([null, 600_000_000n, null, null]);
  });

  it("연간 목표는 필수·0보다 커야 함, 음수·콤마 거부", () => {
    for (const bad of ["", "0", "-1", "1,000"]) {
      expect(
        saveTargetSchema.safeParse({ ...base, revenueTarget: bad }).success,
        bad,
      ).toBe(false);
    }
    expect(
      saveTargetSchema.safeParse({ ...base, quarters: ["1.5", "", "", ""] })
        .success,
    ).toBe(false);
  });

  it("직원 수: 빈칸·생략 = null, 숫자 = 명, 0·글자·5자리 거부", () => {
    expect(saveTargetSchema.parse(base).headcount).toBeNull();
    expect(
      saveTargetSchema.parse({ ...base, headcount: "" }).headcount,
    ).toBeNull();
    expect(saveTargetSchema.parse({ ...base, headcount: "12" }).headcount).toBe(
      12,
    );
    for (const bad of ["0", "1.5", "열둘", "12345"]) {
      expect(
        saveTargetSchema.safeParse({ ...base, headcount: bad }).success,
        bad,
      ).toBe(false);
    }
  });
});

describe("항목 이름", () => {
  it("비교할 때 공백·대소문자 무시", () => {
    expect(normalizeName("  광고  선전비 ")).toBe("광고 선전비");
    expect(normalizeName("SNS 광고")).toBe(normalizeName("sns   광고"));
  });

  it("중복·빈 이름·30자 초과를 행별로 알려준다 (중복은 양쪽 모두)", () => {
    const errors = categoryNameErrors([
      "광고선전비",
      "접대비",
      " 광고선전비 ",
      "",
      "가".repeat(31),
    ]);
    expect([...errors.keys()].sort()).toEqual([0, 2, 3, 4]);
    expect(errors.get(0)).toBe("같은 이름의 항목이 이미 있습니다.");
    expect(errors.get(3)).toBe("항목 이름을 입력하세요.");
    expect(errors.has(1)).toBe(false);
  });

  it("저장 스키마: 이름 공백 정리, 빈 이름 거부", () => {
    const ok = saveCategoriesSchema.parse({
      items: [
        { id: null, name: "  SNS   광고 ", costType: null, isActive: true },
      ],
      deletedIds: [],
      version: "5:x",
    });
    expect(ok.items[0].name).toBe("SNS 광고");
    expect(
      saveCategoriesSchema.safeParse({
        items: [{ id: null, name: "   ", costType: "FIXED", isActive: true }],
        deletedIds: [],
        version: "v",
      }).success,
    ).toBe(false);
  });
});
