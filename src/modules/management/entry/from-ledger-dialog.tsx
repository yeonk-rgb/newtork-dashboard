"use client";
// 월간 입력 [경영지원 관리에서 불러오기] 미리보기 (모달) — 확인하면 입력란에 값만 채우고, 저장은 [임시저장]·[확정]으로
// 계산은 from-ledger.ts (순수 함수), 행은 Server Action loadLedgerForEntry (읽기만)
import { CircleAlert, Info } from "lucide-react";
import { useState, useTransition } from "react";

import { formatAmount } from "@/shared/format/money";
import { cn } from "@/shared/lib/utils";
import { buttonPrimaryClass, buttonSecondaryClass } from "@/shared/ui/styles";

import { EXPENSE_TYPE_LABEL, KIND_LABEL } from "../ledger/labels";
import { Modal } from "../receivables/modal";
import { TERMS } from "../terms";
import { loadLedgerForEntry } from "./actions";
import { FIELD_LABEL } from "./field-help";
import {
  DEFAULT_VAT_CONVERT,
  defaultVendorCategory,
  FROM_LEDGER_BLOCKS,
  planFill,
  skippedNotes,
  sumLedgerRows,
  VENDOR_KEYS,
  type Choice,
  type FillLine,
  type LedgerSums,
} from "./from-ledger";
import type { EntryCategory } from "./load-entry";
import { digitsToBigInt } from "./money-input";
import type { EntryField } from "./schemas";

const won = (v: bigint) => `${formatAmount(v)}원`;
const selectClass =
  "h-8 rounded-lg border border-input bg-background px-2 text-xs hover:bg-primary-50";

export type FromLedgerFill = {
  values: Partial<Record<EntryField, string>>;
  other: Record<string, string>;
};

/** 버튼 + 모달. 열 때마다 그 달 행을 새로 읽는다 */
export function FromLedgerButton({
  year,
  month,
  categories,
  values,
  other,
  onApply,
}: {
  year: number;
  month: number;
  categories: EntryCategory[];
  values: Record<EntryField, string>;
  other: Record<string, string>;
  onApply: (fill: FromLedgerFill) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [state, setState] = useState<
    { sums: LedgerSums } | { error: string } | null
  >(null);

  const openDialog = () => {
    setState(null);
    setOpen(true);
    startTransition(async () => {
      const res = await loadLedgerForEntry({ year, month });
      setState(
        res.ok
          ? {
              sums: sumLedgerRows(
                res.rows.map((r) => ({ ...r, amount: BigInt(r.amount) })),
              ),
            }
          : { error: res.message },
      );
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className={buttonSecondaryClass}
      >
        {TERMS.ledger}에서 불러오기
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={`${year}년 ${month}월 ${TERMS.ledger}에서 불러오기`}
        titleId="entry-from-ledger-title"
        wide
      >
        {pending || state === null ? (
          <p className="text-sm text-muted-foreground">불러오는 중…</p>
        ) : "error" in state ? (
          <p role="alert" className="text-sm text-destructive">
            {state.error}
          </p>
        ) : state.sums.rowCount === 0 ? (
          <div className="space-y-4 text-sm">
            <p>
              {year}년 {month}월 {TERMS.ledger}에 외상매입금·미지급비용 입력이
              없습니다.
            </p>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={buttonSecondaryClass}
              >
                닫기
              </button>
            </div>
          </div>
        ) : (
          <Preview
            sums={state.sums}
            categories={categories}
            values={values}
            other={other}
            onCancel={() => setOpen(false)}
            onApply={(fill) => {
              onApply(fill);
              setOpen(false);
            }}
          />
        )}
      </Modal>
    </>
  );
}

function Preview({
  sums,
  categories,
  values,
  other,
  onCancel,
  onApply,
}: {
  sums: LedgerSums;
  categories: EntryCategory[];
  values: Record<EntryField, string>;
  other: Record<string, string>;
  onCancel: () => void;
  onApply: (fill: FromLedgerFill) => void;
}) {
  const active = categories.filter((c) => !c.inactive);
  const [choice, setChoice] = useState<Choice>(() => ({
    vat: DEFAULT_VAT_CONVERT,
    unclassifiedPurchase: null,
    vendorCategory: defaultVendorCategory(categories, EXPENSE_TYPE_LABEL),
  }));
  const lines = planFill(sums, choice);
  const notes = skippedNotes(sums, choice, EXPENSE_TYPE_LABEL, won);

  const nameOf = (line: FillLine) =>
    line.target.type === "field"
      ? FIELD_LABEL[line.target.field]
      : (categories.find(
          (c) =>
            line.target.type === "category" && c.id === line.target.categoryId,
        )?.name ?? "");
  const currentOf = (line: FillLine) =>
    digitsToBigInt(
      line.target.type === "field"
        ? values[line.target.field]
        : (other[line.target.categoryId] ?? ""),
    );

  const apply = () => {
    const fill: FromLedgerFill = { values: {}, other: {} };
    for (const line of lines) {
      if (line.target.type === "field")
        fill.values[line.target.field] = line.value.toString();
      else fill.other[line.target.categoryId] = line.value.toString();
    }
    onApply(fill);
  };

  const vendorExcel =
    sums.blockTotal.ACCRUED_VENDOR.amount - sums.vendorAuto.amount;

  return (
    <div className="space-y-5 text-sm">
      <p className="flex gap-2 rounded-lg bg-brand-soft px-3 py-2 text-xs">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>
          {TERMS.ledger} 금액은 부가세 포함입니다. 월간 입력은 공급가액이라
          체크한 묶음은 ÷1.1로 바꿔서 채웁니다. 입력란에만 채우고 저장은 하지
          않습니다. 매출 칸과 아래에 없는 칸은 그대로 둡니다.
        </span>
      </p>

      {FROM_LEDGER_BLOCKS.map((block) => {
        const total = sums.blockTotal[block];
        const blockLines = lines.filter((l) => l.block === block);
        return (
          <section key={block} className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-semibold">
                {KIND_LABEL[block]}{" "}
                <span className="font-normal text-muted-foreground">
                  {total.count}행 · 합계 {won(total.amount)}
                </span>
              </h3>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={choice.vat[block]}
                  disabled={total.count === 0}
                  onChange={(e) =>
                    setChoice((c) => ({
                      ...c,
                      vat: { ...c.vat, [block]: e.target.checked },
                    }))
                  }
                />
                ÷1.1 공급가액으로 환산
              </label>
            </div>

            {block === "ACCRUED_VENDOR" && total.count > 0 && (
              <dl className="grid grid-cols-[1fr_auto] gap-x-4 rounded-lg border px-3 py-2 text-xs tabular-nums">
                <dt className="text-muted-foreground">
                  총액 (자동이체 제외 — 엑셀 F열과 같은 값)
                </dt>
                <dd className="text-right">{won(vendorExcel)}</dd>
                <dt className="text-muted-foreground">자동이체 합계</dt>
                <dd className="text-right">{won(sums.vendorAuto.amount)}</dd>
                <dt className="font-medium">
                  전체 합계 ← 불러오는 금액 (자동이체 포함, 그 달에 실제로 나간
                  돈)
                </dt>
                <dd className="text-right font-medium">{won(total.amount)}</dd>
              </dl>
            )}

            {total.count === 0 ? (
              <p className="text-xs text-muted-foreground">
                이 달 입력 없음 — 해당 칸은 그대로 둡니다.
              </p>
            ) : (
              <BlockTable
                lines={blockLines}
                nameOf={nameOf}
                currentOf={currentOf}
              />
            )}

            {block === "AP" && sums.unclassifiedPurchase.count > 0 && (
              <ChoiceRow
                label={`매입유형 비어 있음 ${sums.unclassifiedPurchase.count}행 · ${won(sums.unclassifiedPurchase.amount)}`}
                value={choice.unclassifiedPurchase ?? ""}
                options={(["goodsPurchase", "materialPurchase"] as const).map(
                  (f) => ({ value: f, label: FIELD_LABEL[f] }),
                )}
                onChange={(v) =>
                  setChoice((c) => ({
                    ...c,
                    unclassifiedPurchase: (v || null) as EntryField | null,
                  }))
                }
              />
            )}
            {block === "ACCRUED_VENDOR" &&
              VENDOR_KEYS.filter((k) => sums.vendor[k].count > 0).map((k) => (
                <ChoiceRow
                  key={k}
                  label={`업체 "${EXPENSE_TYPE_LABEL[k]}" ${sums.vendor[k].count}행 · ${won(sums.vendor[k].amount)} → 그 외 지출 항목`}
                  value={choice.vendorCategory[k] ?? ""}
                  options={active.map((c) => ({ value: c.id, label: c.name }))}
                  onChange={(v) =>
                    setChoice((c) => ({
                      ...c,
                      vendorCategory: { ...c.vendorCategory, [k]: v || null },
                    }))
                  }
                />
              ))}
          </section>
        );
      })}

      {notes.length > 0 && (
        <ul className="space-y-1 rounded-lg bg-warning-soft px-3 py-2 text-xs text-warning-strong">
          {notes.map((n) => (
            <li key={n} className="flex gap-2">
              <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {n}
            </li>
          ))}
        </ul>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className={buttonSecondaryClass}
        >
          취소
        </button>
        <button
          type="button"
          onClick={apply}
          disabled={lines.length === 0}
          className={buttonPrimaryClass}
        >
          입력란에 채우기
        </button>
      </div>
    </div>
  );
}

function BlockTable({
  lines,
  nameOf,
  currentOf,
}: {
  lines: FillLine[];
  nameOf: (l: FillLine) => string;
  currentOf: (l: FillLine) => bigint;
}) {
  if (lines.length === 0)
    return <p className="text-xs text-muted-foreground">채울 칸이 없습니다.</p>;
  return (
    <table className="w-full table-fixed text-xs tabular-nums">
      <colgroup>
        <col className="w-[28%]" />
        <col className="w-[8%]" />
        <col className="w-[24%]" />
        <col className="w-[20%]" />
        <col className="w-[20%]" />
      </colgroup>
      <thead className="text-muted-foreground">
        <tr className="border-b">
          <th className="py-1 text-left font-normal">입력 칸</th>
          <th className="py-1 text-right font-normal">행</th>
          <th className="py-1 text-right font-normal">원본(부가세 포함)</th>
          <th className="py-1 text-right font-normal">지금 값</th>
          <th className="py-1 text-right font-normal">채울 값</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => {
          const current = currentOf(l);
          return (
            <tr key={nameOf(l)} className="border-b last:border-0">
              <td className="py-1.5">{nameOf(l)}</td>
              <td className="py-1.5 text-right">{l.count}</td>
              <td className="py-1.5 text-right">{won(l.source)}</td>
              <td className="py-1.5 text-right text-muted-foreground">
                {won(current)}
              </td>
              <td
                className={cn(
                  "py-1.5 text-right font-semibold",
                  current !== l.value && "text-primary",
                )}
              >
                {won(l.value)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function ChoiceRow({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-wrap items-center justify-between gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <select
        className={selectClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="">채우지 않음</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
