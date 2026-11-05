// 단가 업로드 해석 — 값은 모두 가짜. 원본 "부품" 시트 모양(대외비 안내 줄·종류 줄·머리글 2번·분류 제목 행)만 흉내 냄
import { describe, expect, it } from "vitest";

import { parseCsv, type SheetTable } from "@/shared/upload/read-table";

import { classifyItems, classifyQuotes, quoteKey } from "./classify";
import { itemKey, partKey } from "./compute";
import {
  parseItemSheets,
  parseQuoteSheets,
  readDate,
  readPrice,
  TEMPLATE,
  toCsv,
} from "./parse-upload";

const sheet = (
  rows: (string | number | null)[][],
  sheetName = "Sheet1",
): SheetTable => ({ sheetName, rows });

describe("금액·날짜 칸", () => {
  it("금액: 숫자·콤마·원, 빈칸 = null, 음수·소수·글자는 오류", () => {
    expect(readPrice(500000)).toEqual({ ok: true, value: 500000 });
    expect(readPrice("1,234,000원")).toEqual({ ok: true, value: 1234000 });
    expect(readPrice(null)).toEqual({ ok: true, value: null });
    expect(readPrice(-1).ok).toBe(false);
    expect(readPrice(10.5).ok).toBe(false);
    expect(readPrice("문의").ok).toBe(false);
  });
  it("날짜: 하이픈·점·빗금·엑셀 일련번호, 없는 날짜는 null", () => {
    expect(readDate("2026-03-10")).toBe("2026-03-10");
    expect(readDate("2026.3.1")).toBe("2026-03-01");
    expect(readDate("2026/03/10")).toBe("2026-03-10");
    expect(readDate(46091)).toBe("2026-03-10");
    expect(readDate("2026-02-30")).toBeNull();
    expect(readDate("3월 10일")).toBeNull();
  });
});

describe("① 부품 단가표 — 한 줄 = 한 부품 (CSV 양식)", () => {
  it("양식 CSV 를 다시 읽으면 같은 값", () => {
    const csv = toCsv(TEMPLATE.items.rows);
    const r = parseItemSheets([sheet(parseCsv(csv.slice(1)), "CSV")]);
    expect(r.ok && r.rows.map((x) => x.values)).toEqual([
      {
        partNo: "VX-05-A-01",
        key: "VX05A01|MOTOR(예시)",
        partKey: "VX05A01",
        category: "05 MOTOR",
        name: "Motor (예시)",
        appliesTo: "NTI-01 ~ 03",
        basePrice: 500000,
      },
    ]);
  });
  it("분류 칸이 비면 바로 위 분류 제목 행, 기준단가 빈칸 = 미입력, 같은 파트넘버·품목(하이픈·공백·대소문자 무시)은 오류", () => {
    const r = parseItemSheets([
      sheet([
        ["분류", "파트넘버", "품목", "적용 모델", "기준단가"],
        ["01 현장서비스", null, null, null, null],
        [null, "VX-01-A-00", "가상 점검 출장", null, "300,000"],
        ["05 MOTOR", "VX-05-A-01", "Motor", "NTI-01 ~ 03", null],
        [null, null, null, null, null],
        [null, "vx05a01", " motor", null, 1],
        [null, "VX-05-A-02", null, null, 1],
        [null, "VX-05-A-03", "Motor", null, -5],
      ]),
    ]);
    if (!r.ok) throw new Error(r.error);
    expect(r.original).toBe(false);
    expect(
      r.rows.map((x) => [
        x.values.partNo,
        x.values.category,
        x.values.basePrice,
      ]),
    ).toEqual([
      ["VX-01-A-00", "01 현장서비스", 300000],
      ["VX-05-A-01", "05 MOTOR", null],
    ]);
    expect(r.errors.map((e) => e.row)).toEqual([6, 7, 8]);
    expect(r.errors[0].message).toContain("4행과 같은 파트넘버·품목");
    expect(r.skipped).toBe(2);
  });
  it("원본 [부품] 시트 형식: 구분 = 파트넘버, 적요 = 적용 모델, 분류 = 제목 행, 앞 시트(제품)는 건너뜀", () => {
    const r = parseItemSheets([
      sheet(
        [
          ["모델", "원가"],
          ["VXA-01", 100],
        ],
        "제품",
      ),
      sheet(
        [
          ["[대외비] 안내 문구"],
          ["종류", "종류", "종류", "기준단가"],
          ["구분", "품목", "적요", "기준단가"],
          ["구분", "품목", "적요", "기준단가"],
          ["01 현장서비스"],
          ["VX-01-A-00", "가상 수리", null, 400000],
          ["02 BODY"],
          ["VX-02-A-01", "가상 Body", "NTI-01 ~ 03", 0],
          ["VX-02-A-01", "가상 Encoder", null, 1],
        ],
        "부품",
      ),
    ]);
    if (!r.ok) throw new Error(r.error);
    expect(r.sheetName).toBe("부품");
    expect(r.original).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.rows.map((x) => x.values)).toEqual([
      {
        partNo: "VX-01-A-00",
        key: "VX01A00|가상수리",
        partKey: "VX01A00",
        category: "01 현장서비스",
        name: "가상 수리",
        appliesTo: "",
        basePrice: 400000,
      },
      {
        partNo: "VX-02-A-01",
        key: "VX02A01|가상BODY",
        partKey: "VX02A01",
        category: "02 BODY",
        name: "가상 Body",
        appliesTo: "NTI-01 ~ 03",
        basePrice: 0,
      },
      // 원본처럼 파트넘버가 같고 품목이 다르면 다른 부품
      {
        partNo: "VX-02-A-01",
        key: "VX02A01|가상ENCODER",
        partKey: "VX02A01",
        category: "02 BODY",
        name: "가상 Encoder",
        appliesTo: "",
        basePrice: 1,
      },
    ]);
  });
  it("머리글이 없으면 안내", () => {
    const r = parseItemSheets([sheet([["이름", "값"]])]);
    expect(r.ok).toBe(false);
  });
});

describe("② 출장지별 단가", () => {
  it("양식 CSV 를 다시 읽으면 같은 값", () => {
    const r = parseQuoteSheets([
      sheet(parseCsv(toCsv(TEMPLATE.quotes.rows).slice(1)), "CSV"),
    ]);
    expect(r.ok && r.rows.map((x) => x.values)).toEqual([
      {
        partNo: "VX-05-A-01",
        key: "VX05A01",
        name: "Motor (예시)",
        company: "가상정수센터",
        unitPrice: 480000,
        effectiveDate: "2026-03-10",
        note: "(예시)",
      },
    ]);
  });
  it("빈 칸·날짜 오류·파일 안 중복은 행별 오류", () => {
    const r = parseQuoteSheets([
      sheet([
        ["파트넘버", "출장지(업체)", "단가(원)", "적용시작일"],
        ["VX-05-A-01", "가상정수센터", 480000, "2026-03-10"],
        ["VX-05-A-01", "가상정수센터", 490000, "2026.03.10"],
        ["VX-05-A-01", null, 1, "2026-03-10"],
        ["VX-05-A-01", "가상발전소", null, "다음 달"],
      ]),
    ]);
    if (!r.ok) throw new Error(r.error);
    expect(r.rows).toHaveLength(1);
    expect(r.errors.map((e) => e.row)).toEqual([3, 4, 5]);
    expect(r.errors[2].message).toContain("단가가 비어 있습니다");
    expect(r.errors[2].message).toContain("적용 시작일을 읽지 못했습니다");
  });
});

describe("판정 — 같은 부품은 덮어씀 (피드백)", () => {
  const e = (
    id: string,
    partNo: string,
    name: string,
    basePrice: number | null,
    extra = {},
  ) => ({
    id,
    key: itemKey(partNo, name),
    partKey: partKey(partNo),
    partNo,
    category: "05 MOTOR",
    name,
    appliesTo: "",
    basePrice,
    hidden: false,
    ...extra,
  });
  const existing = new Map(
    [
      e("i1", "VX-05-A-01", "Motor", 500000),
      e("i2", "VX-07-A-01", "Board", 900000, { category: "07 BOARD" }),
      e("i3", "VX-09-B-01", "MC", null, { hidden: true }),
      e("i4", "VX-07-D-01", "Transformer", 1),
      e("i5", "VX-07-D-01", "Encoder", 1),
    ].map((x) => [x.key, x]),
  );
  it("부품: 새로 / 바뀜(칸별) / 같음 / 숨김", () => {
    const v = (
      partNo: string,
      name: string,
      basePrice: number | null,
      category = "05 MOTOR",
    ) => ({
      row: 1,
      values: {
        partNo,
        key: itemKey(partNo, name),
        partKey: partKey(partNo),
        category,
        name,
        appliesTo: "",
        basePrice,
      },
    });
    const j = classifyItems(
      [
        v("VX-05-A-01", "Motor", 520000),
        v("VX-07-A-01", "Board", 900000, "07 BOARD"),
        v("VX-09-B-01", "MC", 1),
        v("VX-11-A-01", "새 부품", 1),
      ],
      existing,
    );
    expect(j.changed.map((c) => c.diffs)).toEqual([
      [{ label: "뉴토크 기준값", before: "500,000원", after: "520,000원" }],
    ]);
    expect([j.created.length, j.unchanged.length, j.hidden.length]).toEqual([
      1, 1, 1,
    ]);
  });
  it("출장지 단가: 단가표에 없음·숨긴 부품·같은 파트넘버 여럿(품목 없음)은 오류, 같은 부품·출장지·날짜는 덮어씀", () => {
    const quotes = new Map([
      [
        quoteKey("i1", "가상정수센터", "2026-03-10"),
        { id: "q1", key: "", unitPrice: 480000, note: "", hidden: false },
      ],
    ]);
    const q = (partNo: string, unitPrice: number, name = "") => ({
      row: 2,
      values: {
        partNo,
        key: partKey(partNo),
        name,
        company: "가상정수센터",
        unitPrice,
        effectiveDate: "2026-03-10",
        note: "",
      },
    });
    const j = classifyQuotes(
      [
        q("VX-05-A-01", 470000),
        q("VX-07-A-01", 1),
        q("VX-09-B-01", 1),
        q("NOPE", 1),
        q("VX-07-D-01", 1),
        q("VX-07-D-01", 1, "encoder"),
        q("VX-05-A-01", 1, "Gear"),
      ],
      existing,
      quotes,
    );
    expect(j.changed.map((c) => [c.id, c.diffs[0].after])).toEqual([
      ["q1", "470,000원"],
    ]);
    expect(j.created.map((c) => c.values.itemId)).toEqual(["i2", "i5"]);
    expect(j.errors.map((x) => x.message.split(": ")[1].slice(0, 8))).toEqual([
      "숨긴 부품입니다",
      "단가표에 없는 ",
      "같은 파트넘버 ",
      '품목 "Gear',
    ]);
  });
});
