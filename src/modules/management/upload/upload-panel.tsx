"use client";
// 업로드 영역(기준 연도·끌어다 놓기) + 미리보기(시트별 표, 오류 행 빨간색) + [저장]
import { CircleAlert, FileSpreadsheet, Info, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { cn } from "@/shared/lib/utils";

import { previewUpload, saveUpload } from "./actions";
import type { PreviewSheet, UploadPreview } from "./parse-upload";

const KIND_BADGE: Record<PreviewSheet["kind"], string> = {
  annualTarget: "bg-blue-100 text-blue-800",
  monthly: "bg-emerald-100 text-emerald-800",
  unknown: "bg-muted text-muted-foreground",
};

export function UploadPanel({
  thisYear,
  canSave,
  notice,
}: {
  thisYear: number;
  canSave: boolean;
  /** 저장 권한이 없을 때 안내 */
  notice: string | null;
}) {
  const [baseYear, setBaseYear] = useState(thisYear);
  const [files, setFiles] = useState<File[]>([]);
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [saved, setSaved] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const formOf = (list: File[], year: number) => {
    const form = new FormData();
    list.forEach((f) => form.append("files", f));
    form.set("baseYear", String(year));
    return form;
  };

  const runPreview = (list: File[], year: number) => {
    setMessage(null);
    setSaved(false);
    if (list.length === 0) {
      setPreview(null);
      return;
    }
    startTransition(async () => {
      const result = await previewUpload(formOf(list, year));
      if (result.ok) setPreview(result.preview);
      else {
        setPreview(null);
        setMessage({ ok: false, text: result.message });
      }
    });
  };

  const choose = (list: FileList | null) => {
    const next = Array.from(list ?? []);
    setFiles(next);
    runPreview(next, baseYear);
  };

  const save = () => {
    setMessage(null);
    startTransition(async () => {
      const result = await saveUpload(formOf(files, baseYear));
      setMessage({ ok: result.ok, text: result.message });
      if (result.ok) setSaved(true);
      else if (result.preview) setPreview(result.preview);
    });
  };

  const years = Array.from({ length: 7 }, (_, i) => thisYear - 6 + i);
  const canPressSave =
    canSave && !!preview?.canSave && !pending && !saved && files.length > 0;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border bg-card p-4">
        {notice && (
          <p className="mb-3 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
            {notice}
          </p>
        )}
        <label className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">
            실적 시트에 연도 열이 없을 때 기준 연도
          </span>
          <select
            value={baseYear}
            onChange={(e) => {
              const year = Number(e.target.value);
              setBaseYear(year);
              runPreview(files, year);
            }}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}년
              </option>
            ))}
          </select>
        </label>

        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            choose(e.dataTransfer.files);
          }}
          className={cn(
            "mt-3 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-10 text-center transition-colors",
            dragging ? "border-blue-500 bg-blue-50" : "hover:bg-muted/50",
          )}
        >
          <Upload className="size-7 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">
            엑셀 파일을 여기에 끌어다 놓거나 클릭해서 선택
          </p>
          <p className="text-xs text-muted-foreground">
            .xlsx / .csv · 여러 파일 동시 선택 가능
          </p>
          {files.length > 0 && (
            <p className="mt-1 flex flex-wrap justify-center gap-x-3 text-xs">
              {files.map((f) => (
                <span key={f.name} className="inline-flex items-center gap-1">
                  <FileSpreadsheet className="size-3.5" aria-hidden />
                  {f.name}
                </span>
              ))}
            </p>
          )}
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".xlsx,.csv,.xls"
            className="sr-only"
            onChange={(e) => {
              choose(e.target.files);
              e.target.value = "";
            }}
          />
        </div>
      </section>

      {(preview || pending || message) && (
        <section
          className="space-y-3 rounded-lg border bg-card p-4"
          aria-busy={pending}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">미리보기</h2>
            <div className="flex flex-wrap items-center gap-3">
              <label
                className="flex items-center gap-1.5 text-sm text-muted-foreground"
                title="매출내역 시트(다음 단계)를 올릴 때 적용됩니다"
              >
                <input type="checkbox" disabled />
                해당 연도의 기존 매출 내역을 지우고 교체
              </label>
              <button
                type="button"
                onClick={save}
                disabled={!canPressSave}
                className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {pending ? "처리 중…" : "저장"}
              </button>
            </div>
          </div>

          <p className="flex items-start gap-1.5 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-900">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden />
            같은 파일을 두 번 올리면 매출 내역·미수금이 중복 등록됩니다. 다시
            올릴 때는 &apos;지우고 교체&apos;를 선택해 주세요.
          </p>

          {message && (
            <p
              role={message.ok ? "status" : "alert"}
              className={cn(
                "text-sm",
                message.ok ? "text-emerald-700" : "text-destructive",
              )}
            >
              {message.text}
            </p>
          )}

          {preview && (
            <>
              <p className="text-sm">
                저장할 행 <strong>{preview.saveCount}</strong>개
                {preview.errorCount > 0 && (
                  <span className="ml-2 text-destructive">
                    · 오류 {preview.errorCount}건 — 고친 뒤 다시 올려 주세요
                  </span>
                )}
              </p>
              {preview.fileErrors.map((f) => (
                <p
                  key={f.fileName}
                  role="alert"
                  className="flex gap-1.5 text-sm text-destructive"
                >
                  <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {f.fileName}: {f.error}
                </p>
              ))}
              {preview.sheets.map((sheet) => (
                <SheetPreview
                  key={`${sheet.fileName}/${sheet.sheetName}`}
                  sheet={sheet}
                />
              ))}
            </>
          )}
        </section>
      )}
    </div>
  );
}

function SheetPreview({ sheet }: { sheet: PreviewSheet }) {
  return (
    <div className="space-y-1.5">
      <h3 className="flex flex-wrap items-center gap-2 text-sm font-medium">
        {sheet.fileName} › {sheet.sheetName}
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-xs",
            KIND_BADGE[sheet.kind],
          )}
        >
          {sheet.kindLabel}
        </span>
        <span className="text-xs font-normal text-muted-foreground">
          {sheet.rows.length}행
        </span>
      </h3>
      {sheet.notes.map((n) => (
        <p key={n} className="text-xs text-muted-foreground">
          {n}
        </p>
      ))}
      {sheet.rows.length > 0 && (
        <div className="max-h-96 overflow-auto rounded-md border">
          <table className="w-full min-w-max text-sm">
            <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
              <tr>
                <th className="px-2 py-1.5 text-left font-normal">행</th>
                {sheet.columns.map((c) => (
                  <th
                    key={c}
                    className="px-2 py-1.5 text-right font-normal first:text-left"
                  >
                    {c}
                  </th>
                ))}
                <th className="px-2 py-1.5 text-left font-normal">확인</th>
              </tr>
            </thead>
            <tbody>
              {sheet.rows.map((row) => (
                <tr
                  key={row.rowNumber}
                  className={cn(
                    "border-t",
                    row.status === "error" && "bg-red-50 text-red-700",
                    row.status === "total" &&
                      "bg-muted/50 text-muted-foreground",
                  )}
                >
                  <td className="px-2 py-1 tabular-nums">{row.rowNumber}</td>
                  {row.cells.map((cell, i) => (
                    <td key={i} className="px-2 py-1 text-right tabular-nums">
                      {cell}
                    </td>
                  ))}
                  <td className="px-2 py-1 text-xs">
                    {row.messages.length === 0 ? "✓" : row.messages.join(" · ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
