"use client";
// 경영지원 관리 [지난달 내용 불러오기] 버튼 + 미리보기 모달 — 이번 달이 비어 있을 때만 화면에 보인다 (2026-10-26 결정 05-23)
import { CopyPlus, Info } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { formatAmount } from "@/shared/format/money";
import { buttonPrimaryClass, buttonSecondaryClass } from "@/shared/ui/styles";

import { Modal } from "@/shared/ui/modal";
import { TERMS } from "../terms";
import {
  copyPreviousMonth,
  previewCopyPrevious,
  type CopyPreview,
} from "./copy-actions";
import { KIND_LABEL } from "./labels";

const won = (v: string | bigint) => `${formatAmount(BigInt(v))}원`;

export function CopyPreviousButton({
  month,
  onDone,
}: {
  /** 기준년월 "YYYY-MM" */
  month: string;
  onDone: (message: string) => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<CopyPreview | null>(null);
  const [includeCollected, setIncludeCollected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const openDialog = () => {
    setPreview(null);
    setError(null);
    setIncludeCollected(false);
    setOpen(true);
    startTransition(async () =>
      setPreview(await previewCopyPrevious({ month })),
    );
  };

  const save = (p: Extract<CopyPreview, { ok: true }>) => {
    setError(null);
    startTransition(async () => {
      const res = await copyPreviousMonth({
        month,
        includeCollected,
        expectedSourceCount: p.sourceCount,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setOpen(false);
      onDone(res.message);
      router.refresh();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className={buttonSecondaryClass}
      >
        <CopyPlus className="size-4" aria-hidden />
        지난달 내용 불러오기
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`${month} ${TERMS.ledger} — 지난달 내용 불러오기`}
        titleId="ledger-copy-title"
      >
        {!preview ? (
          <p className="text-sm text-muted-foreground">불러오는 중…</p>
        ) : !preview.ok ? (
          <p role="alert" className="text-sm text-destructive">
            {preview.message}
          </p>
        ) : (
          <Body
            preview={preview}
            includeCollected={includeCollected}
            onIncludeCollected={setIncludeCollected}
            error={error}
            pending={pending}
            onCancel={() => setOpen(false)}
            onSave={() => save(preview)}
          />
        )}
      </Modal>
    </>
  );
}

function Body({
  preview,
  includeCollected,
  onIncludeCollected,
  error,
  pending,
  onCancel,
  onSave,
}: {
  preview: Extract<CopyPreview, { ok: true }>;
  includeCollected: boolean;
  onIncludeCollected: (v: boolean) => void;
  error: string | null;
  pending: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  const collected = preview.collected;
  const rows = preview.kinds.map((k) =>
    k.kind === "AR" && includeCollected
      ? {
          ...k,
          count: k.count + collected.count,
          amount: (BigInt(k.amount) + BigInt(collected.amount)).toString(),
        }
      : k,
  );
  const total = rows.reduce((s, k) => s + k.count, 0);
  const blocked = preview.existing > 0;

  return (
    <div className="space-y-4 text-sm">
      <p className="flex gap-2 rounded-lg bg-brand-soft px-3 py-2 text-xs">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          {preview.from}의 행을 그대로 복사합니다(거래처·잔액·적요·예정일).
          수금·지급 완료일은 비웁니다. 불러온 뒤 잔액을 이번 달 값으로 고치세요.
        </span>
      </p>

      {blocked ? (
        <p role="alert" className="text-destructive">
          이번 달에 이미 {preview.existing}행이 있어 불러올 수 없습니다. (같은
          거래처가 두 번 들어가지 않도록)
        </p>
      ) : preview.sourceCount === 0 ? (
        <p>{preview.from}에 입력된 행이 없습니다.</p>
      ) : (
        <>
          <table className="w-full text-xs tabular-nums">
            <thead className="text-muted-foreground">
              <tr className="border-b">
                <th className="py-1 text-left font-normal">구분</th>
                <th className="py-1 text-right font-normal">행</th>
                <th className="py-1 text-right font-normal">잔액 합계</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((k) => (
                <tr key={k.kind} className="border-b last:border-0">
                  <td className="py-1.5">{KIND_LABEL[k.kind]}</td>
                  <td className="py-1.5 text-right">{k.count}</td>
                  <td className="py-1.5 text-right">{won(k.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {collected.count > 0 && (
            <label className="flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={includeCollected}
                onChange={(e) => onIncludeCollected(e.target.checked)}
              />
              <span>
                {TERMS.collected} {collected.count}행({won(collected.amount)})도
                불러오기
                <span className="block text-muted-foreground">
                  지난달에 이미 받은 돈이라 기본으로 뺍니다. 넣으면 “
                  {TERMS.scheduled}”으로 바꿔서 넣습니다.
                </span>
              </span>
            </label>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className={buttonSecondaryClass}
        >
          취소
        </button>
        {!blocked && total > 0 && (
          <button
            type="button"
            onClick={onSave}
            disabled={pending}
            className={buttonPrimaryClass}
          >
            {pending ? "불러오는 중…" : `${total}행 불러오기`}
          </button>
        )}
      </div>
    </div>
  );
}
