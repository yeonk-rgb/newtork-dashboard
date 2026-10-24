"use client";
// 미수금 관리 목록: 필터 탭·거래처 검색·숨긴 항목 보기, 건별 수정·수금 처리·수금 취소·숨김·복구
import { EyeOff, Plus, Search } from "lucide-react";
import { useState, useTransition } from "react";

import type { AppUser } from "@/shared/auth/types";
import { formatAmount, formatWon } from "@/shared/format/money";
import { cn } from "@/shared/lib/utils";

import { ConfirmDialog, type ConfirmRequest } from "../entry/confirm-dialog";
import {
  hideReceivable,
  restoreReceivable,
  uncollectReceivable,
  type ReceivableActionResult,
} from "./actions";
import { CollectForm } from "./collect-form";
import { Modal } from "./modal";
import { ReceivableForm } from "./receivable-form";
import {
  canCreateReceivable,
  canManageHidden,
  filterReceivables,
  RECEIVABLE_TABS,
  receivableAbilities,
  rowStatus,
  tabCounts,
  type ReceivableRow,
  type ReceivableTab,
} from "./rules";
import {
  buttonCompactClass,
  buttonPrimaryClass,
  buttonSecondaryClass,
  labelClass,
} from "@/shared/ui/styles";

type Editing =
  | { kind: "create" }
  | { kind: "edit"; row: ReceivableRow }
  | { kind: "collect"; row: ReceivableRow }
  | null;

const sumAmount = (rows: ReceivableRow[]) =>
  rows.reduce((total, r) => total + BigInt(r.amount), 0n);

/** 탭·검색어를 주소에 남겨 새로고침·뒤로 가기 후에도 유지 */
function syncUrl(tab: ReceivableTab, query: string, hidden: boolean) {
  const params = new URLSearchParams();
  if (tab !== "open") params.set("tab", tab);
  if (query.trim()) params.set("q", query.trim());
  if (hidden) params.set("hidden", "1");
  const search = params.toString();
  window.history.replaceState(
    null,
    "",
    `${window.location.pathname}${search ? `?${search}` : ""}`,
  );
}

export function ReceivablesManager({
  user,
  rows,
  hiddenRows,
  customerNames,
  today,
  initialTab,
  initialQuery,
  initialShowHidden,
}: {
  user: AppUser;
  rows: ReceivableRow[];
  hiddenRows: ReceivableRow[];
  customerNames: string[];
  /** "YYYY-MM-DD" (한국 날짜) */
  today: string;
  initialTab: ReceivableTab;
  initialQuery: string;
  initialShowHidden: boolean;
}) {
  const [tab, setTab] = useState(initialTab);
  const [query, setQuery] = useState(initialQuery);
  const [showHidden, setShowHidden] = useState(
    initialShowHidden && canManageHidden(user),
  );
  const [editing, setEditing] = useState<Editing>(null);
  const [dialog, setDialog] = useState<ConfirmRequest | null>(null);
  const [result, setResult] = useState<ReceivableActionResult | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const source = showHidden ? hiddenRows : rows;
  const visible = filterReceivables(source, tab, query, today);
  const counts = tabCounts(source, query, today);

  const open = rows.filter((r) => !r.isCollected);
  const over90 = open.filter((r) => rowStatus(r, today).isOver90);
  const overdue = open.filter((r) => rowStatus(r, today).isOverdue);

  const changeTab = (next: ReceivableTab) => {
    setTab(next);
    syncUrl(next, query, showHidden);
  };
  const changeQuery = (next: string) => {
    setQuery(next);
    syncUrl(tab, next, showHidden);
  };
  const toggleHidden = (next: boolean) => {
    setShowHidden(next);
    syncUrl(tab, query, next);
  };

  const done = (res: ReceivableActionResult) => {
    setEditing(null);
    setResult(res);
  };

  const runRowAction = (row: ReceivableRow, action: typeof hideReceivable) => {
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

  const askHide = (row: ReceivableRow) =>
    setDialog({
      title: `${row.customerName} 건을 숨길까요?`,
      body: (
        <>
          <p>
            {row.occurredOn} 발생 · {formatWon(row.amount)}
          </p>
          <p className="mt-2">
            숨긴 건은 목록·대시보드·통계에서 모두 제외됩니다. 삭제되지는 않으며
            [숨긴 항목 보기]에서 팀장이 복구할 수 있습니다.
          </p>
        </>
      ),
      confirmLabel: "숨기기",
      tone: "danger",
      onConfirm: () => runRowAction(row, hideReceivable),
    });

  const askUncollect = (row: ReceivableRow) =>
    setDialog({
      title: `${row.customerName} 수금을 취소할까요?`,
      body: (
        <p>
          {row.collectedOn} 수금 기록을 지우고 미수로 되돌립니다. 대시보드
          미수금이 다시 늘어납니다.
        </p>
      ),
      confirmLabel: "수금 취소",
      tone: "danger",
      onConfirm: () => runRowAction(row, uncollectReceivable),
    });

  const askRestore = (row: ReceivableRow) =>
    setDialog({
      title: `${row.customerName} 건을 복구할까요?`,
      body: <p>목록·대시보드·통계에 다시 포함됩니다.</p>,
      confirmLabel: "복구",
      onConfirm: () => runRowAction(row, restoreReceivable),
    });

  const actionButton = buttonCompactClass;

  return (
    <div className="space-y-6">
      {/* 오늘 기준 요약 (숨긴 건 제외) */}
      <dl className="grid grid-cols-1 gap-6 sm:grid-cols-3">
        {[
          { label: "미수 합계", list: open, tone: "" },
          { label: "90일 초과", list: over90, tone: "text-destructive" },
          { label: "예정일 지남", list: overdue, tone: "text-warning-strong" },
        ].map((s) => (
          <div key={s.label} className="rounded-card border bg-card p-6">
            <dt className={labelClass}>
              {s.label} ({today} 기준)
            </dt>
            <dd
              className={cn(
                "mt-2 text-lg font-semibold tracking-[-0.02em] tabular-nums",
                s.tone,
              )}
            >
              {formatWon(sumAmount(s.list))}
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                {s.list.length}건
              </span>
            </dd>
          </div>
        ))}
      </dl>

      <section className="space-y-4 rounded-card border bg-card p-6">
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="미수금 필터"
            className="flex flex-wrap gap-1"
          >
            {RECEIVABLE_TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                aria-pressed={tab === t.key}
                onClick={() => changeTab(t.key)}
                className={cn(
                  buttonSecondaryClass,
                  "px-3",
                  tab === t.key &&
                    "border-primary bg-primary text-primary-foreground hover:bg-primary-800",
                )}
              >
                {t.label}
                <span className="ml-1 text-xs tabular-nums opacity-80">
                  {counts[t.key]}
                </span>
              </button>
            ))}
          </div>
          <div className="relative ml-auto">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <input
              type="search"
              value={query}
              onChange={(e) => changeQuery(e.target.value)}
              placeholder="거래처 검색"
              aria-label="거래처 검색"
              className="h-10 w-48 rounded-lg border border-input bg-background pr-3 pl-9 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </div>
          {canManageHidden(user) && (
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
          {canCreateReceivable(user) && !showHidden && (
            <button
              type="button"
              onClick={() => {
                setResult(null);
                setEditing({ kind: "create" });
              }}
              className={buttonPrimaryClass}
            >
              <Plus className="size-4" aria-hidden />
              미수금 등록
            </button>
          )}
        </div>

        {showHidden && (
          <p className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground">
            <EyeOff className="size-4" aria-hidden />
            숨긴 항목만 보고 있습니다. 숨긴 건은 대시보드·통계에 포함되지
            않습니다.
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
          <table className="w-full min-w-[860px] text-sm [&_td]:px-3 [&_th]:px-3">
            <caption className="sr-only">미수금 목록</caption>
            <thead className="bg-muted text-xs text-muted-foreground">
              <tr className="border-b">
                <th className="py-3 text-left font-medium">거래처</th>
                <th className="py-3 text-left font-medium">발생일</th>
                <th className="py-3 text-right font-medium">금액(원)</th>
                <th className="py-3 pl-3 text-left font-medium">수금 예정일</th>
                <th className="py-3 text-right font-medium">경과일</th>
                <th className="py-3 pl-3 text-left font-medium">상태</th>
                <th className="py-3 text-left font-medium">비고</th>
                <th className="py-3" />
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="py-10 text-center text-muted-foreground"
                  >
                    {showHidden
                      ? "숨긴 항목이 없습니다."
                      : "조건에 맞는 미수금이 없습니다."}
                  </td>
                </tr>
              )}
              {visible.map((row) => {
                const status = rowStatus(row, today);
                const can = receivableAbilities(user, row);
                const busy = pendingId === row.id;
                return (
                  <tr
                    key={row.id}
                    className={cn(
                      "border-b align-top last:border-0",
                      row.isCollected && "text-muted-foreground",
                      busy && "opacity-50",
                    )}
                  >
                    <td
                      className="max-w-48 truncate py-3"
                      title={row.customerName}
                    >
                      {row.customerName}
                    </td>
                    <td className="py-3 tabular-nums">{row.occurredOn}</td>
                    <td className="py-3 text-right tabular-nums">
                      {formatAmount(row.amount)}
                    </td>
                    <td
                      className={cn(
                        "py-3 pl-3 tabular-nums",
                        status.isOverdue && "text-warning-strong",
                      )}
                    >
                      {row.dueOn ?? "-"}
                    </td>
                    <td
                      className={cn(
                        "py-3 text-right tabular-nums",
                        status.isOver90 && "font-semibold text-destructive",
                      )}
                    >
                      {status.ageDays === null ? "-" : `${status.ageDays}일`}
                    </td>
                    <td className="py-3 pl-3">
                      <div className="flex flex-wrap gap-x-3 gap-y-1">
                        {row.isCollected ? (
                          <Badge>수금 {row.collectedOn}</Badge>
                        ) : (
                          <Badge tone="open">미수</Badge>
                        )}
                        {status.isOver90 && (
                          <Badge tone="danger">90일 초과</Badge>
                        )}
                        {status.isOverdue && (
                          <Badge tone="warn">예정일 지남</Badge>
                        )}
                        {row.hidden && (
                          <Badge>
                            숨김 {row.deletedAt?.slice(0, 10)} · {row.deletedBy}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td
                      className="max-w-48 truncate py-3 text-xs"
                      title={row.note ?? undefined}
                    >
                      {row.note ?? ""}
                    </td>
                    <td className="py-3 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-1">
                        {can.canCollect && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setResult(null);
                              setEditing({ kind: "collect", row });
                            }}
                            className={cn(actionButton, "text-primary")}
                          >
                            수금 처리
                          </button>
                        )}
                        {can.canEdit && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              setResult(null);
                              setEditing({ kind: "edit", row });
                            }}
                            className={actionButton}
                          >
                            수정
                          </button>
                        )}
                        {can.canUncollect && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => askUncollect(row)}
                            className={actionButton}
                          >
                            수금 취소
                          </button>
                        )}
                        {can.canHide && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => askHide(row)}
                            className={cn(
                              actionButton,
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
                            className={actionButton}
                          >
                            복구
                          </button>
                        )}
                        {can.notice && !can.canEdit && (
                          <span className="text-xs text-muted-foreground">
                            {can.notice}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {visible.length > 0 && (
              <tfoot>
                <tr className="border-t font-medium">
                  <td className="py-3" colSpan={2}>
                    합계 {visible.length}건
                  </td>
                  <td className="py-3 text-right tabular-nums">
                    {formatAmount(sumAmount(visible))}
                  </td>
                  <td colSpan={5} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      <Modal
        open={editing?.kind === "create" || editing?.kind === "edit"}
        onClose={() => setEditing(null)}
        title={editing?.kind === "edit" ? "미수금 수정" : "미수금 등록"}
        titleId="rcv-form-title"
      >
        {(editing?.kind === "create" || editing?.kind === "edit") && (
          <ReceivableForm
            key={editing.kind === "edit" ? editing.row.id : "new"}
            row={editing.kind === "edit" ? editing.row : null}
            today={today}
            customerNames={customerNames}
            onDone={done}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
      <Modal
        open={editing?.kind === "collect"}
        onClose={() => setEditing(null)}
        title="수금 처리"
        titleId="rcv-collect-title"
      >
        {editing?.kind === "collect" && (
          <CollectForm
            row={editing.row}
            today={today}
            onDone={done}
            onCancel={() => setEditing(null)}
          />
        )}
      </Modal>
      <ConfirmDialog request={dialog} onClose={() => setDialog(null)} />
    </div>
  );
}

function Badge({
  tone = "muted",
  children,
}: {
  tone?: "muted" | "open" | "danger" | "warn";
  children: React.ReactNode;
}) {
  return (
    // 상태 = 색 점(●) + 글자 (색만으로 구분하지 않음)
    <span
      className={cn(
        "inline-flex items-center gap-2 text-xs font-medium whitespace-nowrap",
        tone === "muted" ? "text-muted-foreground" : "text-foreground",
        tone === "danger" && "text-danger-strong",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          tone === "muted" && "bg-subtle",
          tone === "open" && "bg-primary",
          tone === "danger" && "bg-destructive",
          tone === "warn" && "bg-warning",
        )}
      />
      {children}
    </span>
  );
}
