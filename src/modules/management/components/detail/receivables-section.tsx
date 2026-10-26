// 미수금 상세 (id="receivables" — 메인 "전체 보기 →" 도착 지점) — 경영지원 관리 외상매출금 기준 (2026-10-26, 05-22)
// 거래처별 전체 표 / 상태별(장기 미수금·당월 수금예정 + 당월 수금 따로) / 수금 예정 6개월 / 미수 행 전체
import { TriangleAlert } from "lucide-react";
import Link from "next/link";

import { cn } from "@/shared/lib/utils";
import { yearMonthLabel } from "@/shared/period/period";

import type { ReceivableResult } from "../../metrics/types";
import {
  Amount,
  pct,
  rowClass,
  Section,
  tableClass,
  theadClass,
  thClass,
  totalRowClass,
} from "./table-parts";
import { cardTitleClass } from "@/shared/ui/styles";
import { TERMS } from "../../terms";

const pad = (n: number) => String(n).padStart(2, "0");
const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const STATUS_LABEL = {
  LONG_OVERDUE: TERMS.longOverdue,
  SCHEDULED: TERMS.scheduled,
} as const;

export function ReceivablesSection({
  receivables,
  lead,
}: {
  receivables: ReceivableResult;
  /** 영역 첫 줄 (경영 대시보드에서 옮겨 온 미수금 원형 카드, 2026-10-25) */
  lead?: React.ReactNode;
}) {
  const {
    month,
    total,
    count,
    byCustomer,
    expected,
    longOverdue,
    scheduled,
    collected,
  } = receivables;
  const share = (amount: bigint) =>
    total === 0n ? "-" : pct(Number(amount) / Number(total));
  const ledgerHref = month
    ? `/management/ledger?month=${month.year}-${pad(month.month)}`
    : "/management/ledger";
  const expectedRows = [
    { label: "예정일 지남", ...expected.overdue },
    ...expected.months.map((m) => ({ label: yearMonthLabel(m), ...m })),
    { label: "그 이후", ...expected.later },
    { label: "예정일 없음", ...expected.noDueDate },
  ];

  return (
    <div id="receivables" className="scroll-mt-4 space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className={cardTitleClass}>
          미수금{" "}
          <span className="text-sm font-normal text-muted-foreground">
            (
            {month
              ? `${month.year}년 ${month.month}월 ${TERMS.ledger} ${TERMS.arBasis}${receivables.isCurrentMonth ? " · 이번 달 작성 중" : ""}`
              : `${TERMS.ledger} ${TERMS.arBasis}`}
            )
          </span>
        </h2>
        <div className="flex shrink-0 gap-4 text-xs">
          <Link href={ledgerHref} className="text-primary hover:underline">
            {TERMS.ledger} →
          </Link>
          <Link
            href="/management/receivables"
            className="text-muted-foreground hover:underline"
          >
            {TERMS.itemReceivables} →
          </Link>
        </div>
      </div>

      {lead && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">{lead}</div>
      )}

      {!month ? (
        <Section title="미수금">
          <p className="text-sm text-muted-foreground">
            이 기간에 {TERMS.ledger}의 외상매출금 입력이 없습니다.{" "}
            <Link href={ledgerHref} className="text-primary hover:underline">
              {TERMS.ledger}에서 입력 →
            </Link>
          </p>
        </Section>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <Section title="거래처별 미수금" className="xl:col-span-1">
              <table className={tableClass}>
                <caption className="sr-only">거래처별 미수금</caption>
                <thead className={theadClass}>
                  <tr className={rowClass}>
                    <th className={`${thClass} text-left`}>순위</th>
                    <th className={`${thClass} text-left`}>거래처</th>
                    <th className={`${thClass} text-right`}>금액(원)</th>
                    <th className={`${thClass} text-right`}>비율</th>
                  </tr>
                </thead>
                <tbody>
                  {byCustomer.map((c, i) => (
                    <tr key={c.customerName} className={rowClass}>
                      <td className="py-3 text-muted-foreground">{i + 1}</td>
                      <td className="py-3">
                        {c.customerName}
                        {c.longOverdue > 0n && (
                          <span className="ml-1 text-xs font-medium text-danger-strong">
                            {TERMS.longOverdue}
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <Amount value={c.amount} />
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        {share(c.amount)}
                      </td>
                    </tr>
                  ))}
                  <tr className={totalRowClass}>
                    <td className="py-3" colSpan={2}>
                      합계
                    </td>
                    <td className="py-3 text-right">
                      <Amount value={total} />
                    </td>
                    <td className="py-3 text-right">
                      {total === 0n ? "-" : "100%"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </Section>

            <Section
              title="상태별"
              description="외상매출금 구분 그대로 (원본 「경영지원 관리」 그룹)"
            >
              <table className={tableClass}>
                <caption className="sr-only">상태별 미수금</caption>
                <thead className={theadClass}>
                  <tr className={rowClass}>
                    <th className={`${thClass} text-left`}>구분</th>
                    <th className={`${thClass} text-right`}>금액(원)</th>
                    <th className={`${thClass} text-right`}>건수</th>
                    <th className={`${thClass} text-right`}>비율</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                    className={cn(
                      rowClass,
                      longOverdue.count > 0 && "bg-warning-soft",
                    )}
                  >
                    <td className="py-3">
                      <span className="inline-flex items-center gap-1 font-medium whitespace-nowrap">
                        <TriangleAlert className="size-4" aria-hidden />
                        {TERMS.longOverdue}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <Amount value={longOverdue.amount} />
                    </td>
                    <td className="py-3 text-right tabular-nums">
                      {longOverdue.count}
                    </td>
                    <td className="py-3 text-right tabular-nums">
                      {share(longOverdue.amount)}
                    </td>
                  </tr>
                  <tr className={rowClass}>
                    <td className="py-3">{TERMS.scheduled}</td>
                    <td className="py-3 text-right">
                      <Amount value={scheduled.amount} />
                    </td>
                    <td className="py-3 text-right tabular-nums">
                      {scheduled.count}
                    </td>
                    <td className="py-3 text-right tabular-nums">
                      {share(scheduled.amount)}
                    </td>
                  </tr>
                  <tr className={totalRowClass}>
                    <td className="py-3">미수금 합계</td>
                    <td className="py-3 text-right">
                      <Amount value={total} />
                    </td>
                    <td className="py-3 text-right tabular-nums">{count}</td>
                    <td className="py-3 text-right">
                      {total === 0n ? "-" : "100%"}
                    </td>
                  </tr>
                  <tr className="text-muted-foreground">
                    <td className="py-3">
                      {TERMS.collected}
                      <span className="block text-xs">(미수금 아님)</span>
                    </td>
                    <td className="py-3 text-right">
                      <Amount value={collected.amount} />
                    </td>
                    <td className="py-3 text-right tabular-nums">
                      {collected.count}
                    </td>
                    <td className="py-3" />
                  </tr>
                </tbody>
              </table>
            </Section>

            <Section
              title="수금 예정 (6개월)"
              description={`${TERMS.scheduled} 행의 수금 예정일 기준`}
            >
              <table className={tableClass}>
                <caption className="sr-only">수금 예정</caption>
                <thead className={theadClass}>
                  <tr className={rowClass}>
                    <th className={`${thClass} text-left`}>구분</th>
                    <th className={`${thClass} text-right`}>금액(원)</th>
                    <th className={`${thClass} text-right`}>건수</th>
                  </tr>
                </thead>
                <tbody>
                  {expectedRows.map((r) => (
                    <tr key={r.label} className={rowClass}>
                      <td className="py-3">{r.label}</td>
                      <td className="py-3 text-right">
                        <Amount value={r.amount} />
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        {r.count}
                      </td>
                    </tr>
                  ))}
                  <tr className={totalRowClass}>
                    <td className="py-3">{TERMS.scheduled} 합계</td>
                    <td className="py-3 text-right">
                      <Amount value={scheduled.amount} />
                    </td>
                    <td className="py-3 text-right tabular-nums">
                      {scheduled.count}
                    </td>
                  </tr>
                </tbody>
              </table>
            </Section>
          </div>

          <Section title="미수 행 전체" description="금액 큰 순">
            <table className={tableClass}>
              <caption className="sr-only">미수 행 전체</caption>
              <thead className={theadClass}>
                <tr className={rowClass}>
                  <th className={`${thClass} text-left`}>거래처</th>
                  <th className={`${thClass} text-left`}>구분</th>
                  <th className={`${thClass} text-right`}>금액(원)</th>
                  <th className={`${thClass} text-left`}>수금 예정일</th>
                  <th className={`${thClass} text-left`}>적요</th>
                </tr>
              </thead>
              <tbody>
                {receivables.items.map((item) => (
                  <tr
                    key={item.id}
                    className={cn(
                      rowClass,
                      item.status === "LONG_OVERDUE" && "text-danger-strong",
                    )}
                  >
                    <td className="py-3">{item.customerName}</td>
                    <td className="py-3">{STATUS_LABEL[item.status]}</td>
                    <td className="py-3 text-right">
                      <Amount value={item.amount} />
                    </td>
                    <td className="py-3 tabular-nums">
                      {item.dueOn ? isoDate(item.dueOn) : "-"}
                      {item.isOverdue && (
                        <span className="ml-1 text-xs font-medium text-warning-strong">
                          지남
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {item.note ?? ""}
                    </td>
                  </tr>
                ))}
                {receivables.items.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="py-3 text-center text-muted-foreground"
                    >
                      미수 행이 없습니다.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </Section>
        </>
      )}
    </div>
  );
}
