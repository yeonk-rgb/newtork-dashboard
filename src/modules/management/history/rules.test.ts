// 변경 이력 권한·필터·표기 — 관리자 기록은 관리자(대표)만 (조회 조건에서), 화면 표기는 한글 문장
import { describe, expect, it } from "vitest";

import { FAKE_USERS, fakeUser } from "@/shared/auth/testing/fake-users";

import {
  changeLines,
  formatKstDateTime,
  metaSummary,
  presentHistoryRow,
  screenLabel,
} from "./labels";
import {
  historyAbilities,
  historyFileName,
  historySearch,
  historyWhere,
  parseHistoryFilter,
  screenOptions,
} from "./rules";

const TODAY = new Date("2026-10-25T00:00:00Z");

describe("권한", () => {
  it("관리자(대표): 목록·관리자 기록·엑셀 모두", () => {
    expect(historyAbilities(FAKE_USERS.admin)).toEqual({
      canView: true,
      canSeeAdmin: true,
      canExport: true,
    });
  });
  it("경영지원팀: 목록만 (관리자 기록·엑셀 불가)", () => {
    expect(historyAbilities(FAKE_USERS.mgmt)).toEqual({
      canView: true,
      canSeeAdmin: false,
      canExport: false,
    });
  });
  it.each([
    "prodLeader",
    "prodMember",
    "svcLeader",
    "svcMember",
    "dual",
  ] as const)("%s: 아무것도 못 봄", (key) => {
    expect(historyAbilities(FAKE_USERS[key])).toEqual({
      canView: false,
      canSeeAdmin: false,
      canExport: false,
    });
  });
  it("초기 비밀번호를 안 바꾼 관리자도 불가", () => {
    expect(
      historyAbilities(fakeUser("admin", { mustChangePassword: true })),
    ).toMatchObject({ canView: false, canSeeAdmin: false });
  });
});

describe("필터", () => {
  it("기본: 오늘 포함 최근 30일, 1쪽", () => {
    expect(parseHistoryFilter({}, TODAY)).toEqual({
      from: "2026-09-26",
      to: "2026-10-25",
      actorId: null,
      screen: null,
      action: null,
      q: null,
      page: 1,
    });
  });
  it("틀린 값은 버리고, 시작일 > 종료일이면 바꾼다", () => {
    const f = parseHistoryFilter(
      {
        from: "2026-10-31",
        to: "2026-10-01",
        screen: "없는화면",
        action: "DROP",
        page: "-3",
      },
      TODAY,
    );
    expect(f).toMatchObject({
      from: "2026-10-01",
      to: "2026-10-31",
      screen: null,
      action: null,
      page: 1,
    });
    expect(parseHistoryFilter({ from: "2026-02-30" }, TODAY).from).toBe(
      "2026-09-26",
    );
  });
  it("기간은 한국 날짜 기준 (2026-10-01 00:00 KST ~ 2026-10-31 24:00 KST)", () => {
    const where = historyWhere(
      parseHistoryFilter({ from: "2026-10-01", to: "2026-10-31" }, TODAY),
      historyAbilities(FAKE_USERS.admin),
    );
    expect(where.occurredAt).toEqual({
      gte: new Date("2026-09-30T15:00:00Z"),
      lt: new Date("2026-10-31T15:00:00Z"),
    });
  });
  it("경영지원팀은 화면=관리자 계정 관리로 주소를 바꿔도 area management 조건이 붙는다", () => {
    const f = parseHistoryFilter({ screen: "admin-users" }, TODAY);
    expect(f.screen).toBe("admin-users");
    expect(historyWhere(f, historyAbilities(FAKE_USERS.mgmt))).toMatchObject({
      screen: "admin-users",
      area: "management",
    });
    expect(
      historyWhere(f, historyAbilities(FAKE_USERS.admin)),
    ).not.toHaveProperty("area");
  });
  it("대상 검색은 대상 이름에서 대소문자 무시", () => {
    const f = parseHistoryFilter({ q: " 가나상사 " }, TODAY);
    expect(historyWhere(f, historyAbilities(FAKE_USERS.mgmt))).toMatchObject({
      targetLabel: { contains: "가나상사", mode: "insensitive" },
    });
  });
  it("화면 고르기 목록: 경영지원팀에는 관리자 화면이 없다", () => {
    const keys = (key: "admin" | "mgmt") =>
      screenOptions(historyAbilities(FAKE_USERS[key])).map((s) => s.key);
    expect(keys("mgmt")).not.toContain("admin-users");
    expect(keys("mgmt")).not.toContain("history-export");
    expect(keys("admin")).toContain("admin-users");
  });
  it("주소·파일명", () => {
    const f = parseHistoryFilter(
      { from: "2026-10-01", to: "2026-10-31", q: "가나", page: "2" },
      TODAY,
    );
    expect(historySearch(f)).toBe(
      "from=2026-10-01&to=2026-10-31&q=%EA%B0%80%EB%82%98&page=2",
    );
    expect(historyFileName(f)).toBe("변경이력_2026-10-01_2026-10-31.xlsx");
  });
});

describe("화면 표기", () => {
  it("화면 이름은 한글로", () => {
    expect(
      [
        "ledger",
        "ledger-import",
        "ledger-export",
        "receivables",
        "entry",
        "targets",
        "expense-categories",
        "upload",
        "admin-users",
      ].map(screenLabel),
    ).toEqual([
      "채권·채무 관리",
      "채권·채무 엑셀 이관",
      "채권·채무 엑셀 다운로드",
      "미수금 관리",
      "월간 입력",
      "목표 설정",
      "지출 항목",
      "엑셀 업로드",
      "관리자(대표) · 계정 관리",
    ]);
  });

  it("바뀐 내용 한 줄씩, 빈 값은 (없음)", () => {
    expect(
      changeLines([
        {
          field: "amount",
          label: "잔액",
          before: "12,500,000원",
          after: "13,000,000원",
        },
        {
          field: "collectedOn",
          label: "수금일",
          before: null,
          after: "2026-10-25",
        },
      ]),
    ).toEqual([
      "잔액: 12,500,000원 → 13,000,000원",
      "수금일: (없음) → 2026-10-25",
    ]);
    expect(changeLines(null)).toEqual([]);
  });

  it("추가 정보는 JSON 대신 한글 문장", () => {
    expect(
      metaSummary("ledger-export", "EXPORT", {
        rows: 6,
        period: "2026-10",
        sheets: ["2026-10"],
        fileName: "경영지원_관리_2026-10.xlsx",
        sheetCount: 1,
      }),
    ).toBe("2026-10 · 시트 1장 · 6행 · 경영지원_관리_2026-10.xlsx");
    expect(
      metaSummary("ledger-import", "IMPORT", {
        mode: "추가",
        month: "2026-08",
        blocks: [{ sum: "39340000", kind: "AR", count: 8 }],
        fileName: "ledger-sample.xlsx",
        uploadId: "up-1",
        savedRows: 16,
        hiddenRows: 0,
        excludedRows: 0,
      }),
    ).toBe("2026-08 · 추가 · 16행 저장 · 숨긴 기존 행 0 · ledger-sample.xlsx");
    expect(
      metaSummary("admin-users", "PASSWORD_RESET", { result: "초기화함" }),
    ).toBe("비밀번호를 초기화함");
    expect(
      metaSummary("upload", "IMPORT", {
        uploadId: "up-7",
        fileNames: ["2026_실적.xlsx"],
        savedRows: 2,
        targetYears: [2026],
        months: ["2026-09"],
      }),
    ).toBe("2행 저장 · 목표 2026년 · 월별 실적 2026-09 · 2026_실적.xlsx");
    expect(
      metaSummary("history-export", "EXPORT", {
        from: "2026-10-01",
        to: "2026-10-31",
        rows: 12,
        fileName: "변경이력_2026-10-01_2026-10-31.xlsx",
      }),
    ).toBe(
      "2026-10-01 ~ 2026-10-31 · 12건 · 변경이력_2026-10-01_2026-10-31.xlsx",
    );
    // 모르는 형식은 아무것도 보여 주지 않는다 (JSON 그대로 노출 금지)
    expect(metaSummary("ledger", "UPDATE", { anything: 1 })).toBeNull();
  });

  it("일시는 한국 시간, 사람은 이름(아이디)", () => {
    expect(formatKstDateTime(new Date("2026-10-25T04:45:00Z"))).toBe(
      "2026-10-25 13:45",
    );
    const row = presentHistoryRow(
      {
        id: "a1",
        occurredAt: new Date("2026-10-25T04:45:00Z"),
        actorId: "u-mgmt",
        actorLoginId: "mgmt_member",
        screen: "ledger",
        action: "UPDATE",
        targetLabel: "2026-10 외상매출금 · 가나상사(샘플)",
        changes: [
          {
            field: "amount",
            label: "잔액",
            before: "12,500,000원",
            after: "13,000,000원",
          },
        ],
        meta: null,
      },
      () => "윤경영",
    );
    expect(row).toMatchObject({
      occurredAt: "2026-10-25 13:45",
      actor: "윤경영(mgmt_member)",
      screen: "채권·채무 관리",
      action: "수정",
      lines: ["잔액: 12,500,000원 → 13,000,000원"],
    });
  });
});
