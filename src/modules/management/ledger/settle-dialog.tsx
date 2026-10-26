"use client";
// 당월 수금으로 바꿀 때 뜨는 완료일 입력 (모달). 확인하면 입력 중인 행에 값만 넣고, 저장은 행의 [저장]으로
import { useState } from "react";

import { formatWon } from "@/shared/format/money";

import {
  DialogButtons,
  FieldError,
  fieldClass,
  Modal,
} from "../receivables/modal";
import { ledgerDateErrors } from "./rules";

export type SettleRequest = {
  partnerName: string;
  /** 콤마 없는 숫자 문자열 (빈칸이면 금액 줄을 숨김) */
  amount: string;
  /** 처음 보여줄 날짜 */
  initialDate: string;
};

export function SettleDialog({
  request,
  today,
  onConfirm,
  onCancel,
}: {
  request: SettleRequest | null;
  today: string;
  onConfirm: (settledOn: string) => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={request !== null}
      onClose={onCancel}
      title="수금 완료일 입력"
      titleId="ledger-settle-title"
    >
      {request && (
        <SettleForm
          request={request}
          today={today}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      )}
    </Modal>
  );
}

function SettleForm({
  request,
  today,
  onConfirm,
  onCancel,
}: {
  request: SettleRequest;
  today: string;
  onConfirm: (settledOn: string) => void;
  onCancel: () => void;
}) {
  const [settledOn, setSettledOn] = useState(request.initialDate);
  const error = ledgerDateErrors(
    { kind: "AR", arStatus: "COLLECTED", dueOn: null, settledOn },
    today,
  ).settledOn;

  return (
    <form
      noValidate
      className="space-y-3 text-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (!error) onConfirm(settledOn);
      }}
    >
      <dl className="grid grid-cols-[5rem_1fr] gap-y-1 text-muted-foreground">
        <dt>거래처</dt>
        <dd className="text-foreground">{request.partnerName || "(새 행)"}</dd>
        {request.amount && (
          <>
            <dt>잔액</dt>
            <dd className="text-foreground tabular-nums">
              {formatWon(request.amount)}
            </dd>
          </>
        )}
      </dl>
      <div>
        <label htmlFor="ledger-settle-date" className="mb-1 block font-medium">
          수금 완료일 <span className="text-destructive">*</span>
        </label>
        <input
          id="ledger-settle-date"
          type="date"
          autoFocus
          max={today}
          value={settledOn}
          onChange={(e) => setSettledOn(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "ledger-settle-err" : undefined}
          className={fieldClass}
        />
        <FieldError id="ledger-settle-err" message={error} />
        <p className="mt-1 text-xs text-muted-foreground">
          확인 후 행의 [저장]을 눌러야 저장됩니다.
        </p>
      </div>
      <DialogButtons
        onCancel={onCancel}
        submitLabel="확인"
        pending={false}
        disabled={Boolean(error)}
      />
    </form>
  );
}
