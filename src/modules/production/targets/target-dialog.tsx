"use client";
// [목표 설정] 버튼 + 창 — 연간 목표 1개 + 월별 목표 12개 (친구 저장소 TargetModal 그대로). 비운 칸 = 미입력
import { useId, useState, useTransition } from "react";

import { cn } from "@/shared/lib/utils";
import {
  DialogButtons,
  FieldError,
  Modal,
  fieldClass,
} from "@/shared/ui/modal";
import { buttonPrimaryClass } from "@/shared/ui/styles";

import { saveTargets } from "./actions";

const toValue = (v: string) => (v.trim() === "" ? null : Number(v));

export function TargetDialog({
  year,
  annual,
  monthly,
  canEdit,
  label = "목표 설정",
  variant = "button",
}: {
  year: number;
  annual: number | null;
  monthly: (number | null)[];
  canEdit: boolean;
  label?: string;
  variant?: "button" | "link";
}) {
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    annual: "",
    monthly: Array<string>(12).fill(""),
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const openDialog = () => {
    setForm({
      annual: annual?.toString() ?? "",
      monthly: monthly.map((v) => v?.toString() ?? ""),
    });
    setError(null);
    setOpen(true);
  };
  const filled = form.monthly.filter((v) => v.trim() !== "").length;
  const sum = form.monthly.reduce((n, v) => n + (toValue(v) ?? 0), 0);
  const mismatch =
    filled === 12 &&
    toValue(form.annual) !== null &&
    sum !== toValue(form.annual);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const values = [form.annual, ...form.monthly].map(toValue);
    if (values.some((v) => v !== null && (!Number.isInteger(v) || v < 0))) {
      setError("목표는 0 이상 정수로 입력하세요.");
      return;
    }
    startTransition(async () => {
      const result = await saveTargets({
        year,
        annual: values[0],
        monthly: values.slice(1),
      });
      if (result.ok) setOpen(false);
      else setError(result.message);
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        disabled={!canEdit}
        title={canEdit ? undefined : "열람 전용 — 목표 설정은 팀장만"}
        className={
          variant === "link"
            ? "text-left text-xs text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
            : buttonPrimaryClass
        }
      >
        {label}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`${year}년 목표 생산량 설정`}
        titleId={titleId}
        wide
      >
        <form onSubmit={submit} noValidate>
          <label className="block max-w-60 text-sm">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">
              연간 목표
            </span>
            <input
              inputMode="numeric"
              value={form.annual}
              placeholder="미입력"
              onChange={(e) => setForm({ ...form, annual: e.target.value })}
              className={fieldClass}
            />
          </label>
          <p className="mt-4 mb-1 text-xs font-medium text-muted-foreground">
            월별 목표{" "}
            <span className="font-normal">
              (비워 두면 미입력 · 분기 목표는 3개월이 모두 입력됐을 때만 계산)
            </span>
          </p>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {form.monthly.map((v, i) => (
              <label key={i} className="text-sm">
                <span className="mb-1 block text-xs text-muted-foreground">
                  {i + 1}월
                </span>
                <input
                  inputMode="numeric"
                  aria-label={`${i + 1}월 목표`}
                  value={v}
                  placeholder="-"
                  onChange={(e) =>
                    setForm({
                      ...form,
                      monthly: form.monthly.map((x, j) =>
                        j === i ? e.target.value : x,
                      ),
                    })
                  }
                  className={cn(fieldClass, "h-9")}
                />
              </label>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            월별 목표 합계 {sum.toLocaleString("ko-KR")} ({filled}/12개월 입력)
            {mismatch && (
              <span className="text-warning-strong">
                {" "}
                · 연간 목표와 월별 합계가 다릅니다. 저장은 할 수 있습니다.
              </span>
            )}
          </p>
          <FieldError id={`${titleId}-error`} message={error ?? undefined} />
          <DialogButtons
            onCancel={() => setOpen(false)}
            submitLabel="저장"
            pending={pending}
          />
        </form>
      </Modal>
    </>
  );
}
