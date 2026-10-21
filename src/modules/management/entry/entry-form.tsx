"use client";
// 월간 실적 입력 폼 — 목표: 월말 5분 입력
// - 숫자만·자동 콤마·커서 유지 / Enter = 다음 칸 (마지막 칸에서도 저장하지 않음, 저장은 버튼으로만)
// - 소계·합계 실시간 / 전월 값 + 자릿수 실수(10배·1/10) 경고 / 저장 안 하고 나갈 때 경고
import { CircleAlert, CircleCheck, Info, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";

import { cn } from "@/shared/lib/utils";

import {
  saveMonthlyEntry,
  unconfirmMonthlyEntry,
  type EntryActionResult,
} from "./actions";
import { ConfirmDialog, type ConfirmRequest } from "./confirm-dialog";
import {
  browserStorage,
  draftKey,
  parseDraft,
  readRawDraft,
  removeDraft,
  subscribeStorage,
  writeDraft,
} from "./draft-storage";
import { FIELD_HELP, FIELD_LABEL, OTHER_EXPENSE_HELP } from "./field-help";
import type { EntryData } from "./load-entry";
import { digitsToBigInt, formatDigits } from "./money-input";
import { MoneyTextInput } from "./money-text-input";
import { isDigitAnomaly, type EntryAbilities } from "./rules";
import type { EntryField } from "./schemas";
import { LEAVE_MESSAGE, useUnsavedGuard } from "./use-unsaved-guard";

const SECTIONS: { title: string; fields: EntryField[] }[] = [
  { title: "매출", fields: ["productSales", "goodsSales", "serviceSales"] },
  { title: "매입", fields: ["goodsPurchase", "materialPurchase"] },
  { title: "경비", fields: ["operatingExpense"] },
];

const STATUS_TEXT = {
  NEW: "새로 입력",
  DRAFT: "임시저장",
  CONFIRMED: "확정",
} as const;

const kst = (iso: string) =>
  new Date(iso).toLocaleString("ko-KR", {
    timeZone: "Asia/Seoul",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
const won = (v: bigint) => `${formatDigits(v.toString())}원`;
const sum = (values: string[]) =>
  values.reduce((acc, v) => acc + digitsToBigInt(v), 0n);

function HelpTip({ id, text }: { id: string; text: string }) {
  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        tabIndex={-1}
        aria-describedby={id}
        className="rounded-full text-muted-foreground hover:text-foreground focus-visible:text-foreground"
      >
        <Info className="size-3.5" aria-hidden />
        <span className="sr-only">입력 안내</span>
      </button>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none absolute top-5 left-0 z-20 hidden w-64 rounded-lg border bg-popover p-2 text-xs leading-relaxed text-popover-foreground shadow-sm group-focus-within:block group-hover:block"
      >
        {text}
      </span>
    </span>
  );
}

function AmountInput({
  id,
  label,
  help,
  digits,
  previous,
  readOnly,
  inactive,
  onChange,
}: {
  id: string;
  label: string;
  help: string;
  digits: string;
  previous: string | null;
  readOnly: boolean;
  inactive?: boolean;
  onChange: (digits: string) => void;
}) {
  const anomaly =
    digits !== "" &&
    isDigitAnomaly(
      digitsToBigInt(digits),
      previous === null ? null : digitsToBigInt(previous),
    );

  return (
    <div className="grid grid-cols-[minmax(7rem,9rem)_1fr] items-start gap-x-3 gap-y-1 py-1.5 sm:grid-cols-[9rem_14rem_1fr] sm:items-center">
      <label
        htmlFor={id}
        className="flex items-center gap-1 pt-1.5 text-sm sm:pt-0"
      >
        {label}
        {inactive && (
          <span className="text-xs text-muted-foreground">(비활성)</span>
        )}
        <HelpTip id={`${id}-help`} text={help} />
      </label>
      <MoneyTextInput
        id={id}
        digits={digits}
        onChange={onChange}
        readOnly={readOnly}
        invalid={anomaly}
        describedBy={anomaly ? `${id}-warn` : undefined}
      />
      <div className="col-start-2 text-xs text-muted-foreground sm:col-start-3">
        전월 {previous === null ? "데이터 없음" : won(digitsToBigInt(previous))}
        {anomaly && (
          <span
            id={`${id}-warn`}
            className="ml-2 inline-flex items-center gap-1 font-medium text-warning-strong"
          >
            <TriangleAlert className="size-3.5" aria-hidden />
            전월의 10배 이상이거나 1/10 이하 — 자릿수를 확인하세요
          </span>
        )}
      </div>
    </div>
  );
}

export function EntryForm({
  userId,
  data,
  abilities,
  years,
  maxMonthIndex,
}: {
  /** 임시 보관 키에 사용 (사용자 전환 시 섞이지 않게) */
  userId: string;
  data: EntryData;
  abilities: EntryAbilities;
  years: number[];
  /** 입력 가능한 마지막 달 (year*12 + month-1) — 미래 달 선택 막기 */
  maxMonthIndex: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const initialOther = () =>
    Object.fromEntries(
      data.categories.map((c) => [c.id, data.otherExpenses[c.id] ?? ""]),
    );
  const [values, setValues] = useState(data.values);
  const [other, setOther] = useState<Record<string, string>>(initialOther);
  const [baseline, setBaseline] = useState(() =>
    JSON.stringify({ values: data.values, other: initialOther() }),
  );
  const [loadedAt, setLoadedAt] = useState(data.updatedAt);
  const [result, setResult] = useState<EntryActionResult | null>(null);
  const [dialog, setDialog] = useState<ConfirmRequest | null>(null);

  // 저장 후 서버 값이 새로 오면(updatedAt 변경) 폼을 그 값으로 맞춘다 — 다음 저장의 동시 수정 확인 기준도 갱신
  if (data.updatedAt !== loadedAt) {
    const nextOther = initialOther();
    setLoadedAt(data.updatedAt);
    setValues(data.values);
    setOther(nextOther);
    setBaseline(JSON.stringify({ values: data.values, other: nextOther }));
  }
  const dirty = JSON.stringify({ values, other }) !== baseline;
  const readOnly = abilities.readOnly;

  useUnsavedGuard(dirty);

  // ---- 브라우저 임시 보관 (뒤로 가기로 나가도 입력이 사라지지 않게) ----
  const draftStorageKey = draftKey(userId, data.year, data.month);
  // 서버 렌더에서는 "보관값 없음", 브라우저에서 localStorage 값 — 하이드레이션 불일치 없이 읽는다
  const rawDraft = useSyncExternalStore(
    subscribeStorage,
    () => readRawDraft(browserStorage, draftStorageKey),
    () => null,
  );
  const [draftDecided, setDraftDecided] = useState(false);
  const wroteDraft = useRef(false);
  const storedDraft = abilities.readOnly ? null : parseDraft(rawDraft);
  const currentContent = JSON.stringify({ values, other });
  // 복구 안내: 보관값이 있고, 지금 화면 값과 다르고, 아직 복구/버리기를 고르지 않았을 때
  const pendingDraft =
    !draftDecided &&
    storedDraft !== null &&
    JSON.stringify({ values: storedDraft.values, other: storedDraft.other }) !==
      currentContent
      ? storedDraft
      : null;

  // 입력이 바뀌면 보관, 다시 원래 값과 같아지면 삭제 (복구 안내에 답하기 전에는 기존 보관값을 건드리지 않음)
  useEffect(() => {
    if (abilities.readOnly || pendingDraft) return;
    if (dirty) {
      wroteDraft.current = writeDraft(browserStorage, draftStorageKey, {
        v: 1,
        values,
        other,
        baseUpdatedAt: data.updatedAt,
        savedAt: new Date().toISOString(),
      });
    } else if (wroteDraft.current) {
      removeDraft(browserStorage, draftStorageKey);
      wroteDraft.current = false;
    }
  }, [
    abilities.readOnly,
    pendingDraft,
    dirty,
    values,
    other,
    data.updatedAt,
    draftStorageKey,
  ]);

  const restoreDraft = () => {
    if (!pendingDraft) return;
    const known = new Set(data.categories.map((c) => c.id));
    setValues(pendingDraft.values);
    setOther((current) => ({
      ...current,
      ...Object.fromEntries(
        Object.entries(pendingDraft.other).filter(([id]) => known.has(id)),
      ),
    }));
    setDraftDecided(true);
  };
  const discardDraft = () => {
    removeDraft(browserStorage, draftStorageKey);
    setDraftDecided(true);
  };

  // Enter = 다음 칸 (마지막 칸이면 그대로 — 저장은 버튼으로만)
  const onKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key !== "Enter" || !(e.target instanceof HTMLInputElement)) return;
    e.preventDefault();
    const inputs = Array.from(
      e.currentTarget.querySelectorAll<HTMLInputElement>("[data-entry-input]"),
    );
    inputs[inputs.indexOf(e.target) + 1]?.focus();
  };

  const goMonth = (year: number, month: number) => {
    if (dirty && !window.confirm(LEAVE_MESSAGE)) return;
    router.push(
      `/management/entry?month=${year}-${String(month).padStart(2, "0")}`,
    );
  };

  // 합계
  const revenue = sum(SECTIONS[0].fields.map((f) => values[f]));
  const purchase = sum(SECTIONS[1].fields.map((f) => values[f]));
  const operating = sum(SECTIONS[2].fields.map((f) => values[f]));
  const otherTotal = sum(Object.values(other));
  const expense = purchase + operating + otherTotal;
  const profit = revenue - expense;
  const margin =
    revenue === 0n ? null : (Number(profit) / Number(revenue)) * 100;

  const zeroLabels = [
    ...(Object.keys(FIELD_LABEL) as EntryField[])
      .filter((f) => digitsToBigInt(values[f]) === 0n)
      .map((f) => FIELD_LABEL[f]),
    ...data.categories
      .filter((c) => digitsToBigInt(other[c.id] ?? "") === 0n)
      .map((c) => c.name),
  ];

  const payload = (intent: "draft" | "confirm" | "update-confirmed") => ({
    year: data.year,
    month: data.month,
    intent,
    values,
    otherExpenses: data.categories.map((c) => ({
      categoryId: c.id,
      amount: other[c.id] ?? "",
    })),
    expectedUpdatedAt: data.updatedAt,
  });

  const run = (action: () => Promise<EntryActionResult>) => {
    setResult(null);
    startTransition(async () => {
      const res = await action();
      setResult(res);
      // 성공하면 Server Action 의 refresh() 로 새 값(updatedAt)이 내려와 위에서 폼이 맞춰진다
      if (res.ok) {
        removeDraft(browserStorage, draftStorageKey);
        wroteDraft.current = false;
        router.refresh();
      }
    });
  };

  const zeroNote =
    zeroLabels.length > 0 ? (
      <p className="mt-2">
        <span className="font-medium text-foreground">
          0원인 항목 {zeroLabels.length}개
        </span>
        가 있습니다 ({zeroLabels.join(", ")}). 맞나요?
      </p>
    ) : null;

  const onConfirm = () => {
    setDialog({
      title: `${data.year}년 ${data.month}월을 확정할까요?`,
      body: (
        <>
          <p>
            확정하면 대시보드 집계에 반영되고, 팀원은 더 이상 수정할 수
            없습니다.
          </p>
          {zeroNote}
        </>
      ),
      confirmLabel: "확정",
      onConfirm: () => run(() => saveMonthlyEntry(payload("confirm"))),
    });
  };

  const onUpdateConfirmed = () => {
    setDialog({
      title: "확정된 데이터를 수정합니다",
      body: (
        <>
          <p>
            확정 상태를 유지한 채 값을 바꿉니다. 대시보드 수치가 바로 바뀝니다.
          </p>
          {zeroNote}
        </>
      ),
      confirmLabel: "수정 저장",
      onConfirm: () => run(() => saveMonthlyEntry(payload("update-confirmed"))),
    });
  };

  const onUnconfirm = () => {
    setDialog({
      title: `${data.year}년 ${data.month}월 확정을 취소할까요?`,
      body: (
        <p>
          임시저장 상태로 바뀌고 대시보드 집계에서 빠집니다. 취소한 사람과
          시각이 기록됩니다.
          {dirty && " 아직 저장하지 않은 입력은 반영되지 않습니다."}
        </p>
      ),
      confirmLabel: "확정 취소",
      tone: "danger",
      onConfirm: () =>
        run(() =>
          unconfirmMonthlyEntry({
            year: data.year,
            month: data.month,
            expectedUpdatedAt: data.updatedAt!,
          }),
        ),
    });
  };

  const selectClass =
    "h-8 rounded-lg border border-input bg-background px-2 text-sm";
  const yearMonthIndex = (y: number, m: number) => y * 12 + (m - 1);

  return (
    <>
      <form
        onSubmit={(e) => e.preventDefault()}
        onKeyDown={onKeyDown}
        className="space-y-5 pb-28"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">월간 실적 입력</h1>
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="entry-year">
              연도
            </label>
            <select
              id="entry-year"
              className={selectClass}
              value={data.year}
              onChange={(e) => {
                const y = Number(e.target.value);
                const m =
                  yearMonthIndex(y, data.month) > maxMonthIndex
                    ? (maxMonthIndex % 12) + 1
                    : data.month;
                goMonth(y, m);
              }}
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}년
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor="entry-month">
              월
            </label>
            <select
              id="entry-month"
              className={selectClass}
              value={data.month}
              onChange={(e) => goMonth(data.year, Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option
                  key={m}
                  value={m}
                  disabled={yearMonthIndex(data.year, m) > maxMonthIndex}
                >
                  {m}월
                </option>
              ))}
            </select>
          </div>
        </div>

        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border bg-card px-3 py-2 text-sm">
          <span
            className={cn(
              "rounded-full px-2.5 py-0.5 text-xs font-medium",
              data.status === "CONFIRMED"
                ? "bg-primary text-primary-foreground"
                : "border",
            )}
          >
            {STATUS_TEXT[data.status]}
          </span>
          {data.year}년 {data.month}월
          {data.updatedAt && (
            <span className="text-xs text-muted-foreground">
              · 마지막 저장 {data.updatedByName}, {kst(data.updatedAt)}
              {data.confirmedAt && ` · 확정 ${kst(data.confirmedAt)}`}
            </span>
          )}
        </p>

        {pendingDraft && (
          <div
            role="alert"
            className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-primary/40 bg-sidebar-accent/40 px-3 py-2 text-sm"
          >
            <Info className="size-4 shrink-0" aria-hidden />
            <span className="flex-1">
              저장하지 않은 입력이 있습니다 ({kst(pendingDraft.savedAt)} 보관).
              복구할까요?
              {pendingDraft.baseUpdatedAt !== data.updatedAt && (
                <span className="block text-xs text-muted-foreground">
                  보관 이후 이 달이 다시 저장되었습니다. 복구하면 그 내용을
                  덮어쓸 수 있으니 값을 확인한 뒤 저장하세요.
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={restoreDraft}
              className="rounded-lg bg-primary px-3 py-1 text-sm text-primary-foreground hover:bg-primary/90"
            >
              복구
            </button>
            <button
              type="button"
              onClick={discardDraft}
              className="rounded-lg border px-3 py-1 text-sm hover:bg-muted"
            >
              버리기
            </button>
          </div>
        )}

        {abilities.notice && (
          <p
            role="status"
            className="flex items-center gap-2 rounded-lg border border-warning/50 bg-warning-soft px-3 py-2 text-sm text-warning-strong"
          >
            <CircleAlert className="size-4 shrink-0" aria-hidden />
            {abilities.notice}
          </p>
        )}

        {SECTIONS.map((section) => (
          <fieldset
            key={section.title}
            className="rounded-card border bg-card px-5 py-4"
          >
            <legend className="px-1 text-sm font-semibold">
              {section.title}
            </legend>
            {section.fields.map((f) => (
              <AmountInput
                key={f}
                id={`entry-${f}`}
                label={FIELD_LABEL[f]}
                help={FIELD_HELP[f]}
                digits={values[f]}
                previous={data.previous ? data.previous.values[f] : null}
                readOnly={readOnly}
                onChange={(v) => setValues((s) => ({ ...s, [f]: v }))}
              />
            ))}
            <p className="mt-1 border-t pt-2 text-right text-sm">
              소계{" "}
              <span className="font-semibold tabular-nums">
                {won(sum(section.fields.map((f) => values[f])))}
              </span>
            </p>
          </fieldset>
        ))}

        <fieldset className="rounded-card border bg-card px-5 py-4">
          <legend className="px-1 text-sm font-semibold">그 외 지출</legend>
          {data.categories.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              사용 중인 항목이 없습니다. (목표·항목 설정에서 추가)
            </p>
          ) : (
            data.categories.map((c) => (
              <AmountInput
                key={c.id}
                id={`entry-other-${c.id}`}
                label={c.name}
                help={OTHER_EXPENSE_HELP}
                digits={other[c.id] ?? ""}
                previous={
                  data.previous
                    ? (data.previous.otherExpenses[c.id] ?? null)
                    : null
                }
                readOnly={readOnly}
                inactive={c.inactive}
                onChange={(v) => setOther((s) => ({ ...s, [c.id]: v }))}
              />
            ))
          )}
          <p className="mt-1 border-t pt-2 text-right text-sm">
            소계{" "}
            <span className="font-semibold tabular-nums">
              {won(otherTotal)}
            </span>
          </p>
        </fieldset>
      </form>

      {/* 화면 아래 고정: 합계 + 저장 버튼 */}
      <div className="fixed right-0 bottom-0 left-0 z-10 border-t bg-card/95 px-4 py-3 shadow-[0_-2px_8px_rgba(0,0,0,0.05)] backdrop-blur md:left-52">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <dl className="flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums">
            <div>
              <dt className="inline text-muted-foreground">총매출 </dt>
              <dd className="inline font-semibold">{won(revenue)}</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">총지출 </dt>
              <dd className="inline font-semibold">{won(expense)}</dd>
            </div>
            <div>
              <dt className="inline text-muted-foreground">이익 </dt>
              <dd className="inline font-semibold">
                {profit < 0n ? `-${won(-profit)}` : won(profit)}
                {margin !== null && ` (${margin.toFixed(1)}%)`}
              </dd>
            </div>
            {dirty && (
              <div className="text-warning-strong">
                · 저장하지 않은 변경 있음
              </div>
            )}
          </dl>
          <div className="flex flex-wrap gap-2">
            {abilities.canUnconfirm && (
              <button
                type="button"
                disabled={pending}
                onClick={onUnconfirm}
                className="rounded-lg border border-destructive/40 px-3 py-1.5 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                확정 취소
              </button>
            )}
            {abilities.canSaveDraft && (
              <button
                type="button"
                disabled={pending}
                onClick={() => run(() => saveMonthlyEntry(payload("draft")))}
                className="rounded-lg border px-3 py-1.5 text-sm hover:bg-muted disabled:opacity-50"
              >
                임시저장
              </button>
            )}
            {abilities.canConfirm && (
              <button
                type="button"
                disabled={pending}
                onClick={onConfirm}
                className="rounded-lg bg-primary px-4 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                확정
              </button>
            )}
            {abilities.canEditConfirmed && (
              <button
                type="button"
                disabled={pending || !dirty}
                onClick={onUpdateConfirmed}
                className="rounded-lg bg-primary px-4 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                수정 저장
              </button>
            )}
          </div>
        </div>
        {result && (
          <p
            role={result.ok ? "status" : "alert"}
            className={cn(
              "mx-auto mt-2 flex max-w-6xl items-center gap-2 text-sm",
              result.ok ? "text-foreground" : "text-destructive",
            )}
          >
            {result.ok ? (
              <CircleCheck className="size-4" aria-hidden />
            ) : (
              <CircleAlert className="size-4" aria-hidden />
            )}
            {result.message}
            {!result.ok && result.code === "CONFLICT" && (
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="underline"
              >
                새로고침
              </button>
            )}
          </p>
        )}
      </div>

      <ConfirmDialog request={dialog} onClose={() => setDialog(null)} />
    </>
  );
}
