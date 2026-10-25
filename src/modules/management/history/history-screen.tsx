// 변경 이력 화면 (서버) — 관리자(대표) + 경영지원팀. 관리자 화면 기록은 관리자(대표)만 (조회 조건에서 거름)
// 필터는 주소(GET 폼)로: 기간(기본 최근 30일)·사람·화면·동작·대상 검색, 최신순 50건씩
import "server-only";

import Link from "next/link";

import { getCurrentUser } from "@/shared/auth";
import { Forbidden } from "@/shared/ui/forbidden";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  labelClass,
  pageTitleClass,
} from "@/shared/ui/styles";
import { AUDIT_ACTION_LABEL, AUDIT_ACTIONS } from "@/shared/audit/types";

import { getTodayKst } from "../data/load-summary-input";
import { HistoryExportButton } from "./export-button";
import { loadHistoryPage } from "./load-history";
import {
  HISTORY_PAGE_SIZE,
  historyAbilities,
  historySearch,
  parseHistoryFilter,
  screenOptions,
} from "./rules";

// receivables/modal.tsx 의 fieldClass 와 같은 모양 (그 파일은 "use client" 라 서버 컴포넌트에서 상수를 가져오지 않는다)
const fieldClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export async function HistoryScreen({
  params,
}: {
  params: Record<string, string | string[] | undefined>;
}) {
  const user = await getCurrentUser();
  const abilities = user ? historyAbilities(user) : null;
  if (!user || !abilities?.canView) return <Forbidden user={user} />;

  // getTodayKst()(connection)를 DB 조회보다 먼저 — prerender 에러 방지
  const today = await getTodayKst();
  const filter = parseHistoryFilter(params, today);
  const data = await loadHistoryPage(filter, abilities);
  const search = historySearch(filter);
  const pageHref = (page: number) =>
    `/management/history?${historySearch({ ...filter, page })}`;
  const first = (data.page - 1) * HISTORY_PAGE_SIZE + 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className={pageTitleClass}>변경 이력</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            누가 언제 무엇을 바꿨는지 남긴 기록입니다 (2026-10-25부터). 기록은
            고치거나 지울 수 없습니다.
            {abilities.canSeeAdmin
              ? " 관리자(대표) 화면 기록도 함께 보입니다."
              : " 관리자(대표) 화면 기록은 관리자(대표)만 볼 수 있습니다."}
          </p>
        </div>
        {abilities.canExport && <HistoryExportButton search={search} />}
      </div>

      <form
        action="/management/history"
        className="grid gap-3 rounded-card border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[auto_auto_1fr_1fr_1fr_1.5fr_auto]"
      >
        <label className="space-y-1">
          <span className={labelClass}>시작일</span>
          <input
            type="date"
            name="from"
            defaultValue={filter.from}
            className={fieldClass}
          />
        </label>
        <label className="space-y-1">
          <span className={labelClass}>종료일</span>
          <input
            type="date"
            name="to"
            defaultValue={filter.to}
            className={fieldClass}
          />
        </label>
        <label className="space-y-1">
          <span className={labelClass}>사람</span>
          <select
            name="actor"
            defaultValue={filter.actorId ?? ""}
            className={fieldClass}
          >
            <option value="">전체</option>
            {data.actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className={labelClass}>화면</span>
          <select
            name="screen"
            defaultValue={filter.screen ?? ""}
            className={fieldClass}
          >
            <option value="">전체</option>
            {screenOptions(abilities).map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className={labelClass}>동작</span>
          <select
            name="action"
            defaultValue={filter.action ?? ""}
            className={fieldClass}
          >
            <option value="">전체</option>
            {AUDIT_ACTIONS.map((a) => (
              <option key={a} value={a}>
                {AUDIT_ACTION_LABEL[a]}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1">
          <span className={labelClass}>대상 검색</span>
          <input
            type="search"
            name="q"
            defaultValue={filter.q ?? ""}
            placeholder="거래처명, 2026-10 등"
            className={fieldClass}
          />
        </label>
        <div className="flex items-end gap-2">
          <button type="submit" className={buttonPrimaryClass}>
            조회
          </button>
          <Link href="/management/history" className={buttonSecondaryClass}>
            초기화
          </Link>
        </div>
      </form>

      <section className="rounded-card border bg-card">
        <p className="px-4 py-3 text-xs text-muted-foreground">
          {filter.from} ~ {filter.to} · {data.total.toLocaleString("ko-KR")}건
          {data.total > 0 &&
            ` · ${first.toLocaleString("ko-KR")}–${(first + data.rows.length - 1).toLocaleString("ko-KR")}번째`}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm [&_td]:px-3 [&_th]:px-3">
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="py-3 text-left font-medium">일시</th>
                <th className="py-3 text-left font-medium">사람</th>
                <th className="py-3 text-left font-medium">화면</th>
                <th className="py-3 text-left font-medium">동작</th>
                <th className="py-3 text-left font-medium">대상</th>
                <th className="py-3 text-left font-medium">바뀐 내용</th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="py-10 text-center text-muted-foreground"
                  >
                    조건에 맞는 기록이 없습니다.
                  </td>
                </tr>
              ) : (
                data.rows.map((r) => (
                  <tr key={r.id} className="border-b align-top last:border-0">
                    <td className="py-3 whitespace-nowrap tabular-nums">
                      {r.occurredAt}
                    </td>
                    <td className="py-3 whitespace-nowrap">
                      {r.actorName ?? r.actorLoginId}
                      {r.actorName && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          {r.actorLoginId}
                        </span>
                      )}
                    </td>
                    <td className="py-3 whitespace-nowrap">{r.screen}</td>
                    <td className="py-3 whitespace-nowrap">{r.action}</td>
                    <td className="max-w-64 py-3 break-keep">{r.target}</td>
                    <td className="py-3 text-xs">
                      {r.lines.length === 0 ? (
                        <span className="text-muted-foreground">-</span>
                      ) : (
                        <ul className="space-y-0.5">
                          {r.lines.map((line, i) => (
                            <li key={i}>{line}</li>
                          ))}
                        </ul>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {data.pageCount > 1 && (
          <nav
            aria-label="쪽 이동"
            className="flex items-center justify-center gap-3 border-t px-4 py-3 text-sm"
          >
            {data.page > 1 ? (
              <Link href={pageHref(data.page - 1)} className="text-primary">
                ← 이전
              </Link>
            ) : (
              <span className="text-muted-foreground">← 이전</span>
            )}
            <span className="tabular-nums">
              {data.page} / {data.pageCount}
            </span>
            {data.page < data.pageCount ? (
              <Link href={pageHref(data.page + 1)} className="text-primary">
                다음 →
              </Link>
            ) : (
              <span className="text-muted-foreground">다음 →</span>
            )}
          </nav>
        )}
      </section>
    </div>
  );
}
