"use client";
// 미수금 등록·수정 폼 (모달 안). 수금 완료 건 수정(팀장)이면 수금일도 함께 수정
import { useState, useTransition } from "react";

import { MoneyTextInput } from "../entry/money-text-input";
import type { ReceivableActionResult } from "./actions";
import { createReceivable, updateReceivable } from "./actions";
import { DialogButtons, FieldError, fieldClass } from "@/shared/ui/modal";
import {
  CUSTOMER_MAX,
  normalizeCustomerName,
  NOTE_MAX,
  receivableDateErrors,
  type ReceivableRow,
} from "./rules";

type Values = {
  customerName: string;
  occurredOn: string;
  amount: string;
  dueOn: string;
  collectedOn: string;
  note: string;
};

export function ReceivableForm({
  row,
  today,
  customerNames,
  onDone,
  onCancel,
}: {
  /** null = 새로 등록 */
  row: ReceivableRow | null;
  today: string;
  customerNames: string[];
  onDone: (result: ReceivableActionResult) => void;
  onCancel: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [values, setValues] = useState<Values>(() => ({
    customerName: row?.customerName ?? "",
    occurredOn: row?.occurredOn ?? today,
    amount: row?.amount ?? "",
    dueOn: row?.dueOn ?? "",
    collectedOn: row?.collectedOn ?? "",
    note: row?.note ?? "",
  }));
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<ReceivableActionResult | null>(
    null,
  );
  const collected = row?.isCollected ?? false;

  const set = (patch: Partial<Values>) =>
    setValues((v) => ({ ...v, ...patch }));

  const errors: Partial<Record<keyof Values, string>> = {
    ...receivableDateErrors(
      {
        occurredOn: values.occurredOn,
        dueOn: values.dueOn || null,
        ...(collected ? { collectedOn: values.collectedOn } : {}),
      },
      today,
    ),
  };
  if (normalizeCustomerName(values.customerName) === "") {
    errors.customerName = "거래처를 입력하세요.";
  }
  if (values.amount === "" || /^0+$/.test(values.amount)) {
    errors.amount = "금액을 입력하세요.";
  }
  const hasErrors = Object.values(errors).some(Boolean);
  // 처음에는 입력 중 오류를 보이지 않다가, 저장을 한 번 누른 뒤부터 보인다
  const shown = submitted ? errors : {};

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (hasErrors) return;
    setServerError(null);
    startTransition(async () => {
      const fields = {
        customerName: values.customerName,
        occurredOn: values.occurredOn,
        amount: values.amount,
        dueOn: values.dueOn || null,
        note: values.note,
      };
      const result = row
        ? await updateReceivable({
            ...fields,
            id: row.id,
            expectedUpdatedAt: row.updatedAt,
            collectedOn: collected ? values.collectedOn : null,
          })
        : await createReceivable(fields);
      if (result.ok) onDone(result);
      else setServerError(result);
    });
  };

  const describe = (key: keyof Values) =>
    shown[key] ? `rcv-err-${key}` : undefined;

  return (
    <form onSubmit={submit} noValidate className="space-y-3 text-sm">
      <div>
        <label htmlFor="rcv-customer" className="mb-1 block font-medium">
          거래처 <span className="text-destructive">*</span>
        </label>
        <input
          id="rcv-customer"
          list="rcv-customer-names"
          autoComplete="off"
          autoFocus
          maxLength={CUSTOMER_MAX + 10}
          value={values.customerName}
          onChange={(e) => set({ customerName: e.target.value })}
          aria-invalid={shown.customerName ? true : undefined}
          aria-describedby={describe("customerName")}
          placeholder="기존 거래처는 입력하면 목록이 나옵니다"
          className={fieldClass}
        />
        <datalist id="rcv-customer-names">
          {customerNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
        <FieldError id="rcv-err-customerName" message={shown.customerName} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="rcv-occurred" className="mb-1 block font-medium">
            발생일 <span className="text-destructive">*</span>
          </label>
          <input
            id="rcv-occurred"
            type="date"
            max={today}
            value={values.occurredOn}
            onChange={(e) => set({ occurredOn: e.target.value })}
            aria-invalid={shown.occurredOn ? true : undefined}
            aria-describedby={describe("occurredOn")}
            className={fieldClass}
          />
          <FieldError id="rcv-err-occurredOn" message={shown.occurredOn} />
        </div>
        <div>
          <label htmlFor="rcv-amount" className="mb-1 block font-medium">
            금액 <span className="text-destructive">*</span>
          </label>
          <MoneyTextInput
            id="rcv-amount"
            digits={values.amount}
            onChange={(amount) => set({ amount })}
            invalid={Boolean(shown.amount)}
            describedBy={describe("amount")}
            placeholder=""
          />
          <FieldError id="rcv-err-amount" message={shown.amount} />
        </div>
        <div>
          <label htmlFor="rcv-due" className="mb-1 block font-medium">
            수금 예정일
          </label>
          <input
            id="rcv-due"
            type="date"
            min={values.occurredOn || undefined}
            value={values.dueOn}
            onChange={(e) => set({ dueOn: e.target.value })}
            aria-invalid={shown.dueOn ? true : undefined}
            aria-describedby={describe("dueOn")}
            className={fieldClass}
          />
          <FieldError id="rcv-err-dueOn" message={shown.dueOn} />
        </div>
        {collected && (
          <div>
            <label htmlFor="rcv-collected" className="mb-1 block font-medium">
              수금일 <span className="text-destructive">*</span>
            </label>
            <input
              id="rcv-collected"
              type="date"
              min={values.occurredOn || undefined}
              max={today}
              value={values.collectedOn}
              onChange={(e) => set({ collectedOn: e.target.value })}
              aria-invalid={shown.collectedOn ? true : undefined}
              aria-describedby={describe("collectedOn")}
              className={fieldClass}
            />
            <FieldError id="rcv-err-collectedOn" message={shown.collectedOn} />
          </div>
        )}
      </div>

      <div>
        <label htmlFor="rcv-note" className="mb-1 block font-medium">
          비고
        </label>
        <textarea
          id="rcv-note"
          rows={2}
          maxLength={NOTE_MAX}
          value={values.note}
          onChange={(e) => set({ note: e.target.value })}
          className={`${fieldClass} h-auto py-2`}
        />
      </div>

      {collected && (
        <p className="text-xs text-muted-foreground">
          수금 완료된 건입니다. 수정 내용은 대시보드의 과거 기간 미수금에도
          반영됩니다.
        </p>
      )}
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
        submitLabel={row ? "수정 저장" : "등록"}
        pending={pending}
      />
    </form>
  );
}
