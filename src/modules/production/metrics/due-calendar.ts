// 납기 캘린더 계산 (순수 함수). 친구 저장소 backend/production/views.py _due_events·DueUpcomingView·DueCalendarView 그대로:
// - 납기 일정 = 납기일자(P열) 기준, 같은 납기일 + 같은 수주번호 = 1건 (수주번호 없으면 시트 + 일련번호 단위)
// - 출고 상태 = 일정 안 일련번호의 출고일 유무만: all(모두 출고) / partial(일부) / none(미출고). 완료 여부는 자료에 없음
// - 출고 대기 = 출고일이 없는 제품이 있는 일정. 오늘 기준 이번 달 남은 일정 + 날짜와 상관없이 납기가 지난 일정
// 날짜는 "YYYY-MM-DD" 글자로 비교한다 (DB 날짜 칸 = UTC 자정)
export type DueRecord = {
  id: string;
  sheetName: string;
  serialNo: string;
  modelCode: string;
  bushSize: string;
  rpm: string;
  power: string;
  orderNo: string;
  seller: string;
  finalClient: string;
  projectName: string;
  /** "YYYY-MM-DD" */
  dueDate: string;
  shippedDate: string | null;
};

export type ShippedStatus = "all" | "partial" | "none";

export type DueEvent = {
  orderNo: string;
  dueDate: string;
  seller: string;
  finalClient: string;
  projectName: string;
  /** 사업구분 코드, 미분류 null */
  category: string | null;
  shippedStatus: ShippedStatus;
  records: Pick<
    DueRecord,
    | "id"
    | "serialNo"
    | "sheetName"
    | "modelCode"
    | "bushSize"
    | "rpm"
    | "power"
    | "shippedDate"
  >[];
};

export type UpcomingItem = DueEvent & {
  /** 납기일 − 오늘 (음수 = 지남) */
  daysLeft: number;
  /** 출고일 없는 제품 수 */
  unshipped: number;
};

export type DueUpcoming = {
  today: string;
  year: number;
  month: number;
  monthSummary: {
    total: number;
    shippedAll: number;
    waiting: number;
    waitingUpcoming: number;
    waitingOverdue: number;
  };
  overdueTotal: number;
  /** 납기 지난 출고 대기(오래된 순) → 이번 달 남은 출고 대기 */
  items: UpcomingItem[];
};

export const eventKey = (
  r: Pick<DueRecord, "dueDate" | "orderNo" | "sheetName" | "serialNo">,
) => `${r.dueDate}|${r.orderNo || `#${r.sheetName}::${r.serialNo}`}`;

function shippedStatus(rows: DueRecord[]): ShippedStatus {
  const shipped = rows.filter((r) => r.shippedDate).length;
  if (shipped === rows.length) return "all";
  return shipped === 0 ? "none" : "partial";
}

// 파이썬 order_by('due_date', 'order_no', 'serial_no') 와 같은 순서 (글자 코드 순)
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** 제조내역 → 납기 일정 목록 (납기일·수주번호 순) */
export function dueEvents(
  rows: DueRecord[],
  categories: Map<string, string>,
): DueEvent[] {
  const sorted = [...rows].sort(
    (a, b) =>
      cmp(a.dueDate, b.dueDate) ||
      cmp(a.orderNo, b.orderNo) ||
      cmp(a.serialNo, b.serialNo),
  );
  const groups = new Map<string, DueRecord[]>();
  for (const r of sorted) {
    const k = eventKey(r);
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  return [...groups.values()].map((rs) => {
    const head = rs[0];
    return {
      orderNo: head.orderNo,
      dueDate: head.dueDate,
      seller: head.seller,
      finalClient: head.finalClient,
      projectName: head.projectName,
      category: (head.orderNo && categories.get(head.orderNo)) || null,
      shippedStatus: shippedStatus(rs),
      records: rs.map((r) => ({
        id: r.id,
        serialNo: r.serialNo,
        sheetName: r.sheetName,
        modelCode: r.modelCode,
        bushSize: r.bushSize,
        rpm: r.rpm,
        power: r.power,
        shippedDate: r.shippedDate,
      })),
    };
  });
}

const pad = (n: number) => String(n).padStart(2, "0");
export const monthPrefix = (year: number, month: number) =>
  `${year}-${pad(month)}-`;

/** 그 달 날짜별 일정 ("YYYY-MM-DD" → 일정 목록) */
export function eventsOfMonth(events: DueEvent[], year: number, month: number) {
  const prefix = monthPrefix(year, month);
  const days = new Map<string, DueEvent[]>();
  for (const e of events) {
    if (!e.dueDate.startsWith(prefix)) continue;
    days.set(e.dueDate, [...(days.get(e.dueDate) ?? []), e]);
  }
  return days;
}

/** 납기가 있는 달 목록 (오래된 달부터) */
export function monthsWithDue(events: DueEvent[]) {
  const count = new Map<string, number>();
  for (const e of events) {
    const ym = e.dueDate.slice(0, 7);
    count.set(ym, (count.get(ym) ?? 0) + 1);
  }
  return [...count]
    .sort(([a], [b]) => cmp(a, b))
    .map(([ym, events]) => ({
      year: Number(ym.slice(0, 4)),
      month: Number(ym.slice(5, 7)),
      events,
    }));
}

const dayNumber = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / 86_400_000;
const waiting = (e: DueEvent) => e.shippedStatus !== "all";

/** 오늘("YYYY-MM-DD") 기준 출고 대기 일정 (급한 순) */
export function dueUpcoming(events: DueEvent[], today: string): DueUpcoming {
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7));
  const prefix = monthPrefix(year, month);
  const monthEvents = events.filter((e) => e.dueDate.startsWith(prefix));
  const overdue = events.filter((e) => e.dueDate < today && waiting(e));
  const upcoming = monthEvents.filter((e) => e.dueDate >= today && waiting(e));
  return {
    today,
    year,
    month,
    monthSummary: {
      total: monthEvents.length,
      shippedAll: monthEvents.filter((e) => !waiting(e)).length,
      waiting: monthEvents.filter(waiting).length,
      waitingUpcoming: upcoming.length,
      waitingOverdue: monthEvents.filter((e) => waiting(e) && e.dueDate < today)
        .length,
    },
    overdueTotal: overdue.length,
    items: [...overdue, ...upcoming].map((e) => ({
      ...e,
      daysLeft: dayNumber(e.dueDate) - dayNumber(today),
      unshipped: e.records.filter((r) => !r.shippedDate).length,
    })),
  };
}

/** 수주번호 찾기 — 그 수주번호의 납기일별 일련번호 수 + 납기일 없는 수 (친구 앱 findOrder) */
export function orderDueDates(
  rows: { orderNo: string; dueDate: string | null }[],
  orderNo: string,
) {
  const byDate = new Map<string, number>();
  let noDue = 0;
  for (const r of rows) {
    if (r.orderNo !== orderNo) continue;
    if (r.dueDate) byDate.set(r.dueDate, (byDate.get(r.dueDate) ?? 0) + 1);
    else noDue++;
  }
  return {
    found: byDate.size + noDue > 0,
    dates: [...byDate]
      .sort(([a], [b]) => cmp(a, b))
      .map(([due, count]) => ({ due, count })),
    noDue,
  };
}
