"use client";
// 출장보고서 [숨김]/[복구] — 친구 앱 [삭제] 자리 (삭제 대신 숨김, 첨부도 함께 목록에서 빠짐)
import { useState, useTransition } from "react";

import { buttonDangerClass, buttonSecondaryClass } from "@/shared/ui/styles";

import { hideReport, restoreReport } from "./actions";

export function HideReportButton({
  id,
  hidden,
  canHide,
}: {
  id: string;
  hidden: boolean;
  canHide: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (fn: typeof hideReport) =>
    startTransition(async () => {
      const r = await fn(id);
      setMessage(r.ok ? r.message : r.message);
      setConfirming(false);
    });

  if (hidden) {
    return (
      <span className="flex items-center gap-2 text-sm">
        {message && <span role="status">{message}</span>}
        <button
          type="button"
          disabled={!canHide || pending}
          title={canHide ? undefined : "열람 전용 — 복구는 팀장만"}
          onClick={() => run(restoreReport)}
          className={buttonSecondaryClass}
        >
          복구
        </button>
      </span>
    );
  }
  if (confirming) {
    return (
      <span className="flex items-center gap-2 text-sm">
        목록·집계에서 빠집니다(첨부 포함). 숨길까요?
        <button
          type="button"
          disabled={pending}
          onClick={() => run(hideReport)}
          className={buttonDangerClass}
        >
          숨김
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className={buttonSecondaryClass}
        >
          아니요
        </button>
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2 text-sm">
      {message && <span role="alert">{message}</span>}
      <button
        type="button"
        disabled={!canHide}
        title={canHide ? undefined : "열람 전용 — 숨기기는 팀장만"}
        onClick={() => setConfirming(true)}
        className={buttonDangerClass}
      >
        숨김
      </button>
    </span>
  );
}
