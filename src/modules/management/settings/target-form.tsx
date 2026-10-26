"use client";
// 연간 목표 + 분기 목표(선택) + 직원 수(선택, 인당 생산성). 빈 분기 자동 배분 실시간 미리보기, 합계 불일치 경고
import { CircleAlert, CircleCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { cn } from "@/shared/lib/utils";

import { ConfirmDialog, type ConfirmRequest } from "../entry/confirm-dialog";
import { digitsToBigInt, formatDigits } from "../entry/money-input";
import { MoneyTextInput } from "../entry/money-text-input";
import { LEAVE_MESSAGE, useUnsavedGuard } from "../entry/use-unsaved-guard";
import { allocateQuarterTargets } from "../metrics/targets";
import { saveAnnualTarget, type SettingsActionResult } from "./actions";
import type { TargetData } from "./load-settings";
import {
  buttonPrimaryClass,
  cardTitleClass,
  labelClass,
} from "@/shared/ui/styles";

const won = (v: bigint) => `${formatDigits(v.toString())}원`;

const WARNING_TEXT = {
  QUARTER_SUM_MISMATCH: "분기 목표 4개의 합계가 연간 목표와 다릅니다.",
  QUARTER_SUM_EXCEEDS_ANNUAL:
    "입력한 분기 목표 합계가 연간 목표보다 커서 빈 분기는 0원이 됩니다.",
} as const;

export function TargetForm({
  data,
  years,
}: {
  data: TargetData;
  years: number[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [annual, setAnnual] = useState(data.revenueTarget);
  const [quarters, setQuarters] = useState(data.quarters);
  const [headcount, setHeadcount] = useState(data.headcount);
  const [baseline, setBaseline] = useState(
    JSON.stringify([data.revenueTarget, data.quarters, data.headcount]),
  );
  const [loadedAt, setLoadedAt] = useState(data.updatedAt);
  const [result, setResult] = useState<SettingsActionResult | null>(null);
  const [dialog, setDialog] = useState<ConfirmRequest | null>(null);

  // 저장 후 새 값이 오면 맞춘다 (동시 수정 확인 기준 갱신)
  if (data.updatedAt !== loadedAt) {
    setLoadedAt(data.updatedAt);
    setAnnual(data.revenueTarget);
    setQuarters(data.quarters);
    setHeadcount(data.headcount);
    setBaseline(
      JSON.stringify([data.revenueTarget, data.quarters, data.headcount]),
    );
  }
  const dirty = JSON.stringify([annual, quarters, headcount]) !== baseline;
  useUnsavedGuard(dirty);

  const annualValue = digitsToBigInt(annual);
  const preview =
    annualValue > 0n
      ? allocateQuarterTargets({
          year: data.year,
          revenueTarget: annualValue,
          quarterTargets: quarters.map((q) =>
            q === "" ? null : BigInt(q),
          ) as [bigint | null, bigint | null, bigint | null, bigint | null],
        })
      : null;
  const previewSum = preview
    ? preview.quarters.reduce((a, b) => a + b, 0n)
    : 0n;

  const save = () => {
    setResult(null);
    startTransition(async () => {
      const res = await saveAnnualTarget({
        year: data.year,
        revenueTarget: annual,
        quarters,
        headcount,
        expectedUpdatedAt: data.updatedAt,
      });
      setResult(res);
      if (res.ok) router.refresh();
    });
  };

  const onSave = () => {
    if (preview?.warning) {
      setDialog({
        title: "분기 목표를 확인하세요",
        body: <p>{WARNING_TEXT[preview.warning]} 그대로 저장할까요?</p>,
        confirmLabel: "그대로 저장",
        onConfirm: save,
      });
    } else {
      save();
    }
  };

  return (
    <section className="space-y-4 rounded-card border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={cardTitleClass}>
          {data.year}년 목표{" "}
          <span className="font-normal text-muted-foreground">
            ({data.updatedAt ? "설정됨" : "아직 설정되지 않음"})
          </span>
        </h2>
        <label className="flex items-center gap-2 text-sm">
          <span className="sr-only">연도</span>
          <select
            className="h-10 rounded-lg border border-input bg-background px-3 hover:bg-primary-50"
            value={data.year}
            onChange={(e) => {
              if (dirty && !window.confirm(LEAVE_MESSAGE)) return;
              router.push(`/management/targets?year=${e.target.value}`);
            }}
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid max-w-md grid-cols-[8rem_1fr] items-center gap-3">
        <label htmlFor="target-annual" className="text-sm font-medium">
          연간 목표매출액
        </label>
        <MoneyTextInput
          id="target-annual"
          digits={annual}
          onChange={setAnnual}
          placeholder="필수"
        />
        <label htmlFor="target-headcount" className="text-sm font-medium">
          직원 수
        </label>
        <div className="flex items-center gap-2">
          <input
            id="target-headcount"
            inputMode="numeric"
            autoComplete="off"
            value={headcount}
            onChange={(e) =>
              setHeadcount(e.target.value.replace(/\D/g, "").slice(0, 4))
            }
            placeholder="선택"
            aria-describedby="target-headcount-help"
            className="h-10 w-24 rounded-lg border border-input bg-background px-3 text-right tabular-nums outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          />
          <span className="text-sm">명</span>
        </div>
        <p
          id="target-headcount-help"
          className="col-span-2 -mt-1 text-xs text-muted-foreground"
        >
          직원 수는 경영지원 상세의 인당 생산성(매출 ÷ 인원, 추정 이익 ÷ 인원)에
          씁니다. 비우면 표시하지 않습니다.
        </p>
      </div>

      <div>
        <h3 className={labelClass}>
          분기 목표{" "}
          <span className="font-normal">(선택 — 비우면 자동 배분)</span>
        </h3>
        <div className="mt-2 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {quarters.map((q, i) => (
            <div key={i} className="rounded-lg border p-3">
              <label
                htmlFor={`target-q${i + 1}`}
                className="text-xs text-muted-foreground"
              >
                {i + 1}분기
              </label>
              <MoneyTextInput
                id={`target-q${i + 1}`}
                digits={q}
                placeholder="자동"
                onChange={(v) =>
                  setQuarters(
                    (s) => s.map((x, j) => (j === i ? v : x)) as typeof s,
                  )
                }
              />
              <p className="mt-1 text-xs tabular-nums">
                {preview ? (
                  q === "" ? (
                    <span className="text-muted-foreground">
                      자동 배분 {won(preview.quarters[i])}
                    </span>
                  ) : (
                    <span>직접 입력</span>
                  )
                ) : (
                  <span className="text-muted-foreground">
                    연간 목표를 먼저 입력하세요
                  </span>
                )}
              </p>
            </div>
          ))}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          빈 분기 = (연간 − 입력한 분기 합) ÷ 빈 분기 수, 나누어떨어지지 않는 원
          단위는 마지막 빈 분기에 더합니다.
        </p>
      </div>

      {preview && (
        <p
          role="status"
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-3 text-sm",
            preview.warning
              ? "bg-warning-soft text-warning-strong"
              : "bg-muted",
          )}
        >
          {preview.warning ? (
            <CircleAlert className="size-4 shrink-0" aria-hidden />
          ) : (
            <CircleCheck className="size-4 shrink-0" aria-hidden />
          )}
          분기 합계{" "}
          <span className="font-semibold tabular-nums">{won(previewSum)}</span>
          {preview.warning ? (
            <> · {WARNING_TEXT[preview.warning]}</>
          ) : (
            <> = 연간 목표</>
          )}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={pending || !dirty || annualValue === 0n}
          onClick={onSave}
          className={buttonPrimaryClass}
        >
          저장
        </button>
        {dirty && (
          <span className="text-xs text-warning-strong">
            저장하지 않은 변경 있음
          </span>
        )}
        {result && (
          <span
            role={result.ok ? "status" : "alert"}
            className={cn("text-sm", !result.ok && "text-destructive")}
          >
            {result.message}
            {!result.ok && result.code === "CONFLICT" && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="ml-2 underline"
              >
                새로고침
              </button>
            )}
          </span>
        )}
      </div>

      <ConfirmDialog request={dialog} onClose={() => setDialog(null)} />
    </section>
  );
}
