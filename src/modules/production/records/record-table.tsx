"use client";
// 제조내역 표 + [수정] 창 + [숨김]/[복구] — 친구 저장소 ProductionRecordsView.vue · RecordEditModal.vue
import { useId, useState, useTransition } from "react";

import { INDUSTRIES } from "@/shared/contracts/production";
import { cn } from "@/shared/lib/utils";
import {
  DialogButtons,
  FieldError,
  Modal,
  fieldClass,
} from "@/shared/ui/modal";
import { buttonCompactClass, pillClass } from "@/shared/ui/styles";

import { INDUSTRY_LABEL, UNCLASSIFIED_LABEL, formatBush } from "../labels";
import { hideRecord, restoreRecord, updateRecord } from "./actions";
import type { RecordEditInput } from "./schemas";

export type RecordRow = Omit<RecordEditInput, "category" | "updatedAt"> & {
  updatedAt: string;
  sheetName: string;
  serialNo: string;
  category: string | null;
  sourceRow: number;
  fileName: string;
  updatedBy: string;
  updatedAtLabel: string;
  hidden: boolean;
  warnings: { field: string; message: string }[];
};

type Field = {
  key: keyof RecordEditInput;
  label: string;
  type?: "date" | "number";
  help?: string;
  wide?: boolean;
};

/** 수정 창 항목 묶음 (친구 저장소 RecordEditModal GROUPS 그대로) */
const GROUPS: { title: string; fields: Field[] }[] = [
  {
    title: "제품 사양",
    fields: [
      { key: "modelCode", label: "모델명" },
      {
        key: "bushSize",
        label: "부시 가공",
        help: "숫자 6자리 (예: 301008 → Ø30x10x08)",
      },
      { key: "rpm", label: "rpm" },
      { key: "power", label: "전원" },
    ],
  },
  {
    title: "제조·검사",
    fields: [
      { key: "manufacturedDate", label: "제조년월", type: "date" },
      { key: "inspectedDate", label: "검사일자", type: "date" },
      { key: "inspectionNo", label: "검사번호" },
    ],
  },
  {
    title: "판매·납품",
    fields: [
      { key: "orderNo", label: "수주번호", help: "엑셀 PO번호" },
      { key: "soNo", label: "SO번호" },
      { key: "customerOrderNo", label: "거래처 주문번호" },
      { key: "seller", label: "판매처", help: "엑셀 거래처" },
      { key: "finalClient", label: "최종발주처" },
      { key: "projectName", label: "사업명", wide: true },
      { key: "dueDate", label: "납기일자", type: "date" },
      { key: "shippedDate", label: "출고일자", type: "date" },
      {
        key: "quantity",
        label: "수량",
        type: "number",
        help: "엑셀에 없는 항목. 확인된 경우에만 입력",
      },
    ],
  },
  {
    title: "비고·기타",
    fields: [
      { key: "note", label: "비고", wide: true },
      { key: "etc", label: "기타" },
      { key: "note2", label: "비고2" },
      { key: "opun", label: "OPUN" },
      { key: "clun", label: "CLUN" },
      { key: "oplo", label: "OPLO" },
      { key: "cllo", label: "CLLO" },
    ],
  },
];

const dash = (v: string | null | undefined) => v || "-";

function EditDialog({ row, onClose }: { row: RecordRow; onClose: () => void }) {
  const titleId = useId();
  const [form, setForm] = useState<RecordEditInput>(
    () =>
      ({
        ...Object.fromEntries(
          GROUPS.flatMap((g) =>
            g.fields.map((f) => [
              f.key,
              String(row[f.key as keyof RecordRow] ?? ""),
            ]),
          ),
        ),
        id: row.id,
        updatedAt: row.updatedAt,
        category: row.category ?? "",
      }) as RecordEditInput,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await updateRecord(form);
      if (result.ok) onClose();
      else setError(result.message);
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`제조내역 수정 — ${row.serialNo}`}
      titleId={titleId}
      wide
    >
      <form
        onSubmit={submit}
        className="max-h-[70vh] space-y-5 overflow-y-auto pr-1"
      >
        <p className="text-xs text-muted-foreground">
          시트 {row.sheetName} · 엑셀 {row.sourceRow}행 · {row.fileName}.
          시트·일련번호는 바꿀 수 없습니다(잘못 올라왔으면 숨기고 다시 업로드).
        </p>
        {GROUPS.map((g) => (
          <fieldset key={g.title}>
            <legend className="mb-2 text-sm font-semibold">{g.title}</legend>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {g.fields.map((f) => {
                const id = `${titleId}-${f.key}`;
                const warning = row.warnings.find((w) => w.field === f.key);
                return (
                  <label
                    key={f.key}
                    htmlFor={id}
                    className={cn("text-sm", f.wide && "sm:col-span-2")}
                  >
                    <span className="mb-1 block text-xs text-muted-foreground">
                      {f.label}
                    </span>
                    <input
                      id={id}
                      type={f.type === "date" ? "date" : "text"}
                      inputMode={f.type === "number" ? "numeric" : undefined}
                      value={String(form[f.key] ?? "")}
                      onChange={(e) =>
                        setForm({ ...form, [f.key]: e.target.value })
                      }
                      className={fieldClass}
                    />
                    {f.help && (
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {f.help}
                      </span>
                    )}
                    {warning && (
                      <span className="mt-1 block text-xs text-warning-strong">
                        {warning.message}
                      </span>
                    )}
                  </label>
                );
              })}
              {g.title === "판매·납품" && (
                <label className="text-sm sm:col-span-2">
                  <span className="mb-1 block text-xs text-muted-foreground">
                    사업구분 (같은 수주번호 전체에 적용)
                  </span>
                  <select
                    value={form.category}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        category: e.target.value as RecordEditInput["category"],
                      })
                    }
                    disabled={!form.orderNo}
                    className={fieldClass}
                  >
                    <option value="">{UNCLASSIFIED_LABEL}</option>
                    {INDUSTRIES.map((i) => (
                      <option key={i.key} value={i.key}>
                        {i.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
          </fieldset>
        ))}
        <p className="text-xs text-muted-foreground">
          최근 수정: {row.updatedBy} · {row.updatedAtLabel}
        </p>
        <FieldError id={`${titleId}-error`} message={error ?? undefined} />
        <DialogButtons
          onCancel={onClose}
          submitLabel="저장"
          pending={pending}
        />
      </form>
    </Modal>
  );
}

export function RecordTable({
  rows,
  canEdit,
  canHide,
}: {
  rows: RecordRow[];
  canEdit: boolean;
  canHide: boolean;
}) {
  const [editing, setEditing] = useState<RecordRow | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();

  const toggleHidden = (row: RecordRow) => {
    if (
      !row.hidden &&
      !window.confirm(
        `${row.serialNo}을(를) 숨길까요? 실적·검색에서 빠지고, [숨긴 행 보기]에서 복구할 수 있습니다.`,
      )
    )
      return;
    startTransition(async () => {
      const result = row.hidden
        ? await restoreRecord(row.id)
        : await hideRecord(row.id);
      setMessage({
        ok: result.ok,
        text: result.ok ? `${row.serialNo}: ${result.message}` : result.message,
      });
    });
  };

  return (
    <>
      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={cn(
            "px-6 pb-3 text-sm",
            message.ok ? "text-primary" : "text-destructive",
          )}
        >
          {message.text}
        </p>
      )}
      {/* 행이 없어도 이 컴포넌트는 남긴다 — 숨긴 행 보기에서 마지막 행을 복구해도 "복구했습니다"가 보이게 */}
      {rows.length === 0 ? (
        <p className="px-6 text-sm text-muted-foreground">
          조건에 맞는 제조내역이 없습니다.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[72rem] text-sm">
            <thead>
              <tr className="border-b bg-muted text-left text-xs text-muted-foreground">
                {[
                  "일련번호",
                  "모델명",
                  "부시 가공",
                  "판매처",
                  "최종발주처",
                  "수주번호",
                  "사업구분",
                  "제조년월",
                  "납기일자",
                  "출고일자",
                  "수량",
                  "비고",
                  "",
                ].map((h, i) => (
                  <th
                    key={i}
                    className={cn(
                      "px-3 py-2 font-medium",
                      h === "수량" && "text-right",
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className={cn(
                    "border-b align-top last:border-0",
                    r.hidden && "text-muted-foreground",
                  )}
                >
                  <td className="px-3 py-2 font-medium">
                    {r.serialNo}
                    <span className="block text-xs font-normal text-muted-foreground">
                      {r.sheetName}
                    </span>
                  </td>
                  <td className="px-3 py-2">{dash(r.modelCode)}</td>
                  <td className="px-3 py-2">
                    {dash(formatBush(r.bushSize ?? ""))}
                  </td>
                  <td className="px-3 py-2">{dash(r.seller)}</td>
                  <td className="px-3 py-2">{dash(r.finalClient)}</td>
                  <td className="px-3 py-2">{dash(r.orderNo)}</td>
                  <td className="px-3 py-2">
                    {r.category ? (
                      <span
                        className={cn(pillClass, "bg-brand-soft text-primary")}
                      >
                        {INDUSTRY_LABEL[r.category]}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {UNCLASSIFIED_LABEL}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {dash(r.manufacturedDate?.slice(0, 7))}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{dash(r.dueDate)}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {r.shippedDate || (
                      <span
                        className={cn(
                          pillClass,
                          "bg-warning-soft text-warning-strong",
                        )}
                      >
                        출고일 없음
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {r.quantity || (
                      <span className="text-xs text-muted-foreground">
                        미입력
                      </span>
                    )}
                  </td>
                  <td
                    className="max-w-48 truncate px-3 py-2"
                    title={r.note ?? ""}
                  >
                    {dash(r.note)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex justify-end gap-1">
                      {!r.hidden && (
                        <button
                          type="button"
                          disabled={!canEdit}
                          title={
                            canEdit ? undefined : "열람 전용 — 수정은 팀장만"
                          }
                          onClick={() => setEditing(r)}
                          className={buttonCompactClass}
                        >
                          수정
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={pending || !canHide}
                        title={
                          canHide ? undefined : "열람 전용 — 숨기기는 팀장만"
                        }
                        onClick={() => toggleHidden(r)}
                        className={buttonCompactClass}
                      >
                        {r.hidden ? "복구" : "숨김"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <EditDialog row={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
