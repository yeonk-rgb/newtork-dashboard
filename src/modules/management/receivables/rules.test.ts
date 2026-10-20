import { describe, expect, it, vi } from "vitest";

import { EDIT_ONLY_MGMT, FAKE_USERS } from "@/shared/auth/testing/fake-users";

import {
  canCreateReceivable,
  canManageHidden,
  filterReceivables,
  parseDateOnly,
  parseReceivableTab,
  receivableAbilities,
  receivableDateErrors,
  rowStatus,
  tabCounts,
  type ReceivableRow,
} from "./rules";

// 경영지원팀 = 확정까지 가능, EDIT_ONLY_MGMT = 입력만 가능(지금 규칙엔 없는 조합 — 화면 분기 검사용)
vi.mock("@/shared/auth/can", async (importOriginal) => {
  const { withEditOnlyUser } = await import("@/shared/auth/testing/fake-users");
  return withEditOnlyUser(await importOriginal());
});

const leader = FAKE_USERS.mgmt;
const member = EDIT_ONLY_MGMT;
const prod = FAKE_USERS.prodMember;
const ceo = FAKE_USERS.admin;

const TODAY = "2026-10-16";

const row = (patch: Partial<ReceivableRow>): ReceivableRow => ({
  id: "r1",
  customerName: "가나상하수도(가상)",
  occurredOn: "2026-09-01",
  amount: "1000000",
  dueOn: null,
  note: null,
  isCollected: false,
  collectedOn: null,
  updatedAt: "2026-10-01T00:00:00.000Z",
  updatedBy: "샘플 데이터",
  hidden: false,
  deletedAt: null,
  deletedBy: null,
  ...patch,
});

describe("receivableAbilities", () => {
  it("미수 건: 팀원은 수정·수금 처리, 숨김은 못 함", () => {
    const a = receivableAbilities(member, {
      isCollected: false,
      hidden: false,
    });
    expect(a).toMatchObject({
      canEdit: true,
      canCollect: true,
      canUncollect: false,
      canHide: false,
      canRestore: false,
    });
  });

  it("미수 건: 팀장은 숨김까지", () => {
    const a = receivableAbilities(leader, {
      isCollected: false,
      hidden: false,
    });
    expect(a).toMatchObject({ canEdit: true, canCollect: true, canHide: true });
  });

  it("수금 완료 건: 팀원은 수정 불가 + 안내, 팀장은 수정·수금 취소·숨김", () => {
    const m = receivableAbilities(member, { isCollected: true, hidden: false });
    expect(m.canEdit).toBe(false);
    expect(m.canCollect).toBe(false);
    expect(m.notice).toBe("수금 완료 건은 팀장만 수정할 수 있습니다.");

    const l = receivableAbilities(leader, { isCollected: true, hidden: false });
    expect(l).toMatchObject({
      canEdit: true,
      canCollect: false,
      canUncollect: true,
      canHide: true,
    });
  });

  it("숨긴 건: 팀장·대표는 복구만, 팀원은 아무것도 못 함", () => {
    for (const u of [leader, ceo]) {
      expect(
        receivableAbilities(u, { isCollected: false, hidden: true }),
      ).toEqual({
        canEdit: false,
        canCollect: false,
        canUncollect: false,
        canHide: false,
        canRestore: true,
        notice: null,
      });
    }
    const m = receivableAbilities(member, { isCollected: true, hidden: true });
    expect(m.canRestore).toBe(false);
    expect(m.canEdit).toBe(false);
  });

  it("생산 팀원: 경영지원 데이터에 아무 동작도 못 함", () => {
    const a = receivableAbilities(prod, { isCollected: false, hidden: false });
    expect(a.canEdit || a.canCollect || a.canHide).toBe(false);
    expect(canCreateReceivable(prod)).toBe(false);
    expect(canManageHidden(prod)).toBe(false);
  });

  it("등록은 팀원 이상, 숨긴 항목 관리는 팀장 이상", () => {
    expect(canCreateReceivable(member)).toBe(true);
    expect(canManageHidden(member)).toBe(false);
    expect(canManageHidden(leader)).toBe(true);
  });
});

describe("parseDateOnly", () => {
  it("없는 날짜·형식 오류는 null", () => {
    expect(parseDateOnly("2026-02-30")).toBeNull();
    expect(parseDateOnly("2026-2-3")).toBeNull();
    expect(parseDateOnly("")).toBeNull();
    expect(parseDateOnly("2026-10-16")?.toISOString()).toBe(
      "2026-10-16T00:00:00.000Z",
    );
  });
});

describe("receivableDateErrors", () => {
  it("정상", () => {
    expect(
      receivableDateErrors(
        { occurredOn: "2026-09-01", dueOn: "2026-11-30", collectedOn: TODAY },
        TODAY,
      ),
    ).toEqual({});
  });

  it("발생일: 비었거나 미래면 오류", () => {
    expect(receivableDateErrors({ occurredOn: "" }, TODAY).occurredOn).toBe(
      "발생일을 입력하세요.",
    );
    expect(
      receivableDateErrors({ occurredOn: "2026-10-17" }, TODAY).occurredOn,
    ).toBe("발생일은 오늘 이후로 입력할 수 없습니다.");
  });

  it("수금 예정일: 발생일보다 이르면 오류 (같은 날은 허용)", () => {
    expect(
      receivableDateErrors(
        { occurredOn: "2026-09-01", dueOn: "2026-08-31" },
        TODAY,
      ).dueOn,
    ).toBe("수금 예정일은 발생일보다 이를 수 없습니다.");
    expect(
      receivableDateErrors(
        { occurredOn: "2026-09-01", dueOn: "2026-09-01" },
        TODAY,
      ),
    ).toEqual({});
  });

  it("수금일: 미래 날짜, 발생일보다 이른 날짜, 빈칸은 막는다", () => {
    const err = (collectedOn: string | null) =>
      receivableDateErrors({ occurredOn: "2026-09-01", collectedOn }, TODAY)
        .collectedOn;
    expect(err("2026-10-17")).toBe("미래 날짜로 수금 처리할 수 없습니다.");
    expect(err("2026-08-31")).toBe("수금일은 발생일보다 이를 수 없습니다.");
    expect(err("")).toBe("수금일을 입력하세요.");
    expect(err(null)).toBe("수금일을 입력하세요.");
    expect(err("2026-09-01")).toBeUndefined();
    expect(err(TODAY)).toBeUndefined();
  });
});

describe("목록 필터", () => {
  const rows = [
    // 경과 45일, 예정일 지남
    row({ id: "a", occurredOn: "2026-09-01", dueOn: "2026-10-15" }),
    // 경과 91일 (90일 초과)
    row({ id: "b", customerName: "다라발전(가상)", occurredOn: "2026-07-17" }),
    // 경과 정확히 90일 → 61~90 구간 (초과 아님)
    row({ id: "c", customerName: "다라발전(가상)", occurredOn: "2026-07-18" }),
    // 수금 완료 (오래됐고 예정일이 지났어도 미수가 아님)
    row({
      id: "d",
      customerName: "머버가스(가상)",
      occurredOn: "2026-01-10",
      dueOn: "2026-02-28",
      isCollected: true,
      collectedOn: "2026-03-05",
    }),
    // 예정일이 오늘 = 아직 지나지 않음
    row({ id: "e", customerName: "머버가스(가상)", dueOn: TODAY }),
  ];
  const ids = (list: ReceivableRow[]) => list.map((r) => r.id);

  it("경과일·상태는 오늘 기준", () => {
    expect(rowStatus(rows[0], TODAY)).toEqual({
      ageDays: 45,
      isOver90: false,
      isOverdue: true,
    });
    expect(rowStatus(rows[1], TODAY).isOver90).toBe(true);
    expect(rowStatus(rows[2], TODAY)).toMatchObject({
      ageDays: 90,
      isOver90: false,
    });
    expect(rowStatus(rows[3], TODAY)).toEqual({
      ageDays: null,
      isOver90: false,
      isOverdue: false,
    });
    expect(rowStatus(rows[4], TODAY).isOverdue).toBe(false);
  });

  it("탭별", () => {
    expect(ids(filterReceivables(rows, "open", "", TODAY))).toEqual([
      "a",
      "b",
      "c",
      "e",
    ]);
    expect(ids(filterReceivables(rows, "collected", "", TODAY))).toEqual(["d"]);
    expect(ids(filterReceivables(rows, "over90", "", TODAY))).toEqual(["b"]);
    expect(ids(filterReceivables(rows, "overdue", "", TODAY))).toEqual(["a"]);
    expect(filterReceivables(rows, "all", "", TODAY)).toHaveLength(5);
  });

  it("거래처 검색: 공백·대소문자 무시, 부분 일치 + 탭과 함께", () => {
    expect(ids(filterReceivables(rows, "all", "다라 발전", TODAY))).toEqual([
      "b",
      "c",
    ]);
    expect(ids(filterReceivables(rows, "open", "머버", TODAY))).toEqual(["e"]);
    expect(tabCounts(rows, "머버", TODAY)).toEqual({
      open: 1,
      collected: 1,
      over90: 0,
      overdue: 0,
      all: 2,
    });
  });

  it("주소의 탭 값이 틀리면 '미수'", () => {
    expect(parseReceivableTab("over90")).toBe("over90");
    expect(parseReceivableTab("x")).toBe("open");
    expect(parseReceivableTab(undefined)).toBe("open");
  });
});
