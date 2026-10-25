"use client";
// 채권·채무 표: 기준년월·구분 탭·숨긴 항목 보기, 표 안에서 바로 행 추가·수정, 숨김·복구
// 열 순서는 엑셀과 같게: (코드) | 거래처명 | 잔액 | 적요 | (상태)
import { EyeOff, Plus, Upload } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useState, useTransition } from "react";

import type { AppUser } from "@/shared/auth/types";
import { formatAmount, formatWon } from "@/shared/format/money";
import { cn } from "@/shared/lib/utils";
import {
  buttonCompactClass,
  buttonPrimaryClass,
  buttonSecondaryClass,
  labelClass,
} from "@/shared/ui/styles";

import { MoneyTextInput } from "../entry/money-text-input";
import { ConfirmDialog, type ConfirmRequest } from "../entry/confirm-dialog";
import {
  createLedgerEntry,
  hideLedgerEntry,
  restoreLedgerEntry,
  updateLedgerEntry,
  type LedgerActionResult,
} from "./actions";
import {
  draftFromRow,
  draftToFields,
  emptyDraft,
  withArStatus,
  type LedgerDraft,
} from "./draft";
import {
  groupArRows,
  kindCounts,
  rowsOfKind,
  sumAmount,
  vendorTotals,
} from "./group";
import {
  AR_GROUP_TOTAL_LABEL,
  AR_STATUS_LABEL,
  AR_STATUSES,
  EXPENSE_TYPE_LABEL,
  EXPENSE_TYPES,
  KIND_LABEL,
  KIND_PARAM,
  KIND_TOTAL_LABEL,
  LEDGER_KINDS,
  PURCHASE_TYPE_LABEL,
  PURCHASE_TYPES,
  settleWord,
  type ArStatus,
  type LedgerKind,
} from "./labels";
import {
  canCreateLedgerEntry,
  canManageHiddenLedger,
  ledgerAbilities,
  ledgerDateErrors,
  PARTNER_CODE_LENGTH,
  type LedgerRow,
} from "./rules";
import { ledgerFieldsSchema } from "./schemas";
import { ExportMenu } from "./export/export-menu";
import { importAbilities } from "./import/rules";
import { SettleDialog, type SettleRequest } from "./settle-dialog";

/** 입력 중인 행: 기존 행 id 또는 "new" */
type Editing = { id: string; draft: LedgerDraft } | null;

/** 탭·숨김 보기를 주소에 남겨 새로고침 후에도 유지 (기준년월은 서버가 읽는 값이라 그대로 둔다) */
function syncUrl(month: string, kind: LedgerKind, hidden: boolean) {
  const params = new URLSearchParams({ month });
  if (kind !== "AR") params.set("tab", KIND_PARAM[kind]);
  if (hidden) params.set("hidden", "1");
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}?${params.toString()}`,
  );
}

const inputClass =
  "h-8 w-full rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50";
/** 선택칸: "당월수금완료"가 잘리지 않는 폭 */
const selectClass = `${inputClass} min-w-32`;

export function LedgerManager({
  user,
  month,
  maxMonth,
  rows,
  hiddenRows,
  today,
  initialKind,
  initialShowHidden,
}: {
  user: AppUser;
  /** 기준년월 "YYYY-MM" */
  month: string;
  /** 고를 수 있는 마지막 달 (이번 달) */
  maxMonth: string;
  rows: LedgerRow[];
  hiddenRows: LedgerRow[];
  /** "YYYY-MM-DD" (한국 날짜) */
  today: string;
  initialKind: LedgerKind;
  initialShowHidden: boolean;
}) {
  const router = useRouter();
  const [kind, setKind] = useState(initialKind);
  const [showHidden, setShowHidden] = useState(
    initialShowHidden && canManageHiddenLedger(user),
  );
  const [editing, setEditing] = useState<Editing>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [settle, setSettle] = useState<SettleRequest | null>(null);
  const [dialog, setDialog] = useState<ConfirmRequest | null>(null);
  const [result, setResult] = useState<LedgerActionResult | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const source = showHidden ? hiddenRows : rows;
  const counts = kindCounts(source);
  const tabRows = rowsOfKind(source, kind);
  const canCreate = canCreateLedgerEntry(user) && !showHidden;
  const [year, monthNumber] = month.split("-").map(Number);

  const hasCode = kind === "AR";
  const statusHeader =
    kind === "AR"
      ? "상태"
      : kind === "AP"
        ? "매입유형"
        : kind === "ACCRUED_VENDOR"
          ? "비용유형"
          : null;
  const columnCount = 7 + (hasCode ? 1 : 0) + (statusHeader ? 1 : 0);
  const word = settleWord(kind);

  const startEdit = (id: string, draft: LedgerDraft) => {
    setResult(null);
    setEditError(null);
    setEditing({ id, draft });
  };
  const cancelEdit = () => {
    setEditing(null);
    setEditError(null);
  };

  const changeKind = (next: LedgerKind) => {
    cancelEdit();
    setKind(next);
    syncUrl(month, next, showHidden);
  };
  const toggleHidden = (next: boolean) => {
    cancelEdit();
    setShowHidden(next);
    syncUrl(month, kind, next);
  };
  const changeMonth = (next: string) => {
    if (!next || next > maxMonth) return;
    const params = new URLSearchParams({ month: next });
    if (kind !== "AR") params.set("tab", KIND_PARAM[kind]);
    router.push(`/management/ledger?${params.toString()}`);
  };

  const updateDraft = (patch: Partial<LedgerDraft>) =>
    setEditing((e) => (e ? { ...e, draft: { ...e.draft, ...patch } } : e));

  /** 당월수금완료로 바꾸면 완료일 모달, 다른 상태로 바꾸면 완료일을 지운다 */
  const changeArStatus = (next: ArStatus) => {
    if (!editing) return;
    if (next === "COLLECTED" && editing.draft.arStatus !== "COLLECTED") {
      setSettle({
        partnerName: editing.draft.partnerName,
        amount: editing.draft.amount,
        initialDate: editing.draft.settledOn || today,
      });
      return;
    }
    setEditing({ ...editing, draft: withArStatus(editing.draft, next) });
  };

  const save = () => {
    if (!editing) return;
    const fields = draftToFields(kind, editing.draft);
    // 서버도 다시 검사하지만, 빠진 칸은 저장 전에 바로 알려 준다
    const parsed = ledgerFieldsSchema.safeParse(fields);
    if (!parsed.success) {
      setEditError(parsed.error.issues[0]?.message ?? "입력값을 확인하세요.");
      return;
    }
    const dateErrors = ledgerDateErrors(
      {
        kind,
        arStatus: editing.draft.arStatus || null,
        dueOn: editing.draft.dueOn || null,
        settledOn: editing.draft.settledOn || null,
      },
      today,
    );
    const dateError = dateErrors.settledOn ?? dateErrors.dueOn;
    if (dateError) {
      setEditError(dateError);
      return;
    }

    const target = editing;
    const original = rows.find((r) => r.id === target.id);
    setPendingId(target.id);
    setEditError(null);
    startTransition(async () => {
      const res =
        target.id === "new"
          ? await createLedgerEntry({ year, month: monthNumber, fields })
          : await updateLedgerEntry({
              id: target.id,
              expectedUpdatedAt: original?.updatedAt ?? "",
              fields,
            });
      setPendingId(null);
      if (res.ok) {
        setEditing(null);
        setResult(res);
      } else {
        setEditError(res.message);
        if (res.code === "CONFLICT") setResult(res);
      }
    });
  };

  const runRowAction = (row: LedgerRow, action: typeof hideLedgerEntry) => {
    setResult(null);
    setPendingId(row.id);
    startTransition(async () => {
      const res = await action({
        id: row.id,
        expectedUpdatedAt: row.updatedAt,
      });
      setResult(res);
      setPendingId(null);
    });
  };

  const askHide = (row: LedgerRow) =>
    setDialog({
      title: `${row.partnerName} 행을 숨길까요?`,
      body: (
        <>
          <p>
            {KIND_LABEL[row.kind]} · {formatWon(row.amount)}
          </p>
          <p className="mt-2">
            숨긴 행은 표와 총액에서 빠집니다. 삭제되지는 않으며 [숨긴 항목
            보기]에서 팀장이 복구할 수 있습니다.
          </p>
        </>
      ),
      confirmLabel: "숨기기",
      tone: "danger",
      onConfirm: () => runRowAction(row, hideLedgerEntry),
    });

  const askRestore = (row: LedgerRow) =>
    setDialog({
      title: `${row.partnerName} 행을 복구할까요?`,
      body: <p>표와 총액에 다시 포함됩니다.</p>,
      confirmLabel: "복구",
      onConfirm: () => runRowAction(row, restoreLedgerEntry),
    });

  // ---------- 셀 ----------

  const statusText = (row: LedgerRow) => {
    if (row.kind === "AR" && row.arStatus) return AR_STATUS_LABEL[row.arStatus];
    if (row.kind === "AP" && row.purchaseType)
      return PURCHASE_TYPE_LABEL[row.purchaseType];
    if (row.kind === "ACCRUED_VENDOR" && row.expenseType)
      return EXPENSE_TYPE_LABEL[row.expenseType];
    return "";
  };

  const dateText = (row: LedgerRow) =>
    [row.dueOn && `예정 ${row.dueOn}`, row.settledOn && `완료 ${row.settledOn}`]
      .filter(Boolean)
      .join(" · ") || "-";

  const viewRow = (row: LedgerRow) => {
    const can = ledgerAbilities(user, row);
    const busy = pendingId === row.id;
    return (
      <tr
        key={row.id}
        className={cn(
          "border-b align-top",
          // 장기미수 = 빨간 글씨, 자동이체 = 연한 초록 바탕 (엑셀 표시 그대로, 상태 글자도 함께 표시)
          row.kind === "AR" &&
            row.arStatus === "LONG_OVERDUE" &&
            "text-destructive",
          row.kind === "ACCRUED_VENDOR" &&
            row.autoTransfer &&
            "bg-success-soft",
          busy && "opacity-50",
        )}
      >
        {hasCode && (
          <td className="py-3 tabular-nums">{row.partnerCode ?? "-"}</td>
        )}
        <td className="max-w-48 truncate py-3" title={row.partnerName}>
          {row.partnerName}
        </td>
        <td className="py-3 text-right tabular-nums">
          {formatAmount(row.amount)}
        </td>
        <td className="max-w-56 truncate py-3 text-xs" title={row.note ?? ""}>
          {row.note ?? ""}
        </td>
        {statusHeader && (
          <td className="py-3 whitespace-nowrap">
            {statusText(row)}
            {row.kind === "ACCRUED_VENDOR" && row.autoTransfer && (
              <span className="ml-2 text-xs font-medium text-success-strong">
                자동이체
              </span>
            )}
          </td>
        )}
        <td className="py-3 text-xs whitespace-nowrap tabular-nums">
          {dateText(row)}
        </td>
        <td className="py-3 text-xs whitespace-nowrap text-muted-foreground">
          {row.hidden
            ? `숨김 ${row.deletedAt?.slice(0, 10)} · ${row.deletedBy}`
            : row.fromUpload
              ? `${row.updatedBy} · 엑셀`
              : row.updatedBy}
        </td>
        <td className="py-2 text-right whitespace-nowrap">
          <div className="flex justify-end gap-1">
            {can.canEdit && (
              <button
                type="button"
                disabled={busy || editing !== null}
                onClick={() => startEdit(row.id, draftFromRow(row))}
                className={buttonCompactClass}
              >
                수정
              </button>
            )}
            {can.canHide && (
              <button
                type="button"
                disabled={busy || editing !== null}
                onClick={() => askHide(row)}
                className={cn(
                  buttonCompactClass,
                  "text-destructive hover:bg-danger-soft",
                )}
              >
                숨기기
              </button>
            )}
            {can.canRestore && (
              <button
                type="button"
                disabled={busy}
                onClick={() => askRestore(row)}
                className={buttonCompactClass}
              >
                복구
              </button>
            )}
            {can.notice && !can.canEdit && !can.canRestore && (
              <span className="text-xs text-muted-foreground">
                {can.notice}
              </span>
            )}
          </div>
        </td>
      </tr>
    );
  };

  const editRow = (id: string, draft: LedgerDraft) => {
    const busy = pendingId === id;
    const field = (name: string) => `ledger-${id}-${name}`;
    const showSettled = kind !== "AR" || draft.arStatus === "COLLECTED";
    return (
      <Fragment key={id}>
        <tr
          className={cn(
            "border-b bg-brand-soft/60 align-top",
            busy && "opacity-50",
          )}
        >
          {hasCode && (
            <td className="py-2">
              <input
                id={field("code")}
                aria-label="거래처코드"
                inputMode="numeric"
                maxLength={PARTNER_CODE_LENGTH}
                placeholder="0000000087"
                value={draft.partnerCode}
                onChange={(e) =>
                  updateDraft({
                    partnerCode: e.target.value.replace(/\D/g, ""),
                  })
                }
                className={cn(inputClass, "w-28 tabular-nums")}
              />
            </td>
          )}
          <td className="py-2">
            <input
              id={field("name")}
              aria-label="거래처명"
              autoFocus
              value={draft.partnerName}
              onChange={(e) => updateDraft({ partnerName: e.target.value })}
              className={inputClass}
            />
          </td>
          <td className="w-40 py-2 [&_input]:h-8">
            <MoneyTextInput
              id={field("amount")}
              aria-label="잔액"
              digits={draft.amount}
              onChange={(amount) => updateDraft({ amount })}
            />
          </td>
          <td className="py-2">
            <input
              id={field("note")}
              aria-label="적요"
              value={draft.note}
              onChange={(e) => updateDraft({ note: e.target.value })}
              className={inputClass}
            />
          </td>
          {statusHeader && (
            <td className="py-2">
              {kind === "AR" && (
                <select
                  aria-label="상태"
                  value={draft.arStatus}
                  onChange={(e) => changeArStatus(e.target.value as ArStatus)}
                  className={selectClass}
                >
                  {AR_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {AR_STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              )}
              {kind === "AP" && (
                <select
                  aria-label="매입유형"
                  value={draft.purchaseType}
                  onChange={(e) =>
                    updateDraft({
                      purchaseType: e.target
                        .value as LedgerDraft["purchaseType"],
                    })
                  }
                  className={selectClass}
                >
                  <option value="">선택</option>
                  {PURCHASE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {PURCHASE_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              )}
              {kind === "ACCRUED_VENDOR" && (
                <div className="space-y-1">
                  <select
                    aria-label="비용유형"
                    value={draft.expenseType}
                    onChange={(e) =>
                      updateDraft({
                        expenseType: e.target
                          .value as LedgerDraft["expenseType"],
                      })
                    }
                    className={selectClass}
                  >
                    {EXPENSE_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {EXPENSE_TYPE_LABEL[t]}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={draft.autoTransfer}
                      onChange={(e) =>
                        updateDraft({ autoTransfer: e.target.checked })
                      }
                    />
                    자동이체
                  </label>
                </div>
              )}
            </td>
          )}
          <td className="space-y-1 py-2">
            <label className="flex items-center gap-1 text-xs whitespace-nowrap">
              <span className="w-8 text-muted-foreground">예정</span>
              <input
                type="date"
                aria-label={`${word} 예정일`}
                value={draft.dueOn}
                onChange={(e) => updateDraft({ dueOn: e.target.value })}
                className={cn(inputClass, "w-36")}
              />
            </label>
            {showSettled && (
              <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                <span className="w-8 text-muted-foreground">완료</span>
                <input
                  type="date"
                  aria-label={`${word} 완료일`}
                  max={today}
                  value={draft.settledOn}
                  onChange={(e) => updateDraft({ settledOn: e.target.value })}
                  className={cn(inputClass, "w-36")}
                />
              </label>
            )}
          </td>
          <td className="py-2" />
          <td className="py-2 text-right whitespace-nowrap">
            <div className="flex justify-end gap-1">
              <button
                type="button"
                disabled={busy}
                onClick={save}
                className={cn(buttonCompactClass, "text-primary")}
              >
                {busy ? "저장 중…" : "저장"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={cancelEdit}
                className={buttonCompactClass}
              >
                취소
              </button>
            </div>
          </td>
        </tr>
        {editError && (
          <tr className="border-b bg-brand-soft/60">
            <td
              colSpan={columnCount}
              role="alert"
              className="pb-2 text-xs text-destructive"
            >
              {editError}
            </td>
          </tr>
        )}
      </Fragment>
    );
  };

  const renderRow = (row: LedgerRow) =>
    editing?.id === row.id ? editRow(row.id, editing.draft) : viewRow(row);

  /** '총액' 줄 (엑셀 F열, memo = H열 메모) — 숨긴 항목 보기에서는 표시하지 않음 */
  const totalRow = (
    key: string,
    total: bigint,
    memo: string | null,
    title = "총액",
  ) => (
    <tr key={key} className="border-b bg-muted/60 font-medium">
      {hasCode && <td className="py-2" />}
      <td className="py-2 text-xs whitespace-nowrap">
        {title}
        {memo && <span className="text-muted-foreground"> ← {memo}</span>}
      </td>
      <td className="py-2 text-right tabular-nums">{formatAmount(total)}</td>
      <td colSpan={columnCount - (hasCode ? 3 : 2)} />
    </tr>
  );

  /**
   * 외상매출금 외 탭의 합계. 미지급비용-업체는 엑셀 SUM 이 자동이체 행을 빼므로
   * 금액이 빠져 보이지 않게 3줄: 총액(자동이체 제외) / 자동이체 합계 / 전체 합계 (05-25)
   */
  const kindTotalRows = (k: Exclude<LedgerKind, "AR">) => {
    if (k !== "ACCRUED_VENDOR") {
      return [totalRow("total", sumAmount(tabRows), KIND_TOTAL_LABEL[k])];
    }
    const t = vendorTotals(tabRows);
    return [
      totalRow(
        "total",
        t.excludingAutoTransfer,
        KIND_TOTAL_LABEL[k],
        "총액(자동이체 제외)",
      ),
      totalRow("auto", t.autoTransfer, null, "자동이체 합계"),
      totalRow("all", t.all, null, "전체 합계"),
    ];
  };

  const emptyRow = (key: string, text: string) => (
    <tr key={key} className="border-b">
      <td
        colSpan={columnCount}
        className="py-4 text-center text-xs text-muted-foreground"
      >
        {text}
      </td>
    </tr>
  );

  const body =
    kind === "AR" && !showHidden
      ? groupArRows(tabRows).flatMap((group) => [
          <tr key={`${group.status}-head`} className="border-b">
            <th
              colSpan={columnCount}
              scope="colgroup"
              className={cn(
                "pt-4 pb-2 text-left",
                labelClass,
                group.status === "LONG_OVERDUE" && "text-destructive",
              )}
            >
              {AR_STATUS_LABEL[group.status]} · {group.rows.length}건
            </th>
          </tr>,
          ...(group.rows.length === 0
            ? [emptyRow(`${group.status}-empty`, "해당 거래처가 없습니다.")]
            : group.rows.map(renderRow)),
          totalRow(
            `${group.status}-total`,
            group.total,
            AR_GROUP_TOTAL_LABEL[group.status],
          ),
        ])
      : [
          ...(tabRows.length === 0
            ? [
                emptyRow(
                  "empty",
                  showHidden
                    ? "숨긴 항목이 없습니다."
                    : "입력된 행이 없습니다.",
                ),
              ]
            : tabRows.map(renderRow)),
          ...(showHidden || kind === "AR" ? [] : kindTotalRows(kind)),
        ];

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-card border bg-card p-6">
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            기준년월
            <input
              type="month"
              value={month}
              max={maxMonth}
              onChange={(e) => changeMonth(e.target.value)}
              className="h-10 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </label>
          <div className="ml-auto flex flex-wrap items-center gap-3">
            {canManageHiddenLedger(user) && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={showHidden}
                  onChange={(e) => toggleHidden(e.target.checked)}
                />
                숨긴 항목 보기
                <span className="text-xs text-muted-foreground">
                  ({hiddenRows.length})
                </span>
              </label>
            )}
            <ExportMenu month={month} />
            {importAbilities(user).canImport && (
              <Link
                href={`/management/ledger/import?month=${month}`}
                className={buttonSecondaryClass}
              >
                <Upload className="size-4" aria-hidden />
                엑셀 업로드
              </Link>
            )}
          </div>
        </div>

        <div role="tablist" aria-label="구분" className="flex flex-wrap gap-1">
          {LEDGER_KINDS.map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => changeKind(k)}
              className={cn(
                buttonSecondaryClass,
                "px-3",
                kind === k &&
                  "border-primary bg-primary text-primary-foreground hover:bg-primary-800",
              )}
            >
              {KIND_LABEL[k]}
              <span className="ml-1 text-xs tabular-nums opacity-80">
                {counts[k]}
              </span>
            </button>
          ))}
        </div>

        {showHidden && (
          <p className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            <EyeOff className="size-4" aria-hidden />
            숨긴 항목만 보고 있습니다. 숨긴 행은 총액에 포함되지 않습니다.
          </p>
        )}

        {result && (
          <p
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
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm [&_td]:px-3 [&_th]:px-3">
            <caption className="sr-only">
              {month} {KIND_LABEL[kind]}
            </caption>
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr className="border-b">
                {hasCode && (
                  <th className="py-3 text-left font-medium">코드</th>
                )}
                <th className="py-3 text-left font-medium">거래처명</th>
                <th className="py-3 text-right font-medium">잔액(원)</th>
                <th className="py-3 text-left font-medium">적요</th>
                {statusHeader && (
                  <th className="py-3 text-left font-medium">{statusHeader}</th>
                )}
                <th className="py-3 text-left font-medium">
                  {word} 예정일 · 완료일
                </th>
                <th className="py-3 text-left font-medium">수정</th>
                <th className="py-3" />
              </tr>
            </thead>
            <tbody>
              {body}
              {editing?.id === "new" && editRow("new", editing.draft)}
            </tbody>
          </table>
        </div>

        {canCreate && (
          <button
            type="button"
            disabled={editing !== null}
            onClick={() => startEdit("new", emptyDraft(kind))}
            className={buttonPrimaryClass}
          >
            <Plus className="size-4" aria-hidden />
            {KIND_LABEL[kind]} 행 추가
          </button>
        )}
      </section>

      <SettleDialog
        request={settle}
        today={today}
        onCancel={() => setSettle(null)}
        onConfirm={(settledOn) => {
          setEditing((e) =>
            e
              ? { ...e, draft: withArStatus(e.draft, "COLLECTED", settledOn) }
              : e,
          );
          setSettle(null);
        }}
      />
      <ConfirmDialog request={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}
