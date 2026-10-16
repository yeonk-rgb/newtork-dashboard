// 월간 실적 입력 화면 (서버): 권한 확인 → ?month= 해석 → 데이터 → 폼
import "server-only";

import { can, getCurrentUser } from "@/shared/auth";
import { monthIndex, type YearMonth } from "@/shared/period/period";
import { Forbidden } from "@/shared/ui/forbidden";

import { getTodayKst } from "../data/load-summary-input";
import { loadYearRange } from "../data/queries";
import { EntryForm } from "./entry-form";
import { loadEntry } from "./load-entry";
import { defaultEntryMonth, entryAbilities, monthState } from "./rules";

/** "2026-09" → {2026, 9}. 형식이 틀리면 null */
export function parseMonthParam(value: string | undefined): YearMonth | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value ?? "");
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12) return null;
  return { year, month };
}

export async function EntryScreen({
  monthParam,
}: {
  monthParam: string | undefined;
}) {
  const user = await getCurrentUser();
  if (!user || !can(user, "view", "management"))
    return <Forbidden user={user} />;

  const today = await getTodayKst();
  const ym = parseMonthParam(monthParam) ?? defaultEntryMonth(today);
  const state = monthState(ym, today);
  const thisMonth = {
    year: today.getUTCFullYear(),
    month: today.getUTCMonth() + 1,
  };

  if (state === "future") {
    return (
      <p className="rounded-md border bg-card px-4 py-6 text-center text-sm">
        미래 달({ym.year}년 {ym.month}월)은 입력할 수 없습니다.{" "}
        <a className="text-primary underline" href="/management/entry">
          지난달 입력으로 이동
        </a>
      </p>
    );
  }

  const [data, range] = await Promise.all([
    loadEntry(ym),
    loadYearRange(thisMonth.year),
  ]);
  const years = [...new Set([...range, ym.year])].sort();

  return (
    <EntryForm
      key={`${ym.year}-${ym.month}`}
      userId={user.id}
      data={data}
      abilities={entryAbilities(user, data.status, state)}
      years={years}
      maxMonthIndex={monthIndex(thisMonth)}
    />
  );
}
