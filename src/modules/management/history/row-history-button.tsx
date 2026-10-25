"use client";
// 행 [이력] 버튼 + 모달 — 그 행의 기록 최신순, 엑셀 이관으로 생긴 행은 맨 아래에 "엑셀 이관으로 생성 — …"
// 열 때마다 서버에서 다시 읽는다 (Server Action getRowHistory — 권한 확인 포함)
import { useEffect, useRef, useState, useTransition } from "react";

import {
  buttonCompactClass,
  buttonSecondaryClass,
  cardTitleClass,
} from "@/shared/ui/styles";

import { getRowHistory, type RowHistoryResult } from "./actions";
import type { RowHistoryType } from "./rules";

export function RowHistoryButton({
  type,
  id,
  label,
}: {
  type: RowHistoryType;
  id: string;
  /** 모달 제목에 쓸 행 이름 (예: 거래처명) */
  label: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<RowHistoryResult | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const show = () => {
    setResult(null);
    setOpen(true);
    startTransition(async () => {
      try {
        setResult(await getRowHistory({ type, id }));
      } catch {
        setResult({
          ok: false,
          message: "이력을 불러오지 못했습니다. 다시 시도하세요.",
        });
      }
    });
  };

  const titleId = `row-history-${id}`;
  return (
    <>
      <button
        type="button"
        onClick={show}
        className={buttonCompactClass}
        aria-label={`${label} 변경 이력`}
      >
        이력
      </button>
      <dialog
        ref={ref}
        onClose={() => setOpen(false)}
        aria-labelledby={titleId}
        className="m-auto w-[min(40rem,calc(100vw-2rem))] rounded-card border bg-card p-6 text-left font-normal whitespace-normal text-card-foreground backdrop:bg-black/30"
      >
        {open && (
          <>
            <h2 id={titleId} className={cardTitleClass}>
              변경 이력 · {label}
            </h2>
            <div className="mt-4 max-h-[60vh] overflow-y-auto text-sm">
              {pending || !result ? (
                <p className="text-muted-foreground">불러오는 중…</p>
              ) : !result.ok ? (
                <p className="text-destructive">{result.message}</p>
              ) : (
                <HistoryList history={result.history} />
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={buttonSecondaryClass}
              >
                닫기
              </button>
            </div>
          </>
        )}
      </dialog>
    </>
  );
}

function HistoryList({
  history,
}: {
  history: Extract<RowHistoryResult, { ok: true }>["history"];
}) {
  if (history.rows.length === 0 && !history.origin) {
    return (
      <p className="text-muted-foreground">
        아직 기록이 없습니다. (변경 이력은 2026-10-25부터 남깁니다)
      </p>
    );
  }
  return (
    <ol className="space-y-3">
      {history.rows.map((r) => (
        <li key={r.id} className="rounded-lg border px-3 py-2">
          <p className="text-xs text-muted-foreground tabular-nums">
            {r.occurredAt} · {r.actor}
          </p>
          <p className="mt-0.5 font-medium">{r.action}</p>
          {r.lines.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-xs">
              {r.lines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </li>
      ))}
      {history.origin && (
        <li className="rounded-lg border border-dashed bg-muted/40 px-3 py-2 text-xs">
          {history.origin.text}
        </li>
      )}
    </ol>
  );
}
