// 미수금 상세 (id="receivables" — 메인 "전체 보기 →" 도착 지점)
// 거래처별 전체 표 / 경과일 구간 / 수금 예정 6개월 / 건별 전체 표(정렬)
import { TriangleAlert } from "lucide-react";
import Link from "next/link";

import { serializeBigInt } from "@/shared/format/bigint";
import { yearMonthLabel } from "@/shared/period/period";

import type { ReceivableResult } from "../../metrics/types";
import { ReceivableItemsTable } from "./receivable-items-table";
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

const isoDate = (d: Date) => d.toISOString().slice(0, 10);
const BUCKET_LABEL = {
  "0-30": "0~30일",
  "31-60": "31~60일",
  "61-90": "61~90일",
  "90+": "90일 초과",
} as const;

export function ReceivablesSection({
  receivables,
  lead,
}: {
  receivables: ReceivableResult;
  /** 영역 첫 줄 (경영 대시보드에서 옮겨 온 미수금 원형 카드, 2026-10-25) */
  lead?: React.ReactNode;
}) {
  const { total, count, byCustomer, aging, expected, asOf } = receivables;
  const share = (amount: bigint) =>
    total === 0n ? "-" : pct(Number(amount) / Number(total));
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
            ({isoDate(asOf)} 기준 · 경과일은 발생일부터)
          </span>
        </h2>
        <Link
          href="/management/receivables"
          className="shrink-0 text-xs text-primary hover:underline"
        >
          미수금 관리(등록·수금 처리) →
        </Link>
      </div>

      {lead && (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">{lead}</div>
      )}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <Section title="거래처별 미수금" className="xl:col-span-1">
          <table className={tableClass}>
            <caption className="sr-only">거래처별 미수금</caption>
            <thead className={theadClass}>
              <tr className={rowClass}>
                <th className={`${thClass} text-left`}>순위</th>
                <th className={`${thClass} text-left`}>거래처</th>
                <th className={`${thClass} text-right`}>금액(원)</th>
                <th className={`${thClass} text-right`}>건수</th>
                <th className={`${thClass} text-right`}>비율</th>
              </tr>
            </thead>
            <tbody>
              {byCustomer.map((c, i) => (
                <tr key={c.customerName} className={rowClass}>
                  <td className="py-3 text-muted-foreground">{i + 1}</td>
                  <td className="py-3">{c.customerName}</td>
                  <td className="py-3 text-right">
                    <Amount value={c.amount} />
                  </td>
                  <td className="py-3 text-right tabular-nums">{c.count}</td>
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
                <td className="py-3 text-right tabular-nums">{count}</td>
                <td className="py-3 text-right">
                  {total === 0n ? "-" : "100%"}
                </td>
              </tr>
            </tbody>
          </table>
        </Section>

        <Section title="경과일 구간">
          <table className={tableClass}>
            <caption className="sr-only">경과일 구간별 미수금</caption>
            <thead className={theadClass}>
              <tr className={rowClass}>
                <th className={`${thClass} text-left`}>구간</th>
                <th className={`${thClass} text-right`}>금액(원)</th>
                <th className={`${thClass} text-right`}>건수</th>
                <th className={`${thClass} text-right`}>비율</th>
              </tr>
            </thead>
            <tbody>
              {aging.map((a) => {
                const old = a.bucket === "90+";
                return (
                  <tr
                    key={a.bucket}
                    className={`${rowClass} ${old && a.count > 0 ? "bg-warning-soft" : ""}`}
                  >
                    <td className="py-3">
                      {old ? (
                        <span className="inline-flex items-center gap-1 font-medium">
                          <TriangleAlert className="size-4" aria-hidden />
                          {BUCKET_LABEL[a.bucket]}
                        </span>
                      ) : (
                        BUCKET_LABEL[a.bucket]
                      )}
                    </td>
                    <td className="py-3 text-right">
                      <Amount value={a.amount} />
                    </td>
                    <td className="py-3 text-right tabular-nums">{a.count}</td>
                    <td className="py-3 text-right tabular-nums">
                      {share(a.amount)}
                    </td>
                  </tr>
                );
              })}
              <tr className={totalRowClass}>
                <td className="py-3">합계</td>
                <td className="py-3 text-right">
                  <Amount value={total} />
                </td>
                <td className="py-3 text-right tabular-nums">{count}</td>
                <td className="py-3 text-right">
                  {total === 0n ? "-" : "100%"}
                </td>
              </tr>
            </tbody>
          </table>
        </Section>

        <Section
          title="수금 예정 (6개월)"
          description="수금 예정일(dueOn) 기준"
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
                  <td className="py-3 text-right tabular-nums">{r.count}</td>
                </tr>
              ))}
              <tr className={totalRowClass}>
                <td className="py-3">합계</td>
                <td className="py-3 text-right">
                  <Amount value={total} />
                </td>
                <td className="py-3 text-right tabular-nums">{count}</td>
              </tr>
            </tbody>
          </table>
        </Section>
      </div>

      <Section
        title="미수 건별 전체"
        description="머리글의 금액·경과일을 누르면 정렬됩니다"
      >
        <ReceivableItemsTable
          total={total.toString()}
          rows={serializeBigInt(
            receivables.items.map((item) => ({
              ...item,
              occurredOn: isoDate(item.occurredOn),
              dueOn: item.dueOn ? isoDate(item.dueOn) : null,
            })),
          )}
        />
      </Section>
    </div>
  );
}
