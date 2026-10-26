"use client";
// 입력용 모달 (네이티브 <dialog> — 포커스 가두기·Esc 닫기를 브라우저가 처리)
import { useEffect, useRef } from "react";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  cardTitleClass,
} from "@/shared/ui/styles";

export function Modal({
  open,
  onClose,
  title,
  titleId,
  wide,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  titleId: string;
  /** 표가 들어가는 미리보기 (기본 32rem → 48rem) */
  wide?: boolean;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={titleId}
      className={`m-auto ${wide ? "w-[min(48rem,calc(100vw-2rem))]" : "w-[min(32rem,calc(100vw-2rem))]"} rounded-card border bg-card p-6 text-card-foreground backdrop:bg-black/30`}
    >
      {open && (
        <>
          <h2 id={titleId} className={cardTitleClass}>
            {title}
          </h2>
          <div className="mt-4">{children}</div>
        </>
      )}
    </dialog>
  );
}

export const fieldClass =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 aria-invalid:border-destructive";

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-xs text-destructive">
      {message}
    </p>
  );
}

export function DialogButtons({
  onCancel,
  submitLabel,
  pending,
  disabled,
}: {
  onCancel: () => void;
  submitLabel: string;
  pending: boolean;
  disabled?: boolean;
}) {
  return (
    <div className="mt-6 flex justify-end gap-2">
      <button type="button" onClick={onCancel} className={buttonSecondaryClass}>
        취소
      </button>
      <button
        type="submit"
        disabled={pending || disabled}
        className={buttonPrimaryClass}
      >
        {pending ? "저장 중…" : submitLabel}
      </button>
    </div>
  );
}
