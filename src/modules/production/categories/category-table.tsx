"use client";
// 수주번호마다 사업구분 고르기 — 고르면 바로 저장 (같은 수주번호의 일련번호 전체에 적용)
import { useState, useTransition } from "react";

import { INDUSTRIES } from "@/shared/contracts/production";
import { cn } from "@/shared/lib/utils";

import { UNCLASSIFIED_LABEL } from "../labels";
import { setOrderCategory } from "../records/actions";
import type { OrderRow } from "./load-orders";

export function CategoryTable({
  rows,
  canEdit,
}: {
  rows: OrderRow[];
  canEdit: boolean;
}) {
  const [values, setValues] = useState(
    () => new Map(rows.map((r) => [r.orderNo, r.category ?? ""])),
  );
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  const change = (orderNo: string, value: string) => {
    const before = values.get(orderNo) ?? "";
    setValues(new Map(values).set(orderNo, value));
    startTransition(async () => {
      const result = await setOrderCategory(orderNo, value);
      setMessage({
        ok: result.ok,
        text: result.ok ? `저장했습니다 — ${result.message}` : result.message,
      });
      if (!result.ok) setValues((prev) => new Map(prev).set(orderNo, before));
    });
  };

  return (
    <>
      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={cn(
            "px-6 pb-3 text-sm",
            message.ok ? "text-primary" : "text-destructive",
          )}
        >
          {message.text}
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[48rem] text-sm">
          <thead>
            <tr className="border-b bg-muted text-left text-xs text-muted-foreground">
              <th className="px-3 py-2 font-medium">수주번호</th>
              <th className="px-3 py-2 text-right font-medium">제조내역 행</th>
              <th className="px-3 py-2 font-medium">판매처</th>
              <th className="px-3 py-2 font-medium">최종발주처</th>
              <th className="px-3 py-2 font-medium">사업구분</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.orderNo} className="border-b last:border-0">
                <td className="px-3 py-2 font-medium">{r.orderNo}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {r.recordCount}
                </td>
                <td className="px-3 py-2">{r.sellers || "-"}</td>
                <td className="px-3 py-2">{r.finalClients || "-"}</td>
                <td className="px-3 py-2">
                  <select
                    aria-label={`${r.orderNo} 사업구분`}
                    value={values.get(r.orderNo) ?? ""}
                    disabled={!canEdit || pending}
                    onChange={(e) => change(r.orderNo, e.target.value)}
                    className="h-9 rounded-lg border border-input bg-background px-2 disabled:bg-muted"
                  >
                    <option value="">{UNCLASSIFIED_LABEL}</option>
                    {INDUSTRIES.map((i) => (
                      <option key={i.key} value={i.key}>
                        {i.label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
