"use client";
// 임시 비밀번호 1회 표시 (닫으면 다시 볼 수 없다 — DB에는 해시만 있음)
import { useEffect, useRef, useState } from "react";

export function TempPasswordDialog({
  value,
  onClose,
}: {
  value: { title: string; password: string } | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (value && !dialog.open) dialog.showModal();
    if (!value && dialog.open) dialog.close();
    setCopied(false);
  }, [value]);

  const copy = async () => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value.password);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby="temp-password-title"
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-lg border bg-card p-5 text-card-foreground shadow-lg backdrop:bg-black/30"
    >
      {value && (
        <>
          <h2 id="temp-password-title" className="text-base font-semibold">
            {value.title}
          </h2>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 rounded-md border bg-muted px-3 py-2 font-mono text-lg tracking-wider select-all">
              {value.password}
            </code>
            <button
              type="button"
              onClick={copy}
              className="rounded-md border bg-background px-3 py-2 text-sm hover:bg-muted"
            >
              {copied ? "복사됨" : "복사"}
            </button>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            이 창을 닫으면 다시 볼 수 없습니다. 직원에게 직접 전달하세요. 직원은
            이 비밀번호로 로그인한 뒤 새 비밀번호로 바꾸게 됩니다.
          </p>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              autoFocus
              onClick={onClose}
              className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground hover:bg-primary/90"
            >
              확인했습니다
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
