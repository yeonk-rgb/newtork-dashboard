"use client";
// 입력용 모달 (네이티브 <dialog> — 포커스 가두기·Esc 닫기를 브라우저가 처리)
import { useEffect, useRef } from "react";

export function Modal({
  open,
  onClose,
  title,
  titleId,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  titleId: string;
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
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-lg border bg-card p-5 text-card-foreground shadow-lg backdrop:bg-black/30"
    >
      {open && (
        <>
          <h2 id={titleId} className="text-base font-semibold">
            {title}
          </h2>
          <div className="mt-3">{children}</div>
        </>
      )}
    </dialog>
  );
}

export const fieldClass =
  "h-9 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 aria-invalid:border-destructive";

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-0.5 text-xs text-destructive">
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
    <div className="mt-5 flex justify-end gap-2">
      <button
        type="button"
        onClick={onCancel}
        className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
      >
        취소
      </button>
      <button
        type="submit"
        disabled={pending || disabled}
        className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
      >
        {pending ? "저장 중…" : submitLabel}
      </button>
    </div>
  );
}
