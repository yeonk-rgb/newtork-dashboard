"use client";
// 그 외 지출 항목 관리: 추가·이름 변경·순서(↑↓)·고정/변동·비활성화·삭제(쓴 적 없는 항목만), [변경 저장]으로 한 번에
import { ArrowDown, ArrowUp, CircleAlert, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import { cn } from "@/shared/lib/utils";

import { ConfirmDialog, type ConfirmRequest } from "../entry/confirm-dialog";
import { useUnsavedGuard } from "../entry/use-unsaved-guard";
import { saveExpenseCategories, type SettingsActionResult } from "./actions";
import type { CategoryRow } from "./load-settings";
import { categoryNameErrors, NAME_MAX } from "./schemas";

type Row = CategoryRow & { key: string; isNew: boolean };

const toRows = (rows: CategoryRow[]): Row[] =>
  rows.map((r) => ({ ...r, key: r.id, isNew: false }));

export function CategoryManager({
  rows: initialRows,
  version,
}: {
  rows: CategoryRow[];
  version: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [rows, setRows] = useState<Row[]>(() => toRows(initialRows));
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [loadedVersion, setLoadedVersion] = useState(version);
  const [result, setResult] = useState<SettingsActionResult | null>(null);
  const [dialog, setDialog] = useState<ConfirmRequest | null>(null);
  const newCount = useRef(0);

  // 저장 후 새 목록이 오면 맞춘다
  if (version !== loadedVersion) {
    setLoadedVersion(version);
    setRows(toRows(initialRows));
    setDeletedIds([]);
  }

  const snapshot = (list: Row[]) =>
    JSON.stringify(
      list.map(({ id, name, costType, isActive }) => [
        id,
        name,
        costType,
        isActive,
      ]),
    );
  const dirty =
    deletedIds.length > 0 || snapshot(rows) !== snapshot(toRows(initialRows));
  useUnsavedGuard(dirty);

  const errors = categoryNameErrors(rows.map((r) => r.name));
  const update = (key: string, patch: Partial<Row>) =>
    setRows((list) =>
      list.map((r) => (r.key === key ? { ...r, ...patch } : r)),
    );
  const move = (index: number, delta: -1 | 1) =>
    setRows((list) => {
      const next = [...list];
      const [item] = next.splice(index, 1);
      next.splice(index + delta, 0, item);
      return next;
    });
  const add = () => {
    newCount.current += 1;
    const key = `new-${newCount.current}`;
    setRows((list) => [
      ...list,
      {
        id: "",
        key,
        name: "",
        costType: null,
        isActive: true,
        usedMonths: 0,
        isNew: true,
      },
    ]);
    requestAnimationFrame(() =>
      document.getElementById(`cat-name-${key}`)?.focus(),
    );
  };
  const remove = (row: Row) => {
    if (row.isNew) {
      setRows((list) => list.filter((r) => r.key !== row.key));
      return;
    }
    setDialog({
      title: `"${row.name}" 항목을 삭제할까요?`,
      body: (
        <p>
          한 번도 금액이 입력되지 않은 항목입니다. [변경 저장]을 눌러야 실제로
          삭제됩니다.
        </p>
      ),
      confirmLabel: "삭제",
      tone: "danger",
      onConfirm: () => {
        setRows((list) => list.filter((r) => r.key !== row.key));
        setDeletedIds((ids) => [...ids, row.id]);
      },
    });
  };

  const save = () => {
    setResult(null);
    startTransition(async () => {
      const res = await saveExpenseCategories({
        items: rows.map((r) => ({
          id: r.isNew ? null : r.id,
          name: r.name,
          costType: r.costType,
          isActive: r.isActive,
        })),
        deletedIds,
        version,
      });
      setResult(res);
      if (res.ok) router.refresh();
    });
  };

  const selectClass =
    "h-8 rounded-md border border-input bg-background px-2 text-sm";

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <div>
        <h2 className="text-sm font-semibold">그 외 지출 항목</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          순서는 월간 입력 화면의 표시 순서입니다. 비활성화한 항목은 월간
          입력에서 숨겨지고, 과거 금액은 대시보드에 그대로 남습니다. 금액이
          입력된 적 없는 항목만 삭제할 수 있습니다. 이름을 바꾸면 과거 금액의
          이름도 함께 바뀝니다 — 다른 용도로 쓰려면 새 항목을 추가하세요.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">그 외 지출 항목 목록</caption>
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="py-1.5 text-left font-normal">순서</th>
              <th className="py-1.5 text-left font-normal">항목명</th>
              <th className="py-1.5 text-left font-normal">
                고정/변동 (BEP용)
              </th>
              <th className="py-1.5 text-left font-normal">상태</th>
              <th className="py-1.5 text-right font-normal">사용</th>
              <th className="py-1.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const error = errors.get(index);
              return (
                <tr
                  key={row.key}
                  className={cn(
                    "border-b align-top",
                    !row.isActive && "bg-muted/40",
                  )}
                >
                  <td className="py-1.5">
                    <div className="flex gap-0.5">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => move(index, -1)}
                        className="rounded p-1 hover:bg-muted disabled:opacity-30"
                        aria-label={`${row.name || "새 항목"} 위로`}
                      >
                        <ArrowUp className="size-3.5" aria-hidden />
                      </button>
                      <button
                        type="button"
                        disabled={index === rows.length - 1}
                        onClick={() => move(index, 1)}
                        className="rounded p-1 hover:bg-muted disabled:opacity-30"
                        aria-label={`${row.name || "새 항목"} 아래로`}
                      >
                        <ArrowDown className="size-3.5" aria-hidden />
                      </button>
                    </div>
                  </td>
                  <td className="py-1.5 pr-2">
                    <input
                      id={`cat-name-${row.key}`}
                      value={row.name}
                      maxLength={NAME_MAX + 10}
                      onChange={(e) =>
                        update(row.key, { name: e.target.value })
                      }
                      aria-invalid={error ? true : undefined}
                      aria-describedby={
                        error ? `cat-err-${row.key}` : undefined
                      }
                      aria-label="항목명"
                      placeholder="예: 연구개발비"
                      className={cn(
                        "h-8 w-full rounded-md border border-input bg-background px-2 outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                        error && "border-destructive",
                      )}
                    />
                    {error && (
                      <p
                        id={`cat-err-${row.key}`}
                        className="mt-0.5 flex items-center gap-1 text-xs text-destructive"
                      >
                        <CircleAlert className="size-3" aria-hidden />
                        {error}
                      </p>
                    )}
                  </td>
                  <td className="py-1.5 pr-2">
                    <select
                      aria-label="고정비/변동비"
                      className={selectClass}
                      value={row.costType ?? ""}
                      onChange={(e) =>
                        update(row.key, {
                          costType:
                            e.target.value === ""
                              ? null
                              : (e.target.value as "FIXED" | "VARIABLE"),
                        })
                      }
                    >
                      <option value="">미분류</option>
                      <option value="FIXED">고정비</option>
                      <option value="VARIABLE">변동비</option>
                    </select>
                  </td>
                  <td className="py-1.5 pr-2">
                    <button
                      type="button"
                      onClick={() =>
                        update(row.key, { isActive: !row.isActive })
                      }
                      aria-pressed={!row.isActive}
                      className="rounded-md border px-2 py-1 text-xs hover:bg-muted"
                    >
                      {row.isActive
                        ? "● 사용 중 → 비활성화"
                        : "○ 비활성 → 다시 사용"}
                    </button>
                  </td>
                  <td className="py-1.5 text-right text-xs text-muted-foreground tabular-nums">
                    {row.isNew ? "새 항목" : `${row.usedMonths}개월`}
                  </td>
                  <td className="py-1.5 text-right">
                    {(row.isNew || row.usedMonths === 0) && (
                      <button
                        type="button"
                        onClick={() => remove(row)}
                        className="rounded p-1 text-destructive hover:bg-destructive/10"
                        aria-label={`${row.name || "새 항목"} 삭제`}
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 rounded-md border px-3 py-1.5 text-sm hover:bg-muted"
        >
          <Plus className="size-3.5" aria-hidden />
          항목 추가
        </button>
        <button
          type="button"
          disabled={pending || !dirty || errors.size > 0}
          onClick={save}
          className="rounded-md bg-primary px-4 py-1.5 text-sm text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          변경 저장
        </button>
        {errors.size > 0 && (
          <span className="text-xs text-destructive">
            항목 이름을 확인하세요 (빈 이름·중복)
          </span>
        )}
        {dirty && errors.size === 0 && (
          <span className="text-xs text-amber-900">
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
