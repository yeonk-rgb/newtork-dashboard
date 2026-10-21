"use client";
// 금액 입력칸: 숫자만, 자동 콤마, 콤마 재배치 후에도 커서 위치 유지 (월간 입력·목표 설정 공용)
import { useLayoutEffect, useRef } from "react";

import { cn } from "@/shared/lib/utils";

import { caretAfterFormat, digitsOnly, formatDigits } from "./money-input";

export function MoneyTextInput({
  id,
  digits,
  onChange,
  readOnly = false,
  invalid = false,
  placeholder = "0",
  describedBy,
  "aria-label": ariaLabel,
}: {
  id: string;
  /** 콤마 없는 숫자 문자열 ("" = 빈칸) */
  digits: string;
  onChange: (digits: string) => void;
  readOnly?: boolean;
  /** 경고 테두리 */
  invalid?: boolean;
  placeholder?: string;
  describedBy?: string;
  "aria-label"?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);

  // 콤마를 다시 넣은 뒤 커서를 입력하던 숫자 뒤로
  useLayoutEffect(() => {
    if (caret.current !== null && ref.current === document.activeElement) {
      ref.current?.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  });

  return (
    <div className="relative">
      <input
        ref={ref}
        id={id}
        data-entry-input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        readOnly={readOnly}
        value={formatDigits(digits)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        aria-describedby={describedBy}
        onChange={(e) => {
          const el = e.target;
          const before = el.value.slice(
            0,
            el.selectionStart ?? el.value.length,
          );
          const next = digitsOnly(el.value);
          caret.current = caretAfterFormat(
            formatDigits(next),
            Math.min(before.replace(/\D/g, "").length, next.length),
          );
          onChange(next);
        }}
        className={cn(
          "h-9 w-full rounded-lg border border-input bg-background pr-7 pl-2 text-right tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          readOnly && "bg-muted/50 text-muted-foreground",
          invalid && "border-warning/70",
        )}
      />
      <span className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 text-xs text-muted-foreground">
        원
      </span>
    </div>
  );
}
