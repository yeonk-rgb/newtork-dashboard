"use client";
// 납기 캘린더 달력·범례·출고 대기 표·일정 상세 창 — 친구 저장소 DueCalendarView.vue 그대로
// 일정 이름 = "SO#" + 수주번호(엑셀 J열 뉴토크 번호) + 거래처. 다른 화면에서 ?date=&order= 로 들어오면 그 일정을 바로 연다
import Link from "next/link";
import { useId, useState } from "react";

import { cn } from "@/shared/lib/utils";
import { Modal } from "@/shared/ui/modal";
import { buttonSecondaryClass, cardTitleClass } from "@/shared/ui/styles";

import { INDUSTRY_LABEL, UNCLASSIFIED_LABEL, formatBush } from "../labels";
import type {
  DueEvent,
  DueUpcoming,
  ShippedStatus,
} from "../metrics/due-calendar";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const MAX_PER_DAY = 3;
const STATUS: Record<ShippedStatus, { icon: string; label: string }> = {
  all: { icon: "✓", label: "모두 출고" },
  partial: { icon: "◐", label: "일부 출고" },
  none: { icon: "○", label: "미출고" },
};
/** 일정 칩 색 — 미출고 네이비, 일부 출고 코퍼, 모두 출고 회색 (design-guide 팔레트) */
const CHIP: Record<ShippedStatus, string> = {
  none: "bg-primary-50 border-l-primary-700",
  partial: "bg-copper-50 border-l-copper-500",
  all: "bg-muted border-l-muted-foreground/50 text-muted-foreground",
};
const OVERDUE_CHIP =
  "border-danger-strong border-l-danger-strong [border-style:solid_dashed_dashed_solid]";

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <div className="mt-4 flex justify-end">
      <button type="button" onClick={onClose} className={buttonSecondaryClass}>
        닫기
      </button>
    </div>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");
const weekday = (iso: string) =>
  WEEKDAYS[new Date(`${iso}T00:00:00Z`).getUTCDay()];
const titleOf = (e: DueEvent) =>
  e.orderNo ? `SO#${e.orderNo}` : `일련번호 ${e.records[0].serialNo}`;
const sellerOf = (e: DueEvent) => e.seller || "(거래처 없음)";
const urgency = (d: number) =>
  d < 0
    ? "bg-danger-soft text-danger-strong"
    : d <= 3
      ? "bg-copper-50 text-copper-700"
      : d <= 7
        ? "bg-warning-soft text-warning-strong"
        : "bg-muted text-muted-foreground";
const dday = (d: number) =>
  d < 0 ? `${-d}일 지남` : d === 0 ? "오늘" : `D-${d}`;

function TodayTag() {
  return (
    <span className="ml-1 rounded bg-primary px-1 align-[1px] text-[0.68rem] text-primary-foreground">
      오늘
    </span>
  );
}

export function CalendarBoard({
  year,
  month,
  todayIso,
  days,
  target,
  noDueDate,
  upcoming,
}: {
  year: number;
  month: number;
  todayIso: string;
  days: Record<string, DueEvent[]>;
  target: { date: string | null; order: string | null };
  noDueDate: number;
  upcoming: DueUpcoming;
}) {
  const titleId = useId();
  const isTarget = (e: DueEvent) =>
    target.date === e.dueDate && (!target.order || target.order === e.orderNo);
  const [selected, setSelected] = useState<DueEvent | null>(
    () =>
      (target.date && (days[target.date] ?? []).find((e) => isTarget(e))) ||
      null,
  );
  const [dayList, setDayList] = useState<string | null>(null);

  // 납기일이 오늘 이전인데 출고일이 없는 일련번호가 있는 일정 (완료 여부를 뜻하지 않음)
  const isOverdue = (e: DueEvent) =>
    e.dueDate < todayIso && e.shippedStatus !== "all";

  const firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: ({ day: number; iso: string; events: DueEvent[] } | null)[] = [
    ...Array<null>(firstWeekday).fill(null),
  ];
  for (let d = 1; d <= lastDay; d++) {
    const iso = `${year}-${pad(month)}-${pad(d)}`;
    cells.push({ day: d, iso, events: days[iso] ?? [] });
  }
  while (cells.length % 7) cells.push(null);
  const withEvents = cells.filter((c) => c && c.events.length > 0) as {
    day: number;
    iso: string;
    events: DueEvent[];
  }[];
  const eventCount = withEvents.reduce((n, c) => n + c.events.length, 0);

  const chip = (e: DueEvent, extra?: React.ReactNode, wide?: boolean) => (
    <button
      key={titleOf(e)}
      type="button"
      onClick={() => {
        setDayList(null);
        setSelected(e);
      }}
      title={`${titleOf(e)} ${sellerOf(e)} · 제품 ${e.records.length}개 · ${STATUS[e.shippedStatus].label}${isOverdue(e) ? " · 납기 경과" : ""}`}
      className={cn(
        "flex w-full flex-wrap items-baseline gap-x-1.5 rounded-md border border-l-[3px] border-transparent px-1.5 py-0.5 text-left text-[0.78rem] leading-snug hover:brightness-95",
        CHIP[e.shippedStatus],
        isOverdue(e) && OVERDUE_CHIP,
        isTarget(e) && "ring-2 ring-primary/40",
        wide && "mb-1",
      )}
    >
      <span className="font-bold">{titleOf(e)}</span>
      <span className="max-w-full truncate">{sellerOf(e)}</span>
      {extra}
    </button>
  );

  const dayEvents = dayList ? (days[dayList] ?? []) : [];

  return (
    <>
      <section>
        <p className="mb-2 text-sm text-muted-foreground">
          {year}년 {month}월 납기 일정{" "}
          <strong className="text-foreground">{eventCount}건</strong> (납기일자
          기준)
          {eventCount === 0 &&
            " — 이 달에는 납기일이 있는 제조내역이 없습니다."}
        </p>

        {/* 월 달력 (데스크톱) */}
        <div
          role="grid"
          aria-label={`${year}년 ${month}월 납기 캘린더`}
          className="hidden grid-cols-7 gap-px overflow-hidden rounded-card border bg-border md:grid"
        >
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              role="columnheader"
              className={cn(
                "bg-muted py-1.5 text-center text-xs font-semibold text-muted-foreground",
                i === 0 && "text-danger-strong",
                i === 6 && "text-primary-800",
              )}
            >
              {w}
            </div>
          ))}
          {cells.map((c, i) => (
            <div
              key={i}
              role="gridcell"
              className={cn(
                "flex min-h-29 min-w-0 flex-col gap-1 p-1.5",
                c ? "bg-card" : "bg-muted/60",
                c?.iso === todayIso &&
                  "shadow-[inset_0_0_0_2px_var(--color-primary)]",
              )}
            >
              {c && (
                <>
                  <div
                    className={cn(
                      "text-sm font-semibold",
                      i % 7 === 0 && "text-danger-strong",
                      i % 7 === 6 && "text-primary-800",
                    )}
                  >
                    {c.day}
                    {c.iso === todayIso && <TodayTag />}
                  </div>
                  {c.events.slice(0, MAX_PER_DAY).map((e) => chip(e))}
                  {c.events.length > MAX_PER_DAY && (
                    <button
                      type="button"
                      onClick={() => setDayList(c.iso)}
                      className="px-0.5 text-left text-xs text-primary hover:underline"
                    >
                      +{c.events.length - MAX_PER_DAY}건 더 보기
                    </button>
                  )}
                </>
              )}
            </div>
          ))}
        </div>

        {/* 날짜별 목록 (모바일) */}
        <div className="space-y-2 md:hidden">
          {withEvents.length === 0 && (
            <p className="rounded-card border bg-card p-4 text-sm text-muted-foreground">
              표시할 납기 일정이 없습니다.
            </p>
          )}
          {withEvents.map((c) => (
            <div key={c.iso} className="rounded-card border bg-card px-4 py-2">
              <div className="mb-1 text-sm font-bold">
                {c.iso} ({weekday(c.iso)})
              </div>
              {c.events.map((e) =>
                chip(
                  e,
                  isOverdue(e) && (
                    <span className="text-[0.72rem] font-semibold text-danger-strong">
                      납기 경과
                    </span>
                  ),
                  true,
                ),
              )}
            </div>
          ))}
        </div>

        {/* 범례·안내 */}
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {(Object.keys(STATUS) as ShippedStatus[]).map((k) => (
            <span key={k} className="inline-flex items-center gap-1">
              <span
                className={cn(
                  "inline-block h-4 w-5 rounded border border-l-[3px] border-transparent",
                  CHIP[k],
                )}
              />
              {STATUS[k].label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1">
            <span
              className={cn(
                "inline-block h-4 w-5 rounded border border-l-[3px]",
                CHIP.none,
                OVERDUE_CHIP,
              )}
            />
            납기 경과 · 출고일 없는 제품 있음
          </span>
          <span>
            · 일정 1건 = 같은 납기일의 같은 수주번호(SO# = 엑셀 J열 뉴토크
            번호). 완료 여부는 자료에 없어 출고일로만 구분합니다.
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          ⓘ 납기일 없음 {noDueDate}건은 캘린더에 표시하지 않습니다.
        </p>
      </section>

      {/* 오늘 기준 출고 대기 */}
      <section
        aria-labelledby={`${titleId}-upcoming`}
        className="mt-6 rounded-card border bg-card"
      >
        <div className="px-6 pt-5 pb-3">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 id={`${titleId}-upcoming`} className={cardTitleClass}>
              출고 대기 일정 (급한 순)
            </h2>
            <span className="text-xs text-muted-foreground">
              오늘 {upcoming.today} 기준
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                [
                  `${upcoming.month}월 납기 일정`,
                  upcoming.monthSummary.total,
                  "",
                ],
                ["모두 출고", upcoming.monthSummary.shippedAll, ""],
                [
                  "이번 달 남은 출고 대기",
                  upcoming.monthSummary.waitingUpcoming,
                  "border-primary-200 bg-primary-50 [&_strong]:text-primary",
                ],
                [
                  "납기 지남 · 출고일 없음",
                  upcoming.overdueTotal,
                  upcoming.overdueTotal
                    ? "border-danger-strong/30 bg-danger-soft [&_strong]:text-danger-strong"
                    : "",
                ],
              ] as const
            ).map(([label, value, tone]) => (
              <div
                key={label}
                className={cn(
                  "flex min-w-32 flex-col rounded-lg border bg-muted/40 px-3 py-1.5",
                  tone,
                )}
              >
                <span className="text-xs text-muted-foreground">{label}</span>
                <strong className="text-lg tabular-nums">{value}건</strong>
              </div>
            ))}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-y bg-muted text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">납기일</th>
                <th className="px-3 py-2 font-medium">남은 기간</th>
                <th className="px-3 py-2 font-medium">수주번호 · 거래처</th>
                <th className="px-3 py-2 text-right font-medium">
                  출고 대기 제품
                </th>
                <th className="px-3 py-2 font-medium">출고 상태</th>
              </tr>
            </thead>
            <tbody>
              {upcoming.items.map((e) => (
                <tr
                  key={`${e.dueDate}-${titleOf(e)}`}
                  tabIndex={0}
                  onClick={() => setSelected(e)}
                  onKeyDown={(k) => k.key === "Enter" && setSelected(e)}
                  className="cursor-pointer border-b last:border-0 hover:bg-primary-50"
                >
                  <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                    {e.dueDate} ({weekday(e.dueDate)})
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={cn(
                        "inline-block min-w-14 rounded-full px-2 py-px text-center text-xs font-bold",
                        urgency(e.daysLeft),
                      )}
                    >
                      {dday(e.daysLeft)}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <strong>{titleOf(e)}</strong> {sellerOf(e)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {e.unshipped} / {e.records.length}개
                  </td>
                  <td className="px-3 py-2 text-xs">
                    {STATUS[e.shippedStatus].label}
                  </td>
                </tr>
              ))}
              {upcoming.items.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-4 text-center text-xs text-muted-foreground"
                  >
                    이번 달 남은 출고 대기 일정이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="px-6 py-3 text-xs text-muted-foreground">
          출고 대기 = 출고일이 아직 기록되지 않은 제품이 있는 일정입니다(완료
          여부 자료가 없어 출고일로 판단). 출고하면 제조내역에 출고일을
          입력하세요. 행을 누르면 상세를 봅니다.
        </p>
      </section>

      {/* 일정 상세 */}
      {selected && (
        <Modal
          open
          onClose={() => setSelected(null)}
          title={`납기 일정 · ${titleOf(selected)} ${selected.seller}`}
          titleId={`${titleId}-detail`}
          wide
        >
          <div className="max-h-[70vh] space-y-4 overflow-y-auto">
            {isOverdue(selected) && (
              <p className="rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-strong">
                납기일({selected.dueDate})이 지났고 출고일이 기록되지 않은
                제품이 있습니다. 실제 출고 여부는 제조내역에서 확인하세요.
              </p>
            )}
            <dl className="grid grid-cols-[6rem_1fr] gap-y-1.5 text-sm">
              {(
                [
                  [
                    "수주번호",
                    <>
                      {selected.orderNo ? `SO#${selected.orderNo}` : "-"}{" "}
                      <span className="text-xs text-muted-foreground">
                        (엑셀 J열 뉴토크 번호)
                      </span>
                    </>,
                  ],
                  [
                    "납기일자",
                    <>
                      {selected.dueDate}
                      {selected.dueDate === todayIso && <TodayTag />}
                    </>,
                  ],
                  ["거래처", selected.seller || "-"],
                  ["최종발주처", selected.finalClient || "-"],
                  ["사업명", selected.projectName || "-"],
                  [
                    "사업구분",
                    selected.category
                      ? INDUSTRY_LABEL[selected.category]
                      : UNCLASSIFIED_LABEL,
                  ],
                  [
                    "출고 상태",
                    `${STATUS[selected.shippedStatus].icon} ${STATUS[selected.shippedStatus].label}`,
                  ],
                ] as [string, React.ReactNode][]
              ).map(([dt, dd]) => (
                <div key={dt} className="contents">
                  <dt className="text-muted-foreground">{dt}</dt>
                  <dd>{dd}</dd>
                </div>
              ))}
            </dl>
            <h3 className="text-sm font-bold">
              제품 {selected.records.length}개
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted text-left text-xs text-muted-foreground">
                    {[
                      "일련번호",
                      "모델명",
                      "rpm",
                      "전원",
                      "부시 가공",
                      "출고일자",
                      "",
                    ].map((h, i) => (
                      <th key={i} className="px-2 py-1.5 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selected.records.map((r) => (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="px-2 py-1.5 font-semibold">
                        {r.serialNo}
                      </td>
                      <td className="px-2 py-1.5">{r.modelCode || "-"}</td>
                      <td className="px-2 py-1.5">{r.rpm || "-"}</td>
                      <td className="px-2 py-1.5">{r.power || "-"}</td>
                      <td className="px-2 py-1.5">
                        {formatBush(r.bushSize) || "-"}
                      </td>
                      <td className="px-2 py-1.5 tabular-nums">
                        {r.shippedDate || (
                          <span className="rounded-full bg-warning-soft px-2 py-px text-xs text-warning-strong">
                            출고일 없음
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <Link
                          href={`/production/search?id=${r.id}`}
                          className="text-xs text-primary hover:underline"
                        >
                          상세 보기 →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <CloseButton onClose={() => setSelected(null)} />
        </Modal>
      )}

      {/* "+N건": 그 날짜의 전체 일정 */}
      {dayList && (
        <Modal
          open
          onClose={() => setDayList(null)}
          title={`${dayList} 납기 일정 ${dayEvents.length}건`}
          titleId={`${titleId}-day`}
        >
          <div className="max-h-[70vh] overflow-y-auto">
            {dayEvents.map((e) =>
              chip(
                e,
                <span className="text-[0.72rem] text-muted-foreground">
                  제품 {e.records.length}개 · {STATUS[e.shippedStatus].label}
                </span>,
                true,
              ),
            )}
          </div>
          <CloseButton onClose={() => setDayList(null)} />
        </Modal>
      )}
    </>
  );
}
