import { describe, expect, it } from "vitest";

import {
  dueEvents,
  dueUpcoming,
  eventsOfMonth,
  monthsWithDue,
  orderDueDates,
  type DueRecord,
} from "./due-calendar";

let seq = 0;
const rec = (p: Partial<DueRecord> & { dueDate: string }): DueRecord => ({
  id: `r${++seq}`,
  sheetName: "2026",
  serialNo: String(seq).padStart(4, "0"),
  modelCode: "01",
  bushSize: "",
  rpm: "",
  power: "",
  orderNo: "",
  seller: "가나상사",
  finalClient: "",
  projectName: "",
  shippedDate: null,
  ...p,
});

describe("dueEvents", () => {
  it("같은 납기일 + 같은 수주번호 = 1건, 수주번호 없으면 일련번호 단위", () => {
    const events = dueEvents(
      [
        rec({
          dueDate: "2026-11-10",
          orderNo: "V1",
          shippedDate: "2026-11-09",
        }),
        rec({ dueDate: "2026-11-10", orderNo: "V1" }),
        rec({
          dueDate: "2026-11-12",
          orderNo: "V1",
          shippedDate: "2026-11-01",
        }),
        rec({ dueDate: "2026-11-10" }),
        rec({ dueDate: "2026-11-10" }),
      ],
      new Map([["V1", "WATER"]]),
    );
    expect(events.map((e) => [e.dueDate, e.orderNo, e.records.length])).toEqual(
      [
        ["2026-11-10", "", 1],
        ["2026-11-10", "", 1],
        ["2026-11-10", "V1", 2],
        ["2026-11-12", "V1", 1],
      ],
    );
    expect(events.map((e) => e.shippedStatus)).toEqual([
      "none",
      "none",
      "partial",
      "all",
    ]);
    expect(events[2].category).toBe("WATER");
    expect(events[0].category).toBeNull();
  });
});

describe("eventsOfMonth · monthsWithDue", () => {
  const events = dueEvents(
    [
      rec({ dueDate: "2025-12-31", orderNo: "A" }),
      rec({ dueDate: "2026-01-05", orderNo: "B" }),
      rec({ dueDate: "2026-01-05", orderNo: "C" }),
    ],
    new Map(),
  );
  it("그 달 날짜별로 묶는다", () => {
    const days = eventsOfMonth(events, 2026, 1);
    expect([...days.keys()]).toEqual(["2026-01-05"]);
    expect(days.get("2026-01-05")!.map((e) => e.orderNo)).toEqual(["B", "C"]);
  });
  it("납기가 있는 달과 일정 수", () => {
    expect(monthsWithDue(events)).toEqual([
      { year: 2025, month: 12, events: 1 },
      { year: 2026, month: 1, events: 2 },
    ]);
  });
});

describe("dueUpcoming", () => {
  const events = dueEvents(
    [
      rec({ dueDate: "2026-10-20", orderNo: "OLD" }), // 지난달·미출고 → 지남
      rec({
        dueDate: "2026-10-25",
        orderNo: "DONE",
        shippedDate: "2026-10-24",
      }),
      rec({ dueDate: "2026-11-01", orderNo: "PAST" }), // 이번 달·지남
      rec({
        dueDate: "2026-11-03",
        orderNo: "TODAY",
        shippedDate: "2026-11-02",
      }),
      rec({ dueDate: "2026-11-03", orderNo: "TODAY" }),
      rec({
        dueDate: "2026-11-20",
        orderNo: "SHIP",
        shippedDate: "2026-11-02",
      }),
      rec({ dueDate: "2026-12-01", orderNo: "NEXT" }), // 다음 달 → 제외
    ],
    new Map(),
  );
  const u = dueUpcoming(events, "2026-11-03");

  it("이번 달 요약", () => {
    expect(u.monthSummary).toEqual({
      total: 3,
      shippedAll: 1,
      waiting: 2,
      waitingUpcoming: 1,
      waitingOverdue: 1,
    });
    expect(u.overdueTotal).toBe(2);
  });
  it("지난 것(오래된 순) → 이번 달 남은 것, 남은 날·출고 대기 수", () => {
    expect(
      u.items.map((e) => [
        e.orderNo,
        e.daysLeft,
        e.unshipped,
        e.records.length,
      ]),
    ).toEqual([
      ["OLD", -14, 1, 1],
      ["PAST", -2, 1, 1],
      ["TODAY", 0, 1, 2],
    ]);
  });
});

describe("orderDueDates", () => {
  it("납기일별 일련번호 수와 납기일 없는 수", () => {
    const rows = [
      { orderNo: "V1", dueDate: "2026-11-12" },
      { orderNo: "V1", dueDate: "2026-11-10" },
      { orderNo: "V1", dueDate: "2026-11-10" },
      { orderNo: "V1", dueDate: null },
      { orderNo: "V2", dueDate: "2026-11-10" },
    ];
    expect(orderDueDates(rows, "V1")).toEqual({
      found: true,
      dates: [
        { due: "2026-11-10", count: 2 },
        { due: "2026-11-12", count: 1 },
      ],
      noDue: 1,
    });
    expect(orderDueDates(rows, "X").found).toBe(false);
  });
});
