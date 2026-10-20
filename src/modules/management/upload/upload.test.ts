import ExcelJS from "exceljs";
import { describe, expect, it, vi } from "vitest";

import { EDIT_ONLY_MGMT, FAKE_USERS } from "@/shared/auth/testing/fake-users";
import type { AppUser } from "@/shared/auth/types";
import {
  decodeText,
  parseCsv,
  readTableFile,
  type Cell,
} from "@/shared/upload/read-table";

import { detectSheet, matchColumn } from "./columns";
import {
  parseAmount,
  parseMonth,
  parseUpload,
  type ExistingData,
  type FileTables,
} from "./parse-upload";
import { uploadAbilities } from "./rules";
import { buildTemplate } from "./template";

// EDIT_ONLY_MGMT = 경영지원 입력만 가능(지금 규칙엔 없는 조합 — 화면 분기 검사용)
vi.mock("@/shared/auth/can", async (importOriginal) => {
  const { withEditOnlyUser } = await import("@/shared/auth/testing/fake-users");
  return withEditOnlyUser(await importOriginal());
});

const today = new Date("2026-10-20T00:00:00Z");
const noExisting: ExistingData = { months: new Map(), targetYears: new Set() };
const ctx = (existing = noExisting, baseYear = 2026) => ({
  baseYear,
  today,
  existing,
});
const file = (
  sheetName: string,
  rows: Cell[][],
  fileName = "실적.xlsx",
): FileTables => ({
  fileName,
  result: { ok: true, sheets: [{ sheetName, rows }] },
});
const MONTHLY_HEADER = [
  "연도",
  "월",
  "상품매입액",
  "원재료매입액",
  "경비지출액",
  "광고선전비",
  "접대비",
  "그외지출액",
  "제품매출액",
  "상품매출액",
  "용역매출액",
];

describe("열 이름 자동 인식", () => {
  it("공백·괄호·단위·비슷한 이름", () => {
    expect(matchColumn("제품 매출액(원)")).toBe("productSales");
    expect(matchColumn("제품매출")).toBe("productSales");
    expect(matchColumn(" 상품 매입 ")).toBe("goodsPurchase");
    expect(matchColumn("원자재 매입액")).toBe("materialPurchase");
    expect(matchColumn("기타지출")).toBe("otherExpense");
    expect(matchColumn("기업업무추진비")).toBe("entertainment");
    expect(matchColumn("2026년 연간 목표매출액")).toBe("revenueTarget");
    expect(matchColumn("년도")).toBe("year");
    expect(matchColumn("비고")).toBeNull();
    // 상품매입 ↔ 상품매출 은 섞이지 않는다
    expect(matchColumn("상품매출액")).toBe("goodsSales");
  });

  it("머리글이 2행 아래에 있어도 찾고, 시트 종류를 판별", () => {
    const rows: Cell[][] = [
      ["2025년 월별 실적표", null],
      [null, null],
      ["월", "제품 매출액", "상품 매출액", "경비"],
      [1, 100, 10, 50],
    ];
    const m = detectSheet(rows, "Sheet1");
    expect(m.kind).toBe("monthly");
    expect(m.headerRow).toBe(2);
    expect(m.columns).toMatchObject({
      month: 0,
      productSales: 1,
      goodsSales: 2,
      operatingExpense: 3,
    });
    expect(
      detectSheet(
        [
          ["연도", "목표매출액"],
          [2026, 1],
        ],
        "목표",
      ).kind,
    ).toBe("annualTarget");
    expect(detectSheet([["거래처", "금액"]], "Sheet1").kind).toBe("unknown");
  });

  it("(천원) 단위는 원으로 환산", () => {
    const { preview, plan } = parseUpload(
      [
        file("월별", [
          ["월", "제품매출액(천원)"],
          [1, 1234],
        ]),
      ],
      ctx(noExisting, 2025),
    );
    expect(plan.months[0].productSales).toBe(1_234_000n);
    expect(preview.sheets[0].notes.join(" ")).toContain("환산");
  });
});

describe("값 해석", () => {
  it("금액: 숫자·쉼표·원·빈칸·-, 오류", () => {
    expect(parseAmount(1234)).toEqual({ ok: true, value: 1234n });
    expect(parseAmount("4,000,000,000")).toEqual({
      ok: true,
      value: 4_000_000_000n,
    });
    expect(parseAmount("1,000원")).toEqual({ ok: true, value: 1000n });
    expect(parseAmount(null)).toEqual({ ok: true, value: 0n });
    expect(parseAmount("-")).toEqual({ ok: true, value: 0n });
    expect(parseAmount("-500")).toEqual({ ok: false, error: "음수 금액" });
    expect(parseAmount("(500)")).toEqual({ ok: false, error: "음수 금액" });
    expect(parseAmount("12.5")).toEqual({ ok: false, error: "원 단위 소수점" });
    expect(parseAmount("abc")).toEqual({ ok: false, error: "숫자가 아님" });
    expect(parseAmount("1234567890123456")).toEqual({
      ok: false,
      error: "15자리 초과",
    });
  });

  it("월: 숫자·'3월'·'2026-03'·날짜", () => {
    expect(parseMonth(3)).toEqual({ year: null, month: 3 });
    expect(parseMonth("3월")).toEqual({ year: null, month: 3 });
    expect(parseMonth("2026-03")).toEqual({ year: 2026, month: 3 });
    expect(parseMonth("2026년 3월")).toEqual({ year: 2026, month: 3 });
    expect(parseMonth("2026-03-01")).toEqual({ year: 2026, month: 3 });
    expect(parseMonth(13)).toBeNull();
    expect(parseMonth("삼월")).toBeNull();
  });
});

describe("parseUpload", () => {
  it("양식 그대로: 연간목표·월별실적 → 저장 계획, 금액 천 단위 쉼표", () => {
    const { preview, plan } = parseUpload(
      [
        {
          fileName: "양식.xlsx",
          result: {
            ok: true,
            sheets: [
              {
                sheetName: "연간목표",
                rows: [
                  ["연도", "목표매출액"],
                  [2025, 4_000_000_000],
                ],
              },
              {
                sheetName: "월별실적",
                rows: [
                  MONTHLY_HEADER,
                  [2025, 1, 1, 2, 3, 4, 5, 6, 700_000_000, 8, 9],
                ],
              },
            ],
          },
        },
      ],
      ctx(),
    );
    expect(preview.canSave).toBe(true);
    expect(preview.saveCount).toBe(2);
    expect(preview.sheets.map((s) => s.kindLabel)).toEqual([
      "연간목표",
      "월별실적",
    ]);
    expect(preview.sheets[0].rows[0].cells).toEqual(["2025", "4,000,000,000"]);
    expect(preview.sheets[1].columns).toEqual(MONTHLY_HEADER);
    expect(plan.targets).toEqual([
      { year: 2025, revenueTarget: 4_000_000_000n },
    ]);
    expect(plan.months[0]).toMatchObject({
      year: 2025,
      month: 1,
      productSales: 700_000_000n,
      otherExpense: 6n,
    });
  });

  it("연도 열 없는 실적 시트는 기준 연도로", () => {
    const { preview, plan } = parseUpload(
      [
        file("Sheet1", [
          ["월", "제품매출액"],
          ["1월", 100],
          ["2월", 200],
        ]),
      ],
      ctx(noExisting, 2024),
    );
    expect(plan.months.map((m) => `${m.year}-${m.month}`)).toEqual([
      "2024-1",
      "2024-2",
    ]);
    expect(preview.sheets[0].notes[0]).toBe(
      "연도 열이 없어 기준 연도 2024년으로 저장합니다.",
    );
  });

  it("합계 행은 저장하지 않고 '합계 행 제외'로 표시", () => {
    const { preview, plan } = parseUpload(
      [
        file("월별", [
          ["연도", "월", "제품매출액"],
          [2025, 1, 100],
          [2025, 2, 200],
          ["합계", null, 300],
        ]),
      ],
      ctx(),
    );
    expect(plan.months).toHaveLength(2);
    expect(preview.sheets[0].rows[2]).toMatchObject({
      status: "total",
      messages: ["합계 행 제외"],
    });
    expect(preview.canSave).toBe(true);
  });

  it("오류 행이 하나라도 있으면 저장 불가 (빈 값·형식·중복·미래 달)", () => {
    const { preview } = parseUpload(
      [
        file("월별", [
          ["연도", "월", "제품매출액"],
          [2025, 1, 100], // 정상
          [null, 2, 100], // 연도 빈 값
          [2025, 13, 100], // 월 형식
          [2025, 3, "abc"], // 금액 형식
          [2025, 1, 50], // 같은 달 중복
          [2026, 12, 10], // 미래 달
          [2026, 10, 10], // 이번 달
        ]),
      ],
      ctx(),
    );
    const rows = preview.sheets[0].rows;
    expect(rows.map((r) => r.status)).toEqual([
      "ok",
      "error",
      "error",
      "error",
      "error",
      "error",
      "error",
    ]);
    expect(rows[1].messages).toContain("연도가 비어 있습니다");
    expect(rows[2].messages).toContain("월 형식 오류 (1~12)");
    expect(rows[3].messages).toContain("제품매출액: 숫자가 아님");
    expect(rows[4].messages[0]).toMatch(/2025년 1월이 이미 있습니다/);
    expect(rows[5].messages).toContain("미래 달은 올릴 수 없습니다");
    expect(rows[6].messages).toContain(
      "이번 달은 월이 끝난 뒤 올릴 수 있습니다",
    );
    expect(preview.errorCount).toBe(6);
    expect(preview.canSave).toBe(false);
  });

  it("목표 0원·빈 연도는 오류", () => {
    const { preview } = parseUpload(
      [
        file("목표", [
          ["연도", "목표매출액"],
          [2025, 0],
          [null, 100],
        ]),
      ],
      ctx(),
    );
    expect(preview.sheets[0].rows.map((r) => r.status)).toEqual([
      "error",
      "error",
    ]);
    expect(preview.canSave).toBe(false);
  });

  it("기존 데이터는 오류가 아니라 '덮어씀' 안내", () => {
    const existing: ExistingData = {
      months: new Map([
        ["2025-1", "CONFIRMED"],
        ["2025-2", "DRAFT"],
      ]),
      targetYears: new Set([2025]),
    };
    const { preview } = parseUpload(
      [
        file("월별", [
          ["연도", "월", "제품매출액"],
          [2025, 1, 100],
          [2025, 2, 100],
        ]),
        file(
          "목표",
          [
            ["연도", "목표매출액"],
            [2025, 100],
          ],
          "목표.xlsx",
        ),
      ],
      ctx(existing),
    );
    expect(preview.sheets[0].rows[0].messages).toEqual(["기존 확정 값 덮어씀"]);
    expect(preview.sheets[0].rows[1].messages).toEqual([
      "기존 임시저장 값 덮어씀(확정으로 저장)",
    ]);
    expect(preview.sheets[1].rows[0].messages).toEqual(["기존 목표 덮어씀"]);
    expect(preview.canSave).toBe(true);
  });

  it("인식 못한 시트는 저장하지 않고 안내, 파일 오류는 저장 불가", () => {
    const { preview } = parseUpload(
      [
        file("거래처", [
          ["거래처", "금액"],
          ["가나", 100],
        ]),
        { fileName: "옛날.xls", result: { ok: false, error: ".xls 안내" } },
      ],
      ctx(),
    );
    expect(preview.sheets[0].kind).toBe("unknown");
    expect(preview.fileErrors).toEqual([
      { fileName: "옛날.xls", error: ".xls 안내" },
    ]);
    expect(preview.canSave).toBe(false);
  });
});

describe("파일 읽기", () => {
  it("CSV: 따옴표·쉼표·줄바꿈", () => {
    expect(parseCsv('연도,월,제품매출액\r\n2025,1,"1,000"\n2025,2,\n')).toEqual(
      [
        ["연도", "월", "제품매출액"],
        ["2025", "1", "1,000"],
        ["2025", "2", null],
      ],
    );
  });

  it("CSV 인코딩: UTF-8(BOM)·EUC-KR(엑셀 기본)", () => {
    const bom = new Uint8Array([
      0xef,
      0xbb,
      0xbf,
      ...new TextEncoder().encode("월"),
    ]);
    expect(decodeText(bom.buffer)).toBe("월");
    // "월" 의 EUC-KR 바이트
    expect(decodeText(new Uint8Array([0xbf, 0xf9]).buffer)).toBe("월");
  });

  it(".xls 는 안내 메시지, 다른 확장자 거부", async () => {
    const xls = await readTableFile("a.xls", new ArrayBuffer(4));
    expect(xls.ok).toBe(false);
    expect(!xls.ok && xls.error).toContain(".xlsx 로 저장");
    expect((await readTableFile("a.pdf", new ArrayBuffer(4))).ok).toBe(false);
  });

  it("양식 다운로드 파일: 시트 이름·열 구성 그대로, 다시 읽으면 바로 인식", async () => {
    const buffer = await buildTemplate();
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["연간목표", "월별실적"]);
    const header = (name: string) =>
      (wb.getWorksheet(name)!.getRow(1).values as unknown[]).slice(1);
    expect(header("연간목표")).toEqual(["연도", "목표매출액"]);
    expect(header("월별실적")).toEqual(MONTHLY_HEADER);

    // 양식에 한 줄씩 채워 다시 읽기 (수식 결과·숫자 셀)
    wb.getWorksheet("연간목표")!.addRow([2025, 2_400_000_000]);
    wb.getWorksheet("월별실적")!.addRow([
      2025,
      3,
      1,
      2,
      3,
      4,
      5,
      6,
      { formula: "100+200", result: 300 },
      8,
      9,
    ]);
    const filled = (await wb.xlsx.writeBuffer()) as ArrayBuffer;
    const read = await readTableFile("양식.xlsx", filled);
    expect(read.ok).toBe(true);
    const { plan, preview } = parseUpload(
      [{ fileName: "양식.xlsx", result: read as { ok: true; sheets: [] } }],
      ctx(),
    );
    expect(preview.canSave).toBe(true);
    expect(plan.targets[0].revenueTarget).toBe(2_400_000_000n);
    expect(plan.months[0].productSales).toBe(300n);
  });
});

describe("권한", () => {
  it.each<[string, AppUser, boolean, boolean]>([
    ["관리자", FAKE_USERS.admin, true, true],
    ["경영지원팀", FAKE_USERS.mgmt, true, true],
    ["입력 전용(가정)", EDIT_ONLY_MGMT, true, false],
    ["생산 팀원", FAKE_USERS.prodMember, false, false],
  ])("%s: 화면 %s, 저장 %s", (_, user, view, save) => {
    const a = uploadAbilities(user);
    expect(a.canView).toBe(view);
    expect(a.canSave).toBe(save);
  });
});
