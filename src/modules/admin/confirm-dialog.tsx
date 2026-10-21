"use client";
// 확인창 (경영지원 entry/confirm-dialog.tsx 와 같은 모양 — 모듈 간 import 금지라 복사) (네이티브 <dialog> — 포커스 가두기·Esc 닫기를 브라우저가 처리)
import { useEffect, useRef } from "react";
import {
  buttonDangerSolidClass,
  buttonPrimaryClass,
  buttonSecondaryClass,
  cardTitleClass,
} from "@/shared/ui/styles";

export type ConfirmRequest = {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  tone?: "default" | "danger";
  onConfirm: () => void;
};

export function ConfirmDialog({
  request,
  onClose,
}: {
  request: ConfirmRequest | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (request && !dialog.open) dialog.showModal();
    if (!request && dialog.open) dialog.close();
  }, [request]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="confirm-title"
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-card border bg-card p-6 text-card-foreground backdrop:bg-black/30"
    >
      {request && (
        <>
          <h2 id="confirm-title" className={cardTitleClass}>
            {request.title}
          </h2>
          <div className="mt-2 text-sm text-muted-foreground">
            {request.body}
          </div>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              autoFocus
              onClick={onClose}
              className={buttonSecondaryClass}
            >
              돌아가기
            </button>
            <button
              type="button"
              onClick={() => {
                request.onConfirm();
                onClose();
              }}
              className={
                request.tone === "danger"
                  ? buttonDangerSolidClass
                  : buttonPrimaryClass
              }
            >
              {request.confirmLabel}
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
