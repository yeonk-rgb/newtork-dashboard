"use client";
// 부품별 비교 — 친구 우민영 저장소 part-prices.js renderParts 를 옮김 + 2026-11-05 담당자 피드백
// - 뉴토크 기준값 산식 상자 없앰, 기준값 칸을 두 번 누르면(더블클릭) 바로 고침 (Enter 저장 · Esc 취소)
// - 파트넘버를 누르면 아래에 출장지별 단가 (친구 앱의 "단가표 기준단가·할인·추가" 줄과 "이 부품만 따로" 입력 줄은 없앰)
// 필터·고른 부품은 주소(GET): ?q=&category=&hidden=1&part=
import Link from "next/link";
import { useState, useTransition } from "react";

import { cn } from "@/shared/lib/utils";
import {
  buttonCompactClass,
  buttonPrimaryClass,
  buttonSecondaryClass,
  cardTitleClass,
  labelClass,
  pillClass,
} from "@/shared/ui/styles";

import {
  setPriceItemHidden,
  setPriceQuoteHidden,
  updateBasePrice,
  type ActionResult,
} from "./actions";
import {
  LOW_ALERT_RATE,
  signedRate,
  signedWon,
  type ItemRow,
  type QuoteRow,
} from "./compute";
import { DiffBarChart, DiffLegend } from "./diff-bar-chart";

const wonText = (v: number | null | undefined) =>
  v === null || v === undefined ? "-" : `${v.toLocaleString("ko-KR")}원`;

export type PartsFilters = { q: string; category: string; hidden: boolean };

export function PartsCompare({
  rows,
  categories,
  filters,
  detail,
  canEdit,
  canHide,
}: {
  rows: ItemRow[];
  categories: string[];
  filters: PartsFilters;
  detail: { item: ItemRow; quotes: QuoteRow[] } | null;
  canEdit: boolean;
  canHide: boolean;
}) {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const say = (r: ActionResult) => setMessage({ ok: r.ok, text: r.message });
  const act = (fn: () => Promise<ActionResult>) =>
    startTransition(async () => say(await fn()));

  const params = (extra: Record<string, string>) => {
    const p = new URLSearchParams();
    if (filters.q) p.set("q", filters.q);
    if (filters.category) p.set("category", filters.category);
    if (filters.hidden) p.set("hidden", "1");
    for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v);
    return p.toString();
  };
  const exportUrl = (format: "xlsx" | "csv") =>
    `/api/service/unit-prices/export?${new URLSearchParams({
      kind: "items",
      q: filters.q,
      category: filters.category,
      format,
    })}`;
  const filtered = !!(filters.q || filters.category);

  return (
    <div className="space-y-4">
      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={cn(
            "rounded-lg px-3 py-2 text-sm",
            message.ok
              ? "bg-primary-50 text-primary"
              : "bg-danger-soft text-danger-strong",
          )}
        >
          {message.text}
        </p>
      )}

      <section className="rounded-card border bg-card p-6">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className={cardTitleClass}>
              {filters.hidden ? "숨긴 부품" : "파트넘버별 기준값 · 출장지 단가"}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {rows.length.toLocaleString("ko-KR")}개 부품 · 파트넘버를 누르면
              아래에 출장지별 단가
              {canEdit &&
                !filters.hidden &&
                " · 뉴토크 기준값을 두 번 누르면 바로 고칠 수 있습니다"}
            </p>
          </div>
          {!filters.hidden && (
            <div className="flex gap-2">
              <a
                href={exportUrl("xlsx")}
                className={cn(
                  buttonCompactClass,
                  !rows.length && "pointer-events-none opacity-50",
                )}
              >
                ⬇ 엑셀
              </a>
              <a
                href={exportUrl("csv")}
                className={cn(
                  buttonCompactClass,
                  !rows.length && "pointer-events-none opacity-50",
                )}
              >
                ⬇ CSV
              </a>
            </div>
          )}
        </div>

        <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
          <input
            name="q"
            defaultValue={filters.q}
            aria-label="파트넘버 또는 품목 검색"
            placeholder="파트넘버(예: 05-A-01, 0501) 또는 품목"
            className="h-10 w-72 max-w-full rounded-lg border border-input bg-background px-3 text-sm"
          />
          <select
            name="category"
            defaultValue={filters.category}
            aria-label="분류"
            className="h-10 rounded-lg border border-input bg-background px-3 text-sm"
          >
            <option value="">모든 분류</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <label className="inline-flex items-center gap-1.5 text-sm text-body">
            <input
              type="checkbox"
              name="hidden"
              value="1"
              defaultChecked={filters.hidden}
            />
            숨긴 부품 보기
          </label>
          <button type="submit" className={buttonSecondaryClass}>
            검색
          </button>
          {(filtered || filters.hidden) && (
            <Link href="?" className="text-sm text-primary hover:underline">
              조건 지우기
            </Link>
          )}
        </form>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[60rem] text-sm">
            <thead>
              <tr className="border-b bg-muted text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">파트넘버</th>
                <th className="px-3 py-2 font-medium">품목</th>
                <th className="px-3 py-2 font-medium">적용 모델</th>
                <th className="bg-primary-50 px-3 py-2 text-right font-medium text-primary">
                  뉴토크 기준값
                </th>
                <th className="px-3 py-2 text-right font-medium">평균</th>
                <th className="px-3 py-2 text-right font-medium">최저</th>
                <th className="px-3 py-2 text-right font-medium">최고</th>
                <th className="px-3 py-2 text-right font-medium">최고−최저</th>
                <th className="px-3 py-2 text-right font-medium">출장지</th>
                {filters.hidden && <th className="px-3 py-2" />}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className={cn(
                    "border-b align-middle last:border-0",
                    detail?.item.id === r.id && "bg-primary-50/60",
                  )}
                >
                  <td className="px-3 py-2 font-semibold whitespace-nowrap">
                    <Link
                      href={`?${params({ part: r.id })}#part-detail`}
                      scroll={false}
                      className="text-primary hover:underline"
                    >
                      {r.partNo}
                    </Link>
                  </td>
                  <td className="px-3 py-2">
                    {r.name}
                    {r.category && (
                      <span className="ml-1 text-xs text-muted-foreground">
                        {r.category}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.appliesTo || "-"}
                  </td>
                  <BasePriceCell
                    key={`${r.id}:${r.updatedAt}`}
                    row={r}
                    editable={canEdit && !r.hidden}
                    pending={pending}
                    onSave={(raw) =>
                      act(() => updateBasePrice(r.id, r.updatedAt, raw))
                    }
                  />
                  <td className="px-3 py-2 text-right tabular-nums">
                    {wonText(r.stats.average)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {wonText(r.stats.min)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {wonText(r.stats.max)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {wonText(r.stats.range)}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">
                    {r.stats.count}곳
                  </td>
                  {filters.hidden && (
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        disabled={!canHide || pending}
                        title={
                          canHide ? undefined : "열람 전용 — 복구는 팀장만"
                        }
                        onClick={() =>
                          act(() => setPriceItemHidden(r.id, false))
                        }
                        className={buttonCompactClass}
                      >
                        복구
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-3 py-6 text-center text-sm text-muted-foreground"
                  >
                    {filters.hidden
                      ? "숨긴 부품이 없습니다."
                      : filtered
                        ? "조건에 맞는 부품이 없습니다."
                        : "단가표가 없습니다. [단가 데이터 업로드]나 [부품 추가]에서 넣어 주세요."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          평균·최저·최고는 출장지(업체)마다 가장 최근 단가 1개로 계산합니다(적용
          예정 단가 제외). 기준값이 &quot;-&quot;인 부품은 아직 기준값이
          없습니다.
        </p>
      </section>

      {detail && (
        <PartDetail
          key={detail.item.id}
          item={detail.item}
          quotes={detail.quotes}
          canHide={canHide}
          pending={pending}
          act={act}
        />
      )}
    </div>
  );
}

/** 뉴토크 기준값 칸 — 두 번 누르면 입력칸으로 바뀜 */
function BasePriceCell({
  row,
  editable,
  pending,
  onSave,
}: {
  row: ItemRow;
  editable: boolean;
  pending: boolean;
  onSave: (raw: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(
    row.basePrice === null ? "" : row.basePrice.toLocaleString("ko-KR"),
  );
  const original =
    row.basePrice === null ? "" : row.basePrice.toLocaleString("ko-KR");
  const cancel = () => {
    setDraft(original);
    setEditing(false);
  };
  const save = () => {
    if (draft.replace(/[,\s]/g, "") === original.replace(/,/g, "")) {
      setEditing(false);
      return;
    }
    onSave(draft);
  };
  if (!editing) {
    return (
      <td
        className={cn(
          "bg-primary-50/50 px-3 py-2 text-right font-semibold tabular-nums",
          editable && "cursor-text hover:bg-primary-50",
        )}
        title={editable ? "두 번 눌러 고치기" : undefined}
        onDoubleClick={editable ? () => setEditing(true) : undefined}
        onKeyDown={
          editable
            ? (e) => {
                if (e.key === "Enter" || e.key === "F2") setEditing(true);
              }
            : undefined
        }
        tabIndex={editable ? 0 : undefined}
        aria-label={
          editable
            ? `${row.partNo} 뉴토크 기준값 ${wonText(row.basePrice)} — Enter 로 고치기`
            : undefined
        }
      >
        {wonText(row.basePrice)}
      </td>
    );
  }
  return (
    <td className="bg-primary-50 px-2 py-1 text-right">
      <div className="flex items-center justify-end gap-1">
        <input
          autoFocus
          inputMode="numeric"
          aria-label={`${row.partNo} 뉴토크 기준값 (원)`}
          value={draft}
          disabled={pending}
          onChange={(e) => {
            const digits = e.target.value.replace(/[^\d]/g, "");
            setDraft(digits ? Number(digits).toLocaleString("ko-KR") : "");
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              save();
            } else if (e.key === "Escape") {
              e.preventDefault();
              cancel();
            }
          }}
          placeholder="비우면 미입력"
          className="h-8 w-32 rounded-md border border-input bg-background px-2 text-right text-sm tabular-nums"
        />
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className={cn(buttonPrimaryClass, "h-8 px-2 text-xs")}
        >
          저장
        </button>
        <button
          type="button"
          onClick={cancel}
          className={cn(buttonCompactClass, "px-2")}
        >
          취소
        </button>
      </div>
    </td>
  );
}

function PartDetail({
  item,
  quotes,
  canHide,
  pending,
  act,
}: {
  item: ItemRow;
  quotes: QuoteRow[];
  canHide: boolean;
  pending: boolean;
  act: (fn: () => Promise<ActionResult>) => void;
}) {
  const visible = quotes.filter((q) => !q.hidden);
  const hiddenQuotes = quotes.filter((q) => q.hidden);
  const bars = visible
    .filter((q) => q.latest && q.diffRate !== null)
    .sort((a, b) => b.diffRate! - a.diffRate!)
    .map((q) => ({
      key: q.id,
      label: q.company,
      rate: q.diffRate!,
      detail: `${wonText(q.unitPrice)} (${signedWon(q.diff!)})`,
    }));
  const stats: [string, number | null, boolean][] = [
    ["뉴토크 기준값", item.basePrice, true],
    ["평균", item.stats.average, false],
    ["최저", item.stats.min, false],
    ["최고", item.stats.max, false],
    ["최고−최저", item.stats.range, false],
  ];
  const hideQuote = (q: QuoteRow) => {
    if (
      !window.confirm(
        `${q.company} ${wonText(q.unitPrice)} (${q.effectiveDate}부터) 단가를 숨길까요? 아래 [숨긴 단가]에서 복구할 수 있습니다.`,
      )
    )
      return;
    act(() => setPriceQuoteHidden(q.id, true));
  };
  const hideItem = () => {
    if (
      !window.confirm(
        `${item.partNo} ${item.name}을(를) 숨길까요? 비교·업로드에서 빠지고, [숨긴 부품 보기]에서 복구할 수 있습니다.`,
      )
    )
      return;
    act(() => setPriceItemHidden(item.id, true));
  };

  return (
    <section
      id="part-detail"
      className="scroll-mt-4 rounded-card border bg-card p-6"
    >
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={cardTitleClass}>
            {item.partNo} {item.name}
            {item.hidden && (
              <span
                className={cn(pillClass, "ml-2 bg-muted text-muted-foreground")}
              >
                숨김
              </span>
            )}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {[item.category, item.appliesTo || "적용 모델 없음"]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {!item.hidden && (
          <button
            type="button"
            disabled={!canHide || pending}
            title={canHide ? undefined : "열람 전용 — 숨기기는 팀장만"}
            onClick={hideItem}
            className={buttonCompactClass}
          >
            부품 숨김
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {stats.map(([label, v, std]) => (
          <div
            key={label}
            className={cn(
              "rounded-lg border px-3 py-2",
              std ? "border-primary/30 bg-primary-50" : "bg-muted/40",
            )}
          >
            <div className={labelClass}>{label}</div>
            <div
              className={cn(
                "mt-0.5 text-base font-semibold tabular-nums",
                std && "text-primary",
              )}
            >
              {wonText(v)}
            </div>
          </div>
        ))}
      </div>

      {bars.length > 0 && (
        <div className="mt-5 space-y-2">
          <h3 className="text-sm font-semibold">
            출장지별 단가 · 뉴토크 기준값 대비
          </h3>
          <DiffLegend />
          <DiffBarChart
            rows={bars}
            ariaLabel={`${item.partNo} 출장지별 뉴토크 기준값 대비 차이율`}
          />
        </div>
      )}

      {visible.length === 0 ? (
        <p className="mt-5 rounded-lg bg-muted/50 px-3 py-6 text-center text-sm text-muted-foreground">
          아직 출장지별 단가가 없습니다. [단가 데이터 업로드]에서 출장지별 단가
          CSV를 올리면 쌓입니다.
        </p>
      ) : (
        <QuoteTable
          quotes={visible}
          canHide={canHide}
          pending={pending}
          onToggle={hideQuote}
        />
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        &quot;크게 낮음&quot;은 뉴토크 기준값보다 {LOW_ALERT_RATE}% 이상 낮은
        단가입니다(할인 과다 점검). 흐린 줄은 같은 출장지의 이전 단가(또는 적용
        예정)라 평균·최저·최고 계산에서 빠집니다.
      </p>

      {hiddenQuotes.length > 0 && (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer text-muted-foreground">
            숨긴 단가 {hiddenQuotes.length}건
          </summary>
          <QuoteTable
            quotes={hiddenQuotes}
            canHide={canHide}
            pending={pending}
            onToggle={(q) => act(() => setPriceQuoteHidden(q.id, false))}
          />
        </details>
      )}
    </section>
  );
}

function QuoteTable({
  quotes,
  canHide,
  pending,
  onToggle,
}: {
  quotes: QuoteRow[];
  canHide: boolean;
  pending: boolean;
  onToggle: (q: QuoteRow) => void;
}) {
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full min-w-[60rem] text-sm">
        <thead>
          <tr className="border-b bg-muted text-left text-xs text-muted-foreground">
            <th className="px-3 py-2 font-medium">출장지(업체)</th>
            <th className="px-3 py-2 font-medium">적용 시작일</th>
            <th className="px-3 py-2 text-right font-medium">단가</th>
            <th className="px-3 py-2 text-right font-medium">기준값 대비</th>
            <th className="px-3 py-2 font-medium">출처</th>
            <th className="px-3 py-2 font-medium">사업명</th>
            <th className="px-3 py-2 font-medium">비고</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {quotes.map((q) => (
            <tr
              key={q.id}
              className={cn(
                "border-b align-middle last:border-0",
                (!q.latest || q.hidden) && "text-muted-foreground",
              )}
            >
              <td className="px-3 py-2">
                {q.company}
                {q.latest && (
                  <span
                    className={cn(pillClass, "ml-1 bg-primary-50 text-primary")}
                    title="평균·최저·최고 계산에 쓰인 단가"
                  >
                    비교 기준
                  </span>
                )}
              </td>
              <td className="px-3 py-2 whitespace-nowrap tabular-nums">
                {q.effectiveDate}
                {q.upcoming && (
                  <span className={cn(pillClass, "ml-1 bg-muted")}>예정</span>
                )}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {wonText(q.unitPrice)}
              </td>
              <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                {q.diff === null ? (
                  "-"
                ) : (
                  <>
                    {signedWon(q.diff)}{" "}
                    <span className="text-muted-foreground">
                      ({signedRate(q.diffRate!)})
                    </span>
                  </>
                )}
                {q.low && (
                  <span
                    className={cn(
                      pillClass,
                      "ml-1 bg-danger-soft text-danger-strong",
                    )}
                    title={`기준값보다 ${LOW_ALERT_RATE}% 이상 낮음 (할인 과다 점검)`}
                  >
                    크게 낮음
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-xs whitespace-nowrap">
                {q.source === "order" ? "수주 내역" : "업로드"}
                {q.quoteNo && (
                  <span className="ml-1 text-muted-foreground">
                    {q.quoteNo}
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-xs">{q.project || "-"}</td>
              <td className="px-3 py-2 text-xs">{q.note || "-"}</td>
              <td className="px-3 py-2 text-right">
                <button
                  type="button"
                  disabled={!canHide || pending}
                  title={canHide ? undefined : "열람 전용 — 팀장만"}
                  onClick={() => onToggle(q)}
                  className={buttonCompactClass}
                >
                  {q.hidden ? "복구" : "숨김"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
