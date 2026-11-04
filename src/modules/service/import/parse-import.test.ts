// 출장보고서 엑셀 가져오기 해석 — 친구 저장소 test_import.py 사례 그대로
import { describe, expect, it } from "vitest";

import { COLUMNS, parseImportSheet, type ImportCell } from "./parse-import";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
function row(
  no: number,
  over: Partial<Record<(typeof COLUMNS)[number], ImportCell>> = {},
): ImportCell[] {
  const base: Record<string, ImportCell> = {
    번호: no,
    "출장 시작일": d("2025-01-05"),
    "출장 종료일": d("2025-01-07"),
    요청처: "라온발전소",
    "시·도": "충청남도",
    "시·군": "당진시",
    비용청구: "유상",
    "작업 구분": "수리",
    작성자: "이가상 과장",
    동행자: "박가상 사원\n최가상 대리",
    "제품(모델명 | 사양 | 일련번호 | 수량)": `AVA03 |  | A800${String(no).padStart(4, "0")} | 2`,
    "교체 부품": "Motor\nMain Board",
    "요청처 구분": "검색 불가",
    "추가 출장": "없음",
    "출장 목적": "가상 출장",
    "고장 내용": "고장",
    "작업 내용": "작업",
    "작업 결과": "정상작동",
    ...over,
  };
  return COLUMNS.map((c) => base[c]);
}
const sheet = (rows: ImportCell[][]) =>
  parseImportSheet([[...COLUMNS], ...rows], "가상.xlsx");

describe("parseImportSheet", () => {
  it("값 매핑 (친구 test_values_mapped)", () => {
    const r = sheet([
      row(1),
      row(2, {
        "시·도": "서울특별시",
        "시·군": null,
        비용청구: "무상",
        동행자: null,
        "교체 부품": null,
      }),
    ]);
    if (!r.ok) throw new Error(r.error);
    expect(r.errors).toEqual([]);
    const [a, b] = r.rows.map((x) => x.values);
    expect([a.tripStart, a.tripEnd, a.region, a.sigungu, a.billing]).toEqual([
      "2025-01-05",
      "2025-01-07",
      "충청남도",
      "당진시",
      "PAID",
    ]);
    expect(a.companions).toEqual(["박가상 사원", "최가상 대리"]);
    expect(a.products).toEqual([
      { modelName: "AVA03", spec: "", serialNo: "A8000001", quantity: 2 },
    ]);
    expect(a.parts.map((p) => [p.name, p.quantity])).toEqual([
      ["Motor", null],
      ["Main Board", null],
    ]);
    expect(a.note).toBe("엑셀 가져오기: 가상.xlsx 번호 1");
    expect([b.region, b.sigungu, b.billing, b.companions]).toEqual([
      "서울특별시",
      null,
      "FREE",
      [],
    ]);
  });

  it("옛 시·도 이름은 공식 승계 (전라남도 → 전남광주통합특별시)", () => {
    const r = sheet([row(1, { "시·도": "전라남도", "시·군": "여수시" })]);
    expect(r.ok && [r.rows[0].values.region, r.rows[0].values.sigungu]).toEqual(
      ["전남광주통합특별시", "여수시"],
    );
  });

  it("오류는 행마다 모은다 (하나라도 있으면 저장하지 않음 — 스크립트)", () => {
    const r = sheet([
      row(1),
      row(2, { "시·군": "없는시" }),
      row(3, { 비용청구: "반반" }),
      row(4, { "출장 시작일": "2025-01-05" }),
      row(5, { "제품(모델명 | 사양 | 일련번호 | 수량)": "AVA03 | X | 두 대" }),
      COLUMNS.map(() => null),
    ]);
    if (!r.ok) throw new Error(r.error);
    expect(r.rows).toHaveLength(1);
    expect(r.errors).toEqual([
      "3행(번호 2): 충청남도에 없는 시·군: '없는시'",
      "4행(번호 3): 비용청구는 유상·무상만 가능합니다: '반반'",
      "5행(번호 4): 날짜가 아닙니다: '2025-01-05'",
      "6행(번호 5): 제품 형식은 '모델명 | 사양 | 일련번호 | 수량'이어야 합니다: 'AVA03 | X | 두 대'",
    ]);
  });

  it("없는 열", () => {
    expect(parseImportSheet([["번호"]], "a.xlsx")).toMatchObject({ ok: false });
  });
});
