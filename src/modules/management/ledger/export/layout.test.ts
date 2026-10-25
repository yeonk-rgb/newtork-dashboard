import { describe, expect, it } from "vitest";

import { buildSheetLayout, type RowSpec } from "./layout";
import { SAMPLE_ROWS } from "./test-rows";

const cellAt = (rows: RowSpec[], row: number, col: number) =>
  rows[row - 1].cells.find((c) => c.col === col);
const text = (rows: RowSpec[], row: number, col: number) =>
  cellAt(rows, row, col)?.value ?? null;

describe("buildSheetLayout — 빈 달 (양식 모양 유지)", () => {
  const { rows, merges } = buildSheetLayout([]);

  it("블록마다 제목·머리글, 그룹마다 빈 행 1개, 블록 사이 빈 행", () => {
    expect(rows.map((r) => r.kind)).toEqual([
      "title",
      "header",
      "data",
      "data",
      "data",
      "separator", // 외상매출금 3그룹
      "title",
      "header",
      "data",
      "separator", // 외상매입금
      "title",
      "header",
      "data",
      "separator", // 미지급비용-직원
      "title",
      "header",
      "data",
      "data", // 업체: 자동이체 1 + 일반 1
      "data", // I열 "자동이체 합계" 줄 (메모 아래)
      "data", // I열 "전체 합계" 줄
    ]);
    expect(
      rows.filter((r) => r.kind === "separator").map((r) => r.after),
    ).toEqual(["AR", "AP", "ACCRUED_STAFF"]);
  });

  it("빈 그룹도 총액 0 수식 + H열 메모", () => {
    expect(cellAt(rows, 3, 6)?.formula).toEqual({
      expr: "SUM(D3:D3)",
      result: 0,
    });
    expect([3, 4, 5].map((r) => text(rows, r, 8))).toEqual([
      "← 장기 미수금 업체",
      "← 당월 수금된 업체",
      "← 당월 수금예정인 업체",
    ]);
    expect(text(rows, 9, 8)).toBe("← 당월 매입 지출");
    expect(text(rows, 13, 8)).toBe("← 당월 경비 지출");
    expect(text(rows, 18, 8)).toBe("← 당월 그 외 지출");
  });

  it("제목 C:F 병합, 자동이체 빈 행은 E:F 병합 '자동이체'", () => {
    expect(merges).toEqual(["C1:F1", "C7:F7", "C11:F11", "C15:F15", "E17:F17"]);
    expect(text(rows, 17, 5)).toBe("자동이체");
    expect(cellAt(rows, 17, 5)?.asText).toBe(true);
  });
});

describe("buildSheetLayout — 샘플 16행", () => {
  const { rows, merges, maxExtraAmount } = buildSheetLayout(SAMPLE_ROWS);
  const names = (from: number, to: number) =>
    Array.from({ length: to - from + 1 }, (_, i) => text(rows, from + i, 3));

  it("외상매출금 그룹 순서·그룹 안 순서(화면 순서), F열 병합·SUM·계산값", () => {
    expect(names(3, 10)).toEqual([
      "가나상사(가상)",
      "나다산업(가상)",
      "다라엔지니어링(가상)",
      "라마테크(가상)",
      "마바건설(가상)",
      "바사플랜트(가상)",
      "사아워터(가상)",
      "아자에너지(가상)",
    ]);
    expect(merges).toContain("F3:F4");
    expect(merges).toContain("F5:F7");
    expect(merges).toContain("F8:F10");
    expect(cellAt(rows, 3, 6)?.formula).toEqual({
      expr: "SUM(D3:D4)",
      result: 16_900_000,
    });
    expect(cellAt(rows, 5, 6)?.formula).toEqual({
      expr: "SUM(D5:D7)",
      result: 7_150_000,
    });
    expect(cellAt(rows, 8, 6)?.formula).toEqual({
      expr: "SUM(D8:D10)",
      result: 15_290_000,
    });
    expect([3, 4].map((r) => cellAt(rows, r, 6)?.totalPart)).toEqual([
      "top",
      "bottom",
    ]);
    expect([5, 6, 7].map((r) => cellAt(rows, r, 6)?.totalPart)).toEqual([
      "top",
      "middle",
      "bottom",
    ]);
  });

  it("장기미수는 빨간 역할, 코드는 글자(앞자리 0), 코드 없는 거래처는 빈 칸", () => {
    expect(cellAt(rows, 3, 3)?.role).toBe("longName");
    expect(cellAt(rows, 3, 1)).toMatchObject({
      value: "0000000087",
      asText: true,
    });
    expect(cellAt(rows, 10, 1)?.value).toBeNull();
  });

  it("업체: 자동이체 행이 위(E:F 병합, 적요 원문 글자), 총액은 자동이체 제외, H·I열 2줄", () => {
    const vendorTitle =
      rows.findIndex((r) => r.cells[0]?.value === "미지급비용-업체") + 1;
    const auto = vendorTitle + 2;
    expect(text(rows, auto, 3)).toBe("타파통신(가상)");
    expect(cellAt(rows, auto, 5)).toMatchObject({
      value: "10/15",
      asText: true,
      role: "autoNote",
    });
    expect(merges).toContain(`E${auto}:F${auto}`);
    const first = auto + 1;
    expect(names(first, first + 1)).toEqual([
      "파하광고(가상)",
      "하가식당(가상)",
    ]);
    expect(cellAt(rows, first, 6)?.formula).toEqual({
      expr: `SUM(D${first}:D${first + 1})`,
      result: 2_580_000,
    });
    const memo = first; // 일반 2행 → 가운데 = 첫 행
    expect(text(rows, memo, 8)).toBe("← 당월 그 외 지출");
    expect(text(rows, memo + 1, 8)).toBe("자동이체 합계");
    expect(cellAt(rows, memo + 1, 9)?.formula).toEqual({
      expr: `SUM(D${auto}:D${auto})`,
      result: 165_000,
    });
    expect(text(rows, memo + 2, 8)).toBe("전체 합계");
    expect(cellAt(rows, memo + 2, 9)?.formula).toEqual({
      expr: `SUM(D${auto}:D${first + 1})`,
      result: 2_745_000,
    });
    expect(maxExtraAmount).toBe(2_745_000);
  });

  it("숨긴 행은 넣지 않는다", () => {
    const withHidden = buildSheetLayout([
      ...SAMPLE_ROWS,
      { ...SAMPLE_ROWS[0], id: "h", partnerName: "숨김(가상)", hidden: true },
    ]);
    expect(
      withHidden.rows
        .flatMap((r) => r.cells)
        .some((c) => c.value === "숨김(가상)"),
    ).toBe(false);
  });
});
