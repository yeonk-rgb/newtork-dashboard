// 출장보고서 목록 (서버) — 친구 저장소 ServiceReportsView.vue 그대로. 필터는 주소(GET 폼), 50건씩, 행을 누르면 상세
// 대시보드 지도·순위에서 들어오면 시·군·구·모델·출장일 없음 필터가 주소로 붙고, 위에 "필터: … ✕" 로 보인다
import "server-only";

import Link from "next/link";

import { getCurrentUser } from "@/shared/auth";
import { cn } from "@/shared/lib/utils";
import { AuditNotice } from "@/shared/ui/audit-notice";
import { Forbidden } from "@/shared/ui/forbidden";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  labelClass,
  pageTitleClass,
  pillClass,
} from "@/shared/ui/styles";

import { BILLING_LABEL } from "../labels";
import { ReadOnlyBadge } from "../read-only-badge";
import { SIDO, regionLabel } from "../regions/regions";
import { serviceAbilities } from "../rules";
import { loadNames } from "./load-reports";
import {
  PAGE_SIZE,
  loadReportPage,
  parseReportFilter,
  reportSearch,
  type ReportFilter,
} from "./load-reports";
import { RowLink } from "./row-link";

const inputClass =
  "h-9 rounded-lg border border-input bg-background px-3 text-sm";
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export const billingPill = (billing: string | null) =>
  billing ? (
    <span
      className={cn(
        pillClass,
        billing === "PAID"
          ? "bg-primary-50 text-primary-800"
          : "bg-copper-50 text-copper-700",
      )}
    >
      {BILLING_LABEL[billing]}
    </span>
  ) : (
    <span className="text-xs text-muted-foreground">미입력</span>
  );

/** 대시보드에서 넘어온 필터 (목록 위 필터 칸에 없는 것) */
function extraFilters(f: ReportFilter) {
  const out: { label: string; without: Partial<ReportFilter> }[] = [];
  if (f.sigungu) {
    out.push({
      label:
        f.sigungu === "none"
          ? `지역: ${f.region}(시·군·구 미확인)`
          : `지역: ${regionLabel(f.region || null, f.sigungu)}`,
      without: { sigungu: "" },
    });
  }
  if (f.model) out.push({ label: `모델: ${f.model}`, without: { model: "" } });
  if (f.tripDate)
    out.push({ label: "출장 시작일 없음", without: { tripDate: "" } });
  return out;
}

export async function ReportsScreen({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await getCurrentUser();
  const abilities = serviceAbilities(user);
  if (!abilities.canView) return <Forbidden user={user} />;

  const f = parseReportFilter(searchParams);
  const [{ total, rows }, names] = await Promise.all([
    loadReportPage(f),
    loadNames(),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const extras = extraFilters(f);
  const anyFilter = Boolean(
    f.q || f.from || f.to || f.billing || f.region || f.person || extras.length,
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className={`${pageTitleClass} flex flex-wrap items-center gap-3`}>
          출장보고서{f.hidden ? " — 숨긴 보고서" : ""}
          {!abilities.canEdit && (
            <ReadOnlyBadge note="입력·수정은 팀장만 할 수 있습니다" />
          )}
        </h1>
        <AuditNotice />
      </div>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-card border bg-card p-5"
      >
        {f.hidden && <input type="hidden" name="hidden" value="1" />}
        {f.sigungu && <input type="hidden" name="sigungu" value={f.sigungu} />}
        {f.model && <input type="hidden" name="model" value={f.model} />}
        {f.tripDate && (
          <input type="hidden" name="trip_date" value={f.tripDate} />
        )}
        <label className="flex min-w-60 flex-1 flex-col gap-1">
          <span className={labelClass}>검색</span>
          <input
            name="q"
            defaultValue={f.q}
            placeholder="출장 목적, 요청처, 주소, 담당자, 모델명, 일련번호"
            className={inputClass}
          />
        </label>
        <fieldset className="flex flex-col gap-1">
          <legend className={labelClass}>출장 시작일</legend>
          <div className="flex items-center gap-1">
            <input
              type="date"
              name="from"
              defaultValue={f.from}
              aria-label="출장 시작일 부터"
              className={inputClass}
            />
            <span aria-hidden className="text-muted-foreground">
              ~
            </span>
            <input
              type="date"
              name="to"
              defaultValue={f.to}
              aria-label="출장 시작일 까지"
              className={inputClass}
            />
          </div>
        </fieldset>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>유·무상</span>
          <select
            name="billing"
            defaultValue={f.billing}
            className={inputClass}
          >
            <option value="">전체</option>
            <option value="PAID">유상</option>
            <option value="FREE">무상</option>
            <option value="none">미입력</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>지역</span>
          <select name="region" defaultValue={f.region} className={inputClass}>
            <option value="">전체</option>
            <option value="none">미지정</option>
            {SIDO.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className={labelClass}>담당자</span>
          <input
            name="person"
            list="sf-people"
            defaultValue={f.person}
            placeholder="작성자·동행자"
            className={`${inputClass} w-32`}
          />
          <datalist id="sf-people">
            {names.people.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
        </label>
        <div className="flex gap-1">
          <button type="submit" className={buttonPrimaryClass}>
            조회
          </button>
          <Link
            href={f.hidden ? "?hidden=1" : "?"}
            className={buttonSecondaryClass}
          >
            초기화
          </Link>
        </div>
      </form>

      <section className="rounded-card border bg-card py-4">
        <div className="flex flex-wrap items-center gap-2 px-5 pb-3">
          <span className="text-sm text-muted-foreground">
            총 <strong className="text-foreground">{total}</strong>건 · 행을
            누르면 상세를 봅니다.
          </span>
          {extras.map((x) => (
            <Link
              key={x.label}
              href={`?${reportSearch({ ...f, ...x.without, page: 1 })}`}
              className={cn(
                pillClass,
                "bg-brand-soft text-primary hover:underline",
              )}
              title="이 필터 빼기"
            >
              필터: {x.label} ✕
            </Link>
          ))}
          <Link
            href={f.hidden ? "/service/reports" : "?hidden=1"}
            className="ml-auto text-sm text-primary hover:underline"
          >
            {f.hidden ? "← 출장보고서로" : "숨긴 보고서 보기"}
          </Link>
          {abilities.canEdit ? (
            <>
              <Link
                href="/service/reports/new?from=pdf"
                className={buttonSecondaryClass}
              >
                PDF로 등록
              </Link>
              <Link href="/service/reports/new" className={buttonPrimaryClass}>
                출장보고서 입력
              </Link>
            </>
          ) : (
            <>
              <span
                aria-disabled
                title="열람 전용 — 입력은 팀장만"
                className={cn(
                  buttonSecondaryClass,
                  "pointer-events-none opacity-50",
                )}
              >
                PDF로 등록
              </span>
              <span
                aria-disabled
                title="열람 전용 — 입력은 팀장만"
                className={cn(
                  buttonPrimaryClass,
                  "pointer-events-none opacity-50",
                )}
              >
                출장보고서 입력
              </span>
            </>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[64rem] text-sm">
            <thead>
              <tr className="border-y bg-muted text-left text-xs text-muted-foreground">
                {[
                  "출장일",
                  "출장 목적",
                  "요청처",
                  "지역",
                  "작업 구분",
                  "유·무상",
                  "작성자·동행자",
                  "모델",
                  "첨부",
                ].map((h) => (
                  <th
                    key={h}
                    className={cn(
                      "px-3 py-2 font-medium",
                      h === "첨부" && "text-right",
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const start = iso(r.tripStart);
                const end = iso(r.tripEnd);
                return (
                  <RowLink
                    key={r.id}
                    href={`/service/reports/${r.id}`}
                    className={cn(r.deletedAt && "text-muted-foreground")}
                  >
                    <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                      {start ? (
                        <>
                          {start}
                          {end && end !== start && (
                            <span className="text-xs text-muted-foreground">
                              {" "}
                              ~ {end.slice(5)}
                            </span>
                          )}
                        </>
                      ) : (
                        <span
                          className={cn(
                            pillClass,
                            "bg-warning-soft text-warning-strong",
                          )}
                        >
                          출장일 없음
                        </span>
                      )}
                    </td>
                    <td className="max-w-72 truncate px-3 py-2" title={r.title}>
                      <Link
                        href={`/service/reports/${r.id}`}
                        className="hover:text-primary hover:underline"
                      >
                        {r.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{r.requestOrg || "-"}</td>
                    <td className="px-3 py-2 text-xs whitespace-nowrap">
                      {r.region ? (
                        regionLabel(r.region, r.sigungu)
                      ) : (
                        <span className="text-muted-foreground">미지정</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{r.workType || "-"}</td>
                    <td className="px-3 py-2">{billingPill(r.billing)}</td>
                    <td className="px-3 py-2 text-xs">
                      {[
                        r.authorName,
                        ...r.companions
                          .map((c) => c.name)
                          .filter((c) => c !== r.authorName),
                      ]
                        .filter(Boolean)
                        .join(", ") || "-"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {[...new Set(r.products.map((p) => p.modelName))].join(
                        ", ",
                      ) || "-"}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {r._count.attachments}
                    </td>
                  </RowLink>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={9}
                    className="px-3 py-6 text-center text-sm text-muted-foreground"
                  >
                    조건에 맞는 출장보고서가 없습니다.{" "}
                    {!anyFilter && abilities.canEdit && (
                      <Link
                        href="/service/reports/new"
                        className="text-primary hover:underline"
                      >
                        출장보고서 입력
                      </Link>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {pages > 1 && (
          <nav
            aria-label="쪽 이동"
            className="flex items-center justify-end gap-3 px-5 pt-3 text-sm"
          >
            {f.page > 1 ? (
              <Link
                href={`?${reportSearch(f, f.page - 1)}`}
                className={buttonSecondaryClass}
              >
                이전
              </Link>
            ) : (
              <span className={cn(buttonSecondaryClass, "opacity-50")}>
                이전
              </span>
            )}
            <span className="tabular-nums">
              {f.page} / {pages}
            </span>
            {f.page < pages ? (
              <Link
                href={`?${reportSearch(f, f.page + 1)}`}
                className={buttonSecondaryClass}
              >
                다음
              </Link>
            ) : (
              <span className={cn(buttonSecondaryClass, "opacity-50")}>
                다음
              </span>
            )}
          </nav>
        )}
      </section>
    </div>
  );
}
