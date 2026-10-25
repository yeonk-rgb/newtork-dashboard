"use client";
// 채권·채무 엑셀 가져오기: ① 파일·기준년월 → ② 미리보기(블록 요약·총액 비교·행별 선택) → ③ 가져오기 → 결과
// 파일은 브라우저에 들고 있다가 가져오기 때 다시 보낸다 (서버가 다시 읽어 검증)
import { AlertTriangle, CheckCircle2, FileSpreadsheet } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { formatAmount } from "@/shared/format/money";
import { cn } from "@/shared/lib/utils";
import {
  buttonCompactClass,
  buttonPrimaryClass,
  buttonSecondaryClass,
  cardTitleClass,
  labelClass,
} from "@/shared/ui/styles";

import {
  AR_STATUS_LABEL,
  AR_STATUSES,
  EXPENSE_TYPE_LABEL,
  EXPENSE_TYPES,
  KIND_LABEL,
  KIND_TOTAL_LABEL,
  PURCHASE_TYPE_LABEL,
  PURCHASE_TYPES,
  type ArStatus,
  type ExpenseType,
  type PurchaseType,
} from "../labels";
import {
  importLedger,
  previewLedgerImport,
  type ImportResult,
} from "./actions";
import {
  EMPTY_CHOICES,
  finalArStatus,
  isTodoDone,
  previewTodo,
  type ImportChoices,
  type ImportMode,
  type LedgerPreview,
  type PreviewBlock,
  type PreviewRow,
  type PreviewTotal,
} from "./plan";
import {
  importFileError,
  MAX_IMPORT_BYTES,
  type ImportAbilities,
} from "./rules";

const selectClass =
  "h-8 min-w-32 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50";

export function ImportPanel({
  abilities,
  initialMonth,
  maxMonth,
}: {
  abilities: ImportAbilities;
  initialMonth: string;
  maxMonth: string;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [month, setMonth] = useState(initialMonth);
  const [preview, setPreview] = useState<LedgerPreview | null>(null);
  const [choices, setChoices] = useState<ImportChoices>(EMPTY_CHOICES);
  const [mode, setMode] = useState<ImportMode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  const reset = () => {
    setPreview(null);
    setChoices(EMPTY_CHOICES);
    setMode(null);
    setResult(null);
    setError(null);
  };

  const formData = () => {
    const data = new FormData();
    data.set("file", file!);
    data.set("month", month);
    return data;
  };

  const runPreview = () => {
    if (!file) return;
    const fileError = importFileError(file);
    if (fileError) {
      setError(fileError);
      return;
    }
    reset();
    startTransition(async () => {
      const res = await previewLedgerImport(formData());
      if (res.ok) setPreview(res.preview);
      else setError(res.error);
    });
  };

  const runImport = () => {
    if (!file || !preview) return;
    setError(null);
    const data = formData();
    data.set("fileSha256", preview.fileSha256);
    data.set("mode", mode ?? "none");
    data.set("expectedExisting", String(preview.existingTotal));
    data.set("choices", JSON.stringify(choices));
    startTransition(async () => {
      const res = await importLedger(data);
      setResult(res);
      if (res.ok) setPreview(null);
      else setError(res.error);
    });
  };

  const choose = <K extends keyof ImportChoices>(
    key: K,
    row: number,
    value: ImportChoices[K][number],
  ) => setChoices((c) => ({ ...c, [key]: { ...c[key], [row]: value } }));

  const setAllPurchaseTypes = (type: PurchaseType, rows: PreviewRow[]) =>
    setChoices((c) => ({
      ...c,
      purchaseType: Object.fromEntries(rows.map((r) => [r.row, type])),
    }));

  const todo = preview ? previewTodo(preview, choices, mode) : null;

  return (
    <div className="space-y-6">
      {/* ① 파일·기준년월 */}
      <section className="space-y-4 rounded-card border bg-card p-6">
        <h2 className={cardTitleClass}>1. 파일과 기준년월</h2>
        <div className="flex flex-wrap items-end gap-4">
          <label className="block text-sm">
            <span className="mb-2 block font-medium">엑셀 파일 (.xlsx)</span>
            <input
              type="file"
              accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                reset();
              }}
              className="block text-sm file:mr-3 file:h-10 file:rounded-lg file:border file:bg-card file:px-4 file:text-sm file:font-medium"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-2 block font-medium">기준년월</span>
            <input
              type="month"
              value={month}
              max={maxMonth}
              onChange={(e) => {
                if (e.target.value && e.target.value <= maxMonth) {
                  setMonth(e.target.value);
                  reset();
                }
              }}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </label>
          <button
            type="button"
            disabled={!file || pending}
            onClick={runPreview}
            className={buttonPrimaryClass}
          >
            <FileSpreadsheet className="size-4" aria-hidden />
            {pending && !preview ? "읽는 중…" : "미리보기"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          파일 1개, {MAX_IMPORT_BYTES / 1024 / 1024}MB 이하. 양식의 행·열을
          옮기지 말고 그대로 올려 주세요. 미리보기에서는 아무것도 저장하지
          않습니다.
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        {result && !result.ok && result.blockers && (
          <ul className="list-disc space-y-1 pl-5 text-xs text-destructive">
            {result.blockers.slice(0, 10).map((b, i) => (
              <li key={i}>{b.message}</li>
            ))}
          </ul>
        )}
      </section>

      {result?.ok && <ResultCard result={result} />}

      {preview && (
        <>
          {/* ② 미리보기 */}
          <section className="space-y-4 rounded-card border bg-card p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className={cardTitleClass}>2. 미리보기</h2>
              <p className="text-xs text-muted-foreground">
                {preview.fileName} · {preview.sheetName} 시트 · {preview.year}년{" "}
                {preview.month}월로 가져옵니다
              </p>
            </div>

            {preview.fatal.length > 0 && (
              <div
                role="alert"
                className="rounded-lg bg-danger-soft p-3 text-sm text-danger-strong"
              >
                <p className="font-medium">양식을 읽을 수 없습니다</p>
                <ul className="mt-1 list-disc pl-5 text-xs">
                  {preview.fatal.map((m) => (
                    <li key={m}>{m}</li>
                  ))}
                </ul>
              </div>
            )}

            {todo?.empty && (
              <p
                role="status"
                className="rounded-lg bg-info-soft p-3 text-sm text-foreground"
              >
                가져올 데이터가 없습니다. 빈 양식이거나 거래처명·잔액이 모두
                비어 있습니다.
              </p>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
              {preview.blocks.map((b) => (
                <BlockSummary key={b.kind} block={b} />
              ))}
            </div>
          </section>

          {preview.blocks
            .filter((b) => b.rows.length > 0)
            .map((block) => (
              <BlockTable
                key={block.kind}
                block={block}
                choices={choices}
                defaultSettledOn={preview.defaultSettledOn}
                onChoose={choose}
                onAllPurchase={(t) => setAllPurchaseTypes(t, block.rows)}
              />
            ))}

          {/* ③ 가져오기 */}
          <section className="space-y-4 rounded-card border bg-card p-6">
            <h2 className={cardTitleClass}>3. 가져오기</h2>
            {preview.existingTotal > 0 && (
              <fieldset className="space-y-2 text-sm">
                <legend className="mb-2 font-medium">
                  {preview.year}년 {preview.month}월에 이미{" "}
                  {preview.existingTotal}행이 있습니다 (
                  {preview.blocks
                    .map(
                      (b) =>
                        `${KIND_LABEL[b.kind]} ${preview.existing[b.kind]}`,
                    )
                    .join(" · ")}
                  )
                </legend>
                <label
                  className={cn(
                    "flex items-start gap-2",
                    !abilities.canOverwrite && "opacity-50",
                  )}
                >
                  <input
                    type="radio"
                    name="mode"
                    disabled={!abilities.canOverwrite}
                    checked={mode === "overwrite"}
                    onChange={() => setMode("overwrite")}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium">덮어쓰기</span> — 기존{" "}
                    {preview.existingTotal}행을 숨기고 엑셀 내용으로 바꿉니다.
                    숨긴 행은 [숨긴 항목 보기]에서 복구할 수 있습니다.
                    {!abilities.canOverwrite && " (팀장만 가능)"}
                  </span>
                </label>
                <label className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="mode"
                    checked={mode === "append"}
                    onChange={() => setMode("append")}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-medium">추가</span> — 기존 행은 그대로
                    두고 엑셀 행을 더합니다. 같은 거래처가 두 번 들어갈 수
                    있습니다.
                  </span>
                </label>
              </fieldset>
            )}

            {todo && !isTodoDone(todo) && !todo.empty && (
              <ul className="list-disc space-y-1 pl-5 text-sm text-warning-strong">
                {todo.errors > 0 && (
                  <li>
                    오류 {todo.errors}건을 엑셀에서 고친 뒤 다시 올려 주세요.
                  </li>
                )}
                {todo.unclassified > 0 && (
                  <li>
                    외상매출금 미분류 {todo.unclassified}건의 상태를 고르세요.
                  </li>
                )}
                {todo.missingPurchaseType > 0 && (
                  <li>
                    외상매입금 {todo.missingPurchaseType}건의 매입유형을
                    고르세요.
                  </li>
                )}
                {todo.needsMode && <li>덮어쓰기·추가 중에 고르세요.</li>}
              </ul>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={!todo || !isTodoDone(todo) || pending}
                onClick={runImport}
                className={buttonPrimaryClass}
              >
                {pending ? "가져오는 중…" : "가져오기"}
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={reset}
                className={buttonSecondaryClass}
              >
                취소
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              가져오기를 누르면 서버가 파일을 다시 읽어 확인한 뒤 한 번에
              저장합니다. 중간에 실패하면 전부 취소됩니다.
            </p>
          </section>
        </>
      )}
    </div>
  );
}

// ---------- 블록 요약 카드 ----------

function TotalLine({ total }: { total: PreviewTotal }) {
  const base = "flex items-start gap-1 text-xs";
  switch (total.state) {
    case "match":
      return (
        <li className={base}>
          <CheckCircle2
            className="mt-0.5 size-3.5 shrink-0 text-success"
            aria-hidden
          />
          <span>
            {total.range} 원본 총액 일치{" "}
            <span className="tabular-nums">{formatAmount(total.rowsSum)}</span>
          </span>
        </li>
      );
    case "mismatch": {
      const diff = BigInt(total.rowsSum) - BigInt(total.fileTotal!);
      return (
        <li className={cn(base, "font-medium text-danger-strong")}>
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            {total.range} 불일치: 원본{" "}
            <span className="tabular-nums">
              {formatAmount(total.fileTotal!)}
            </span>{" "}
            · 행 합계{" "}
            <span className="tabular-nums">{formatAmount(total.rowsSum)}</span>{" "}
            (차이 {diff > 0n ? "+" : ""}
            <span className="tabular-nums">{formatAmount(diff)}</span>)
          </span>
        </li>
      );
    }
    case "noResult":
      return (
        <li className={cn(base, "text-muted-foreground")}>
          <span>
            {total.range} 수식 계산값이 파일에 없음 (엑셀에서 열어 저장하면
            생김) · 행 합계{" "}
            <span className="tabular-nums">{formatAmount(total.rowsSum)}</span>
          </span>
        </li>
      );
    case "noTotal":
      return (
        <li className={cn(base, "text-muted-foreground")}>
          <span>
            {total.range} 원본 총액 없음 · 행 합계{" "}
            <span className="tabular-nums">{formatAmount(total.rowsSum)}</span>
          </span>
        </li>
      );
  }
}

function BlockSummary({ block }: { block: PreviewBlock }) {
  const errors = block.rows.filter((r) => r.errors.length > 0).length;
  const vendor = block.kind === "ACCRUED_VENDOR";
  const sum = BigInt(block.sum);
  const auto = BigInt(block.autoTransferSum);
  return (
    <div className="rounded-lg border p-4">
      <p className={labelClass}>{KIND_LABEL[block.kind]}</p>
      <p className="mt-1 text-lg font-semibold tracking-[-0.02em] tabular-nums">
        {formatAmount(sum)}
        <span className="ml-1 text-xs font-normal text-muted-foreground">
          원 · {block.rows.length}행
        </span>
      </p>
      {vendor && (
        <dl className="mt-1 grid grid-cols-[1fr_auto] gap-x-2 text-xs text-muted-foreground">
          <dt>총액(자동이체 제외) ← {KIND_TOTAL_LABEL.ACCRUED_VENDOR}</dt>
          <dd className="text-right tabular-nums">
            {formatAmount(sum - auto)}
          </dd>
          <dt>자동이체 합계</dt>
          <dd className="text-right tabular-nums">{formatAmount(auto)}</dd>
          <dt>전체 합계</dt>
          <dd className="text-right tabular-nums">{formatAmount(sum)}</dd>
        </dl>
      )}
      <ul className="mt-2 space-y-1">
        {block.totals.map((t) => (
          <TotalLine key={t.range} total={t} />
        ))}
      </ul>
      {(errors > 0 ||
        block.skippedCodeOnly.length > 0 ||
        block.skippedZero.length > 0) && (
        <ul className="mt-2 space-y-1 text-xs">
          {errors > 0 && (
            <li className="font-medium text-destructive">오류 {errors}행</li>
          )}
          {block.skippedCodeOnly.length > 0 && (
            <li className="text-muted-foreground">
              코드만 있는 행 {block.skippedCodeOnly.length}건 건너뜀 (
              {block.skippedCodeOnly.map((r) => `${r}행`).join(", ")})
            </li>
          )}
          {block.skippedZero.length > 0 && (
            <li className="text-muted-foreground">
              0원 행 {block.skippedZero.length}건 제외 (
              {block.skippedZero.map((r) => `${r}행`).join(", ")})
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

// ---------- 블록별 행 표 ----------

function BlockTable({
  block,
  choices,
  defaultSettledOn,
  onChoose,
  onAllPurchase,
}: {
  block: PreviewBlock;
  choices: ImportChoices;
  defaultSettledOn: string;
  onChoose: <K extends keyof ImportChoices>(
    key: K,
    row: number,
    value: ImportChoices[K][number],
  ) => void;
  onAllPurchase: (type: PurchaseType) => void;
}) {
  const isAr = block.kind === "AR";
  const typeHeader =
    block.kind === "AR"
      ? "상태"
      : block.kind === "AP"
        ? "매입유형"
        : block.kind === "ACCRUED_VENDOR"
          ? "비용유형"
          : null;

  return (
    <section className="space-y-3 rounded-card border bg-card p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className={cardTitleClass}>
          {KIND_LABEL[block.kind]}{" "}
          <span className="text-sm font-normal text-muted-foreground">
            {block.rows.length}행
          </span>
        </h3>
        {block.kind === "AP" && (
          <div className="flex gap-1">
            {PURCHASE_TYPES.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onAllPurchase(t)}
                className={buttonCompactClass}
              >
                전체 {PURCHASE_TYPE_LABEL[t]}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm [&_td]:px-3 [&_th]:px-3">
          <caption className="sr-only">
            {KIND_LABEL[block.kind]} 미리보기
          </caption>
          <thead className="bg-muted text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="py-2 text-right font-medium">행</th>
              {isAr && <th className="py-2 text-left font-medium">코드</th>}
              <th className="py-2 text-left font-medium">거래처명</th>
              <th className="py-2 text-right font-medium">잔액(원)</th>
              <th className="py-2 text-left font-medium">적요</th>
              {typeHeader && (
                <th className="py-2 text-left font-medium">{typeHeader}</th>
              )}
              <th className="py-2 text-left font-medium">확인</th>
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row) => (
              <PreviewRowView
                key={row.row}
                row={row}
                isAr={isAr}
                hasType={typeHeader !== null}
                choices={choices}
                defaultSettledOn={defaultSettledOn}
                onChoose={onChoose}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function PreviewRowView({
  row,
  isAr,
  hasType,
  choices,
  defaultSettledOn,
  onChoose,
}: {
  row: PreviewRow;
  isAr: boolean;
  hasType: boolean;
  choices: ImportChoices;
  defaultSettledOn: string;
  onChoose: <K extends keyof ImportChoices>(
    key: K,
    row: number,
    value: ImportChoices[K][number],
  ) => void;
}) {
  const hasError = row.errors.length > 0;
  const status = isAr ? finalArStatus(row, choices) : null;
  const unclassified = isAr && !hasError && row.arStatus === null;
  const settledOn =
    status === "COLLECTED"
      ? (choices.settledOn[row.row] ?? row.settledOn ?? defaultSettledOn)
      : null;

  return (
    <tr
      className={cn(
        "border-b align-top",
        hasError && "bg-danger-soft",
        !hasError && unclassified && !status && "bg-warning-soft",
        row.kind === "ACCRUED_VENDOR" && row.autoTransfer && "bg-success-soft",
        status === "LONG_OVERDUE" && "text-destructive",
      )}
    >
      <td className="py-2 text-right text-xs text-muted-foreground tabular-nums">
        {row.row}
      </td>
      {isAr && <td className="py-2 tabular-nums">{row.partnerCode ?? "-"}</td>}
      <td className="py-2">{row.partnerName || "-"}</td>
      <td className="py-2 text-right tabular-nums">
        {row.amount === null ? "-" : formatAmount(row.amount)}
      </td>
      <td className="max-w-56 py-2 text-xs">{row.note ?? ""}</td>
      {hasType && (
        <td className="py-2">
          {row.kind === "AR" &&
            (row.arStatus ? (
              AR_STATUS_LABEL[row.arStatus]
            ) : (
              <select
                aria-label={`${row.row}행 상태`}
                value={choices.arStatus[row.row] ?? ""}
                disabled={hasError}
                onChange={(e) =>
                  onChoose("arStatus", row.row, e.target.value as ArStatus)
                }
                className={cn(selectClass, !status && "border-destructive")}
              >
                <option value="">미분류 — 고르세요</option>
                {AR_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {AR_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            ))}
          {row.kind === "AP" && (
            <select
              aria-label={`${row.row}행 매입유형`}
              value={choices.purchaseType[row.row] ?? ""}
              disabled={hasError}
              onChange={(e) =>
                onChoose(
                  "purchaseType",
                  row.row,
                  e.target.value as PurchaseType,
                )
              }
              className={cn(
                selectClass,
                !choices.purchaseType[row.row] && "border-warning",
              )}
            >
              <option value="">선택</option>
              {PURCHASE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PURCHASE_TYPE_LABEL[t]}
                </option>
              ))}
            </select>
          )}
          {row.kind === "ACCRUED_VENDOR" && (
            <div className="flex items-center gap-2">
              <select
                aria-label={`${row.row}행 비용유형`}
                value={choices.expenseType[row.row] ?? "OTHER"}
                disabled={hasError}
                onChange={(e) =>
                  onChoose(
                    "expenseType",
                    row.row,
                    e.target.value as ExpenseType,
                  )
                }
                className={selectClass}
              >
                {EXPENSE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {EXPENSE_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
              {row.autoTransfer && (
                <span className="text-xs font-medium text-success-strong">
                  자동이체
                </span>
              )}
            </div>
          )}
        </td>
      )}
      <td className="space-y-1 py-2 text-xs">
        {row.errors.map((m) => (
          <p key={m} className="font-medium text-destructive">
            {m}
          </p>
        ))}
        {row.warnings.map((m) => (
          <p key={m} className="text-warning-strong">
            {m}
          </p>
        ))}
        {settledOn !== null && (
          <label className="flex flex-wrap items-center gap-1">
            <span className="text-muted-foreground">완료일</span>
            <input
              type="date"
              aria-label={`${row.row}행 수금 완료일`}
              value={settledOn}
              onChange={(e) => onChoose("settledOn", row.row, e.target.value)}
              className="h-8 rounded-lg border border-warning bg-background px-2 text-sm"
            />
            <span className="text-warning-strong">
              {choices.settledOn[row.row]
                ? "직접 수정함"
                : row.settledSource === "note"
                  ? "적요에서 가져옴 · 확인 필요"
                  : `${row.noteDateIgnored ? `${row.noteDateIgnored} · ` : ""}완료일 확인 필요 (기준월 말일·오늘 중 이른 날)`}
            </span>
          </label>
        )}
      </td>
    </tr>
  );
}

// ---------- 결과 ----------

function ResultCard({
  result,
}: {
  result: Extract<ImportResult, { ok: true }>;
}) {
  const month = `${result.year}-${String(result.month).padStart(2, "0")}`;
  const total = result.blocks.reduce((n, b) => n + b.count, 0);
  return (
    <section
      role="status"
      className="space-y-3 rounded-card border border-success/40 bg-success-soft p-6"
    >
      <h2 className={cn(cardTitleClass, "flex items-center gap-2")}>
        <CheckCircle2 className="size-5 text-success" aria-hidden />
        {result.year}년 {result.month}월로 {total}행을 가져왔습니다
      </h2>
      <table className="text-sm [&_td]:py-1 [&_td]:pr-6">
        <tbody>
          {result.blocks.map((b) => (
            <tr key={b.kind}>
              <td>{KIND_LABEL[b.kind]}</td>
              <td className="text-right tabular-nums">{b.count}행</td>
              <td className="text-right tabular-nums">
                {formatAmount(b.sum)}원
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {result.hidden > 0 && (
        <p className="text-sm">
          기존 {result.hidden}행은 숨겼습니다. 채권·채무 관리의 [숨긴 항목
          보기]에서 복구할 수 있습니다.
        </p>
      )}
      <Link
        href={`/management/ledger?month=${month}`}
        className={buttonPrimaryClass}
      >
        채권·채무 관리에서 보기
      </Link>
    </section>
  );
}
