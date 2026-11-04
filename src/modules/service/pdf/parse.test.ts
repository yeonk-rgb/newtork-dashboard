// 친구 저장소 backend/service/tests/test_pdf_import.py ParseTest 그대로 — 가짜 값으로 만든 줄 목록 (기업 PDF 는 저장소에 넣지 않음)
import { describe, expect, it } from "vitest";

import { PdfImportError, parseReportLines, type Line } from "./parse";

// 양식과 같은 3열 배치: 왼쪽 29, 가운데 214, 오른쪽 400. 오른쪽 칸 글자 끝 567
const [L, M, R, END] = [29, 214, 400, 567];
const ln = (text: string, left = L, right?: number): Line => ({
  text,
  left,
  right: right ?? left + 60,
});

function formLines(over: Record<string, string> = {}) {
  const v: { [k: string]: string } & { companions: string[]; parts: string[] } =
    {
      title: "가상정수장 밸브 A/S",
      start: "2026-03-02",
      end: "2026-03-03",
      companions: ["박가상 사원", "최가상 대리"],
      billing: "무상",
      qty: "2 대",
      parts: ["Main Board", "Magnetic Contactor (TR Cont…"],
      ...over,
    } as never;
  return [
    ln(`작성 ${v.title}`, L, 230),
    ln("Main Form main"),
    ln("출장정보"),
    ln("요청처구분"),
    ln("검색 불가"),
    ln("요청처(검색불가시)"),
    ln("가상정수장"),
    ln("현장담당자/연락처"),
    ln("홍가상"),
    ln("출장시작일", M),
    ln(v.start, M),
    ln("출장종료일", M),
    ln(v.end, M),
    ln("추가출장", M),
    ln("없음", M),
    ln("동행자", M),
    ...v.companions.map((c) => ln(c, M)),
    ln("작성일", R),
    ln("2026-03-04(수) 09:05", R),
    ln("작성자", R),
    ln("이가상 과장", R),
    ln("해피콜예정일", R),
    ln("작업개요"),
    ln("작업구분"),
    ln("수리"),
    ln("출장목적"),
    ln(v.title),
    ln("제품목록"),
    ln("모델명", 33),
    ln("AVA03", 33),
    ln("사양", 116),
    ln("380V/3Ph/60Hz, 29rpm", 116),
    ln("일련번호", 346),
    ln("A80000000001", 346),
    ln("수량", 513),
    ln(v.qty, 513),
    ln("수리내역"),
    ln("고장내용"),
    ln("1. 가상 고장 하나."),
    ln("2. 가상 고장 둘."),
    ln("작업내용", M),
    ln("1. 가상 작업.", M),
    ln("작업결과", R),
    ln("정상작동.", R),
    ln("이 줄은 칸 끝까지 가서 다음 줄로 넘어간 문장의 앞부", R, END),
    ln("분입니다.", R),
    ln("명판사진"),
    ln("작업전사진", M),
    ln("작업후사진", R),
    ln("비고"),
    ln("비용청구유무"),
    ln(v.billing),
    ln("부품사용내역"),
    ...v.parts.map((p) => ln(p)),
    ln("견적서구분", M),
    ln("검색 가능", M),
    ln("견적서", M),
    ln("[]", M),
    ln("승인자", R),
    ln("이가상 과장", R),
    ln("참조자", R),
  ];
}

describe("parseReportLines", () => {
  it("항목 값", () => {
    const r = parseReportLines(formLines(), [
      "Magnetic Contactor (TR Control)",
      "Motor",
    ]);
    const d = r.data;
    expect([d.title, d.status, d.requestOrg, d.siteContact]).toEqual([
      "가상정수장 밸브 A/S",
      "작성",
      "가상정수장",
      "홍가상",
    ]);
    expect([d.tripStart, d.tripEnd, d.extraTrip]).toEqual([
      "2026-03-02",
      "2026-03-03",
      "없음",
    ]);
    expect(d.writtenAt).toBe("2026-03-04T09:05");
    expect([d.authorName, d.companions]).toEqual([
      "이가상 과장",
      ["박가상 사원", "최가상 대리"],
    ]);
    expect(d).not.toHaveProperty("happyCallDate"); // 빈 항목은 넣지 않음
    expect(d.cc).toBe("");
    expect(d.products).toEqual([
      {
        modelName: "AVA03",
        spec: "380V/3Ph/60Hz, 29rpm",
        serialNo: "A80000000001",
        quantity: 2,
      },
    ]);
    expect(d.billing).toBe("FREE");
    expect(d.faultDescription).toBe("1. 가상 고장 하나.\n2. 가상 고장 둘.");
    expect(d.workResult).toBe(
      "정상작동.\n이 줄은 칸 끝까지 가서 다음 줄로 넘어간 문장의 앞부분입니다.",
    );
    expect(d.parts.map((p) => p.name)).toEqual([
      "Main Board",
      "Magnetic Contactor (TR Cont…",
    ]);
    expect(d.parts.every((p) => p.quantity === null)).toBe(true);
    expect(r.truncatedParts).toEqual([
      {
        index: 1,
        name: "Magnetic Contactor (TR Cont…",
        suggestions: ["Magnetic Contactor (TR Control)"],
      },
    ]);
    expect([d.region, d.sigungu]).toEqual([null, null]);
    expect(new Set(r.warnings.map((w) => w.field))).toEqual(
      new Set(["workResult", "parts", "region"]),
    );
  });

  it("확실하지 않은 값은 비우고 경고", () => {
    const r = parseReportLines(
      formLines({ start: "9월 29일", billing: "반반", qty: "한 대" }),
    );
    expect(r.data.tripStart).toBeNull();
    expect(r.data.billing).toBeNull();
    expect(r.data.products[0].quantity).toBeNull();
    const fields = r.warnings.map((w) => w.field);
    expect(fields).toEqual(
      expect.arrayContaining(["tripStart", "billing", "products"]),
    );
  });

  it("양식이 아니거나 글자가 없으면 오류", () => {
    expect(() => parseReportLines([])).toThrow(PdfImportError);
    expect(() => parseReportLines([])).toThrow(/스캔/);
    expect(() => parseReportLines([ln("견적서"), ln("합계 1,000원")])).toThrow(
      /양식이 아닙니다/,
    );
  });
});
