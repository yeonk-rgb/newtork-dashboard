"use client";
// 수금 처리 폼 (모달 안): 수금일 입력 — 미래 날짜·발생일보다 이른 날짜는 막는다
import { useState, useTransition } from "react";

import { formatWon } from "@/shared/format/money";

import type { ReceivableActionResult } from "./actions";
import { collectReceivable } from "./actions";
import { DialogButtons, FieldError, fieldClass } from "./modal";
import { receivableDateErrors, type ReceivableRow } from "./rules";

export function CollectForm({
  row,
  today,
  onDone,
  onCancel,
}: {
  row: ReceivableRow;
  today: string;
  onDone: (result: ReceivableActionResult) => void;
  onCancel: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [collectedOn, setCollectedOn] = useState(today);
  const [serverError, setServerError] = useState<ReceivableActionResult | null>(
    null,
  );
  const error = receivableDateErrors(
    { occurredOn: row.occurredOn, collectedOn },
    today,
  ).collectedOn;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (error) return;
    setServerError(null);
    startTransition(async () => {
      const result = await collectReceivable({
        id: row.id,
        expectedUpdatedAt: row.updatedAt,
        collectedOn,
      });
      if (result.ok) onDone(result);
      else setServerError(result);
    });
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-3 text-sm">
      <dl className="grid grid-cols-[5rem_1fr] gap-y-1 text-muted-foreground">
        <dt>거래처</dt>
        <dd className="text-foreground">{row.customerName}</dd>
        <dt>금액</dt>
        <dd className="text-foreground tabular-nums">
          {formatWon(row.amount)}
        </dd>
        <dt>발생일</dt>
        <dd className="text-foreground tabular-nums">{row.occurredOn}</dd>
      </dl>
      <div>
        <label htmlFor="rcv-collect-date" className="mb-1 block font-medium">
          수금일 <span className="text-destructive">*</span>
        </label>
        <input
          id="rcv-collect-date"
          type="date"
          autoFocus
          min={row.occurredOn}
          max={today}
          value={collectedOn}
          onChange={(e) => setCollectedOn(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "rcv-collect-err" : undefined}
          className={fieldClass}
        />
        <FieldError id="rcv-collect-err" message={error} />
        <p className="mt-1 text-xs text-muted-foreground">
          부분 수금은 아직 지원하지 않습니다 (고객사 확인 중 05-11번).
        </p>
      </div>
      {serverError && (
        <p role="alert" className="text-sm text-destructive">
          {serverError.message}
          {!serverError.ok && serverError.code === "CONFLICT" && (
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="ml-2 underline"
            >
              새로고침
            </button>
          )}
        </p>
      )}
      <DialogButtons
        onCancel={onCancel}
        submitLabel="수금 처리"
        pending={pending}
        disabled={Boolean(error)}
      />
    </form>
  );
}
