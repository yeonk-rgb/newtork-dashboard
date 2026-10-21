"use client";
// 미수 건별 전체 표: 금액·경과일로 정렬, 90일 초과는 아이콘 + 글자 + 배경으로 표시 (색에만 의존하지 않음)
import { ArrowDown, ArrowUp, ArrowUpDown, TriangleAlert } from "lucide-react";
import { useState } from "react";

import { formatAmount } from "@/shared/format/money";
import { cn } from "@/shared/lib/utils";

/** 서버에서 날짜는 YYYY-MM-DD 문자열, 금액은 정수 문자열로 받음 */
export type ReceivableRow = {
  id: string;
  customerName: string;
  occurredOn: string;
  amount: string;
  dueOn: string | null;
  note: string | null;
  ageDays: number;
  bucket: "0-30" | "31-60" | "61-90" | "90+";
  isOverdue: boolean;
};

type SortKey = "amount" | "ageDays";
type SortDir = "asc" | "desc";

function SortButton({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  const Icon = !active ? ArrowUpDown : dir === "desc" ? ArrowDown : ArrowUp;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-0.5 rounded px-1 hover:bg-muted",
        active && "font-medium text-foreground",
      )}
    >
      {label}
      <Icon className="size-3" aria-hidden />
    </button>
  );
}

export function ReceivableItemsTable({
  rows,
  total,
}: {
  rows: ReceivableRow[];
  total: string;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "amount",
    dir: "desc",
  });

  const toggle = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === "desc" ? "asc" : "desc" }
        : { key, dir: "desc" },
    );

  const sorted = [...rows].sort((a, b) => {
    const diff =
      sort.key === "amount"
        ? Number(BigInt(a.amount) - BigInt(b.amount))
        : a.ageDays - b.ageDays;
    return sort.dir === "desc" ? -diff : diff;
  });
  const ariaSort = (key: SortKey) =>
    sort.key === key
      ? sort.dir === "desc"
        ? "descending"
        : "ascending"
      : "none";

  if (rows.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        미수금이 없습니다.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm [&_td]:px-3 [&_th]:px-3">
        <caption className="sr-only">
          미수 건별 전체 (금액·경과일 정렬 가능)
        </caption>
        <thead className="bg-muted text-xs text-muted-foreground">
          <tr className="border-b">
            <th className="py-2.5 text-left font-medium">거래처</th>
            <th className="py-2.5 text-left font-medium">발생일</th>
            <th
              className="py-2.5 text-right font-medium"
              aria-sort={ariaSort("ageDays")}
            >
              <SortButton
                label="경과일"
                active={sort.key === "ageDays"}
                dir={sort.dir}
                onClick={() => toggle("ageDays")}
              />
            </th>
            <th
              className="py-2.5 text-right font-medium"
              aria-sort={ariaSort("amount")}
            >
              <SortButton
                label="금액(원)"
                active={sort.key === "amount"}
                dir={sort.dir}
                onClick={() => toggle("amount")}
              />
            </th>
            <th className="py-2.5 pl-3 text-left font-medium">수금 예정일</th>
            <th className="py-2.5 text-left font-medium">상태</th>
            <th className="py-2.5 text-left font-medium">비고</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const old = r.bucket === "90+";
            return (
              <tr
                key={r.id}
                className={cn("border-b", old && "bg-warning-soft")}
              >
                <td className="py-2.5">{r.customerName}</td>
                <td className="py-2.5 tabular-nums">{r.occurredOn}</td>
                <td
                  className={cn(
                    "py-2.5 text-right tabular-nums",
                    old && "font-semibold",
                  )}
                >
                  {r.ageDays}일
                </td>
                <td className="py-2.5 text-right tabular-nums">
                  {formatAmount(r.amount)}
                </td>
                <td className="py-2.5 pl-3 tabular-nums">{r.dueOn ?? "-"}</td>
                <td className="py-2.5">
                  <div className="flex flex-wrap gap-1">
                    {old && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2 py-0.5 text-xs font-medium text-warning-strong">
                        <TriangleAlert className="size-3" aria-hidden />
                        90일 초과
                      </span>
                    )}
                    {r.isOverdue && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        예정일 지남
                      </span>
                    )}
                  </div>
                </td>
                <td className="py-2.5 text-muted-foreground">{r.note ?? ""}</td>
              </tr>
            );
          })}
          <tr className="border-t-2 font-semibold">
            <td className="py-2.5" colSpan={3}>
              합계 ({rows.length}건)
            </td>
            <td className="py-2.5 text-right tabular-nums">
              {formatAmount(total)}
            </td>
            <td colSpan={3} />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
