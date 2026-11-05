"use client";
// 부품 추가 (수기 입력) — 2026-11-05 담당자 피드백: 신규 부품이 생기면 분류·파트넘버·품목·적용 모델·기준단가를 입력해 저장
import Link from "next/link";
import { useState, useTransition } from "react";

import { cn } from "@/shared/lib/utils";
import {
  buttonPrimaryClass,
  cardTitleClass,
  labelClass,
} from "@/shared/ui/styles";

import { createPriceItem } from "./actions";

const EMPTY = {
  category: "",
  partNo: "",
  name: "",
  appliesTo: "",
  basePrice: "",
};
type Field = keyof typeof EMPTY;

const FIELDS: {
  key: Field;
  label: string;
  placeholder: string;
  required?: boolean;
  span: string;
}[] = [
  {
    key: "category",
    label: "분류",
    placeholder: "예: 05 MOTOR",
    span: "md:col-span-3",
  },
  {
    key: "partNo",
    label: "파트넘버",
    placeholder: "예: MD-05-A-01",
    required: true,
    span: "md:col-span-3",
  },
  {
    key: "name",
    label: "품목",
    placeholder: "예: Motor excl. rotor",
    required: true,
    span: "md:col-span-6",
  },
  {
    key: "appliesTo",
    label: "적용 모델",
    placeholder: "예: NTI-01 ~ 03",
    span: "md:col-span-6",
  },
  {
    key: "basePrice",
    label: "기준단가 (원, 부가세 제외)",
    placeholder: "비우면 미입력",
    span: "md:col-span-6",
  },
];

export function NewItemForm({
  canEdit,
  categories,
}: {
  canEdit: boolean;
  categories: string[];
}) {
  const [v, setV] = useState(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const r = await createPriceItem(v);
      setMessage({ ok: r.ok, text: r.message });
      setErrors(r.errors ?? {});
      if (r.ok) setV({ ...EMPTY, category: v.category });
    });
  };

  return (
    <form
      onSubmit={submit}
      className="space-y-4 rounded-card border bg-card p-6"
    >
      <div>
        <h2 className={cardTitleClass}>부품 직접 추가</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          단가표에 없는 새 부품을 한 개씩 등록합니다. 이미 있는 부품의 기준값은{" "}
          <Link
            href="/service/unit-prices"
            className="text-primary hover:underline"
          >
            부품별 비교
          </Link>
          에서 두 번 눌러 고치세요.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
        {FIELDS.map((f) => (
          <label key={f.key} className={cn("space-y-1", f.span)}>
            <span className={labelClass}>
              {f.label}
              {f.required && <span className="text-destructive"> *</span>}
            </span>
            <input
              value={v[f.key]}
              disabled={!canEdit}
              list={f.key === "category" ? "unit-price-categories" : undefined}
              inputMode={f.key === "basePrice" ? "numeric" : undefined}
              onChange={(e) => {
                let value = e.target.value;
                if (f.key === "basePrice") {
                  const digits = value.replace(/[^\d]/g, "");
                  value = digits ? Number(digits).toLocaleString("ko-KR") : "";
                }
                setV({ ...v, [f.key]: value });
              }}
              aria-invalid={!!errors[f.key]}
              placeholder={f.placeholder}
              className={cn(
                "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm disabled:bg-muted aria-invalid:border-destructive",
                f.key === "basePrice" && "text-right tabular-nums",
              )}
            />
            {errors[f.key] && (
              <span className="block text-xs text-destructive">
                {errors[f.key]}
              </span>
            )}
          </label>
        ))}
      </div>
      <datalist id="unit-price-categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!canEdit || pending}
          className={buttonPrimaryClass}
        >
          저장
        </button>
        {message && (
          <p
            role={message.ok ? "status" : "alert"}
            className={cn(
              "rounded-lg px-3 py-2 text-sm",
              message.ok
                ? "bg-primary-50 text-primary"
                : "bg-danger-soft text-danger-strong",
            )}
          >
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}
