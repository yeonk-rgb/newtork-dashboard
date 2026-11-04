// 납기 캘린더 (서버) — 친구 저장소 DueCalendarView.vue 그대로. 상태는 주소(?year=&month=&date=&order=&find=)
// 같은 납기일 + 같은 수주번호 = 일정 1개, 납기일이 없는 행은 표시하지 않고 개수만. 완료 상태는 자료에 없어 출고일로만 구분
import "server-only";

import Link from "next/link";

import { getCurrentUser } from "@/shared/auth";
import { cn } from "@/shared/lib/utils";
import { Forbidden } from "@/shared/ui/forbidden";
import { buttonCompactClass, pageTitleClass } from "@/shared/ui/styles";
import { getNow } from "@/shared/time/now";

import { NavSelect } from "@/shared/ui/nav-select";
import {
  dueUpcoming,
  eventsOfMonth,
  monthsWithDue,
} from "../metrics/due-calendar";
import { productionAbilities } from "../rules";
import { CalendarBoard } from "./calendar-board";
import { loadCalendarData } from "./load-calendar";

const str = (v: string | string[] | undefined) =>
  typeof v === "string" ? v.trim() : "";
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function calendarHref(
  year: number,
  month: number,
  extra: Record<string, string> = {},
) {
  const q = new URLSearchParams({
    year: String(year),
    month: String(month),
    ...extra,
  });
  return `/production/calendar?${q}`;
}

export async function DueCalendarScreen({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await getCurrentUser();
  if (!productionAbilities(user).canView) return <Forbidden user={user} />;

  const kst = new Date((await getNow()).getTime() + 9 * 3600_000);
  const todayIso = kst.toISOString().slice(0, 10);
  const thisYear = kst.getUTCFullYear();
  const thisMonth = kst.getUTCMonth() + 1;

  const y = Number(str(searchParams.year));
  const m = Number(str(searchParams.month));
  const year = Number.isInteger(y) && y >= 1900 && y <= 2100 ? y : thisYear;
  const month = Number.isInteger(m) && m >= 1 && m <= 12 ? m : thisMonth;
  const target = {
    date: DATE.test(str(searchParams.date)) ? str(searchParams.date) : null,
    order: str(searchParams.order).slice(0, 50) || null,
  };
  const find = str(searchParams.find).slice(0, 50);

  const { events, noDueDate, found } = await loadCalendarData(find);
  const days = Object.fromEntries(eventsOfMonth(events, year, month));
  const months = monthsWithDue(events);
  const monthsOfYear = months.filter((x) => x.year === year);
  const years = [
    ...new Set([...months.map((x) => x.year), thisYear, year]),
  ].sort((a, b) => b - a);
  const prev = month === 1 ? [year - 1, 12] : [year, month - 1];
  const next = month === 12 ? [year + 1, 1] : [year, month + 1];

  return (
    <div className="space-y-4">
      <h1 className={pageTitleClass}>납기 캘린더</h1>

      {/* 상단 도구 */}
      <section className="rounded-card border bg-card">
        <div className="flex flex-wrap items-center gap-2 p-4">
          <div className="flex items-center" role="group" aria-label="월 이동">
            <Link
              href={calendarHref(prev[0], prev[1])}
              aria-label="이전 달"
              className={cn(buttonCompactClass, "rounded-r-none")}
            >
              ◀
            </Link>
            <span
              aria-live="polite"
              className="inline-flex h-8 min-w-32 items-center justify-center border-y px-3 text-sm font-bold"
            >
              {year}년 {month}월
            </span>
            <Link
              href={calendarHref(next[0], next[1])}
              aria-label="다음 달"
              className={cn(buttonCompactClass, "rounded-l-none")}
            >
              ▶
            </Link>
          </div>
          <Link
            href={calendarHref(thisYear, thisMonth)}
            className={buttonCompactClass}
          >
            이번 달
          </Link>
          <NavSelect
            label="연도 선택"
            value={String(year)}
            options={years.map((x) => ({
              value: String(x),
              label: `${x}년`,
              href: calendarHref(x, 1),
            }))}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          />
          <div className="ml-2 flex flex-wrap items-center gap-1">
            <span className="text-xs text-muted-foreground">
              {year}년 납기가 있는 달
            </span>
            {monthsOfYear.length === 0 && (
              <span className="text-xs text-muted-foreground">— 없음</span>
            )}
            {monthsOfYear.map((x) => (
              <Link
                key={x.month}
                href={calendarHref(x.year, x.month)}
                aria-current={x.month === month ? "page" : undefined}
                className={cn(
                  "rounded-md border bg-card px-2 py-0.5 text-xs hover:border-primary hover:text-primary",
                  x.month === month && "border-primary text-primary",
                )}
              >
                {x.month}월 · {x.events}건
              </Link>
            ))}
          </div>
          <form method="get" className="ml-auto flex gap-1">
            <input type="hidden" name="year" value={year} />
            <input type="hidden" name="month" value={month} />
            <input
              name="find"
              defaultValue={find}
              placeholder="수주번호 찾기"
              aria-label="수주번호 찾기"
              className="h-8 w-40 rounded-md border border-input bg-background px-2 text-sm"
            />
            <button type="submit" className={buttonCompactClass}>
              찾기
            </button>
          </form>
        </div>
        {found && (
          <div className="border-t px-4 py-2 text-sm">
            {!found.found ? (
              <span className="text-destructive">
                수주번호 &quot;{find}&quot;에 해당하는 제조내역이 없습니다.
              </span>
            ) : (
              <>
                <strong>수주번호 {find}</strong>의 납기일:
                {found.dates.map((d) => (
                  <Link
                    key={d.due}
                    href={calendarHref(
                      Number(d.due.slice(0, 4)),
                      Number(d.due.slice(5, 7)),
                      { date: d.due, order: find, find },
                    )}
                    className="ml-2 text-primary hover:underline"
                  >
                    {d.due} (일련번호 {d.count}개)
                  </Link>
                ))}
                {found.dates.length === 0 && (
                  <span className="ml-2 text-muted-foreground">없음</span>
                )}
                {found.noDue > 0 && (
                  <span className="ml-2 text-warning-strong">
                    · 납기일 없음 {found.noDue}개(캘린더에 표시되지 않음)
                  </span>
                )}
              </>
            )}
          </div>
        )}
      </section>

      <CalendarBoard
        key={`${year}-${month}-${target.date}-${target.order}`}
        year={year}
        month={month}
        todayIso={todayIso}
        days={days}
        target={target}
        noDueDate={noDueDate}
        upcoming={dueUpcoming(events, todayIso)}
      />
    </div>
  );
}
