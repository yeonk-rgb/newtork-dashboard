"use client";
// 제조내역 업로드: 파일 선택 → 미리보기(새로 저장·바뀐 행·숨긴 행·건너뜀·경고) → 바뀐 행 중 덮어쓸 것 체크 → [저장]
// 친구 저장소 ProductionUploadView.vue 와 같은 흐름. 판정·저장은 모두 서버가 파일을 다시 읽어서 한다
import { FileSpreadsheet, Upload } from "lucide-react";
import { useRef, useState, useTransition } from "react";

import { cn } from "@/shared/lib/utils";
import {
  buttonPrimaryClass,
  cardTitleClass,
  pillClass,
} from "@/shared/ui/styles";

import { previewProductionUpload, saveProductionUpload } from "./actions";
import type { PreviewRow, UploadPreview } from "./preview";

/** 목록은 처음 이만큼만 그리고 나머지는 "더 보기" */
const LIST_LIMIT = 50;

const SUMMARY: { key: keyof UploadPreview["summary"]; label: string }[] = [
  { key: "created", label: "새로 저장" },
  { key: "changed", label: "값이 다른 기존 행" },
  { key: "unchanged", label: "변경 없음" },
  { key: "hidden", label: "숨긴 행과 같음" },
  { key: "skipped", label: "건너뜀(일련번호 없음)" },
  { key: "errors", label: "오류" },
  { key: "warnings", label: "변환 경고" },
];

const dash = (v: string | null) => v || "-";

function RowTable({
  rows,
  limit,
  children,
}: {
  rows: PreviewRow[];
  limit: number;
  children?: (row: PreviewRow) => React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[44rem] text-sm">
        <thead>
          <tr className="border-b bg-muted text-left text-xs text-muted-foreground">
            {children && <th className="px-3 py-2 font-medium">덮어쓰기</th>}
            {[
              "시트·행",
              "일련번호",
              "모델명",
              "판매처",
              "수주번호",
              "납기일자",
              "출고일자",
            ].map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, limit).map((r) => (
            <tr key={r.key} className="border-b align-top last:border-0">
              {children && <td className="px-3 py-2">{children(r)}</td>}
              <td className="px-3 py-2 text-muted-foreground">
                {r.sheet} · {r.row}행
              </td>
              <td className="px-3 py-2 font-medium">{r.serialNo}</td>
              <td className="px-3 py-2">{dash(r.modelCode)}</td>
              <td className="px-3 py-2">{dash(r.seller)}</td>
              <td className="px-3 py-2">{dash(r.orderNo)}</td>
              <td className="px-3 py-2 tabular-nums">{dash(r.dueDate)}</td>
              <td className="px-3 py-2 tabular-nums">
                {r.shippedDate ?? (
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
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > limit && (
        <p className="px-3 py-2 text-xs text-muted-foreground">
          외 {(rows.length - limit).toLocaleString("ko-KR")}행
        </p>
      )}
    </div>
  );
}

export function UploadPanel({ canEdit }: { canEdit: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [overwrite, setOverwrite] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [saved, setSaved] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const formOf = (f: File, keys: string[] = []) => {
    const form = new FormData();
    form.set("file", f);
    form.set("overwrite", JSON.stringify(keys));
    return form;
  };

  const choose = (list: FileList | null) => {
    const next = list?.[0] ?? null;
    setFile(next);
    setMessage(null);
    setSaved(false);
    setOverwrite(new Set());
    setPreview(null);
    if (!next) return;
    startTransition(async () => {
      const result = await previewProductionUpload(formOf(next));
      if (result.ok) setPreview(result.preview);
      else setMessage({ ok: false, text: result.message });
    });
  };

  const save = () => {
    if (!file) return;
    setMessage(null);
    startTransition(async () => {
      const result = await saveProductionUpload(formOf(file, [...overwrite]));
      setMessage({ ok: result.ok, text: result.message });
      if (result.ok) setSaved(true);
    });
  };

  const toggle = (key: string, on: boolean) =>
    setOverwrite((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });

  const nothingToSave =
    !!preview && preview.summary.created === 0 && overwrite.size === 0;
  const canPressSave =
    canEdit &&
    !!preview &&
    !preview.alreadyUploaded &&
    !nothingToSave &&
    !pending &&
    !saved;
  const limit = showAll ? Infinity : LIST_LIMIT;

  return (
    <div className="space-y-6">
      <section className="rounded-card border bg-card p-6">
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
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-10 text-center transition-colors duration-150",
            dragging ? "border-primary bg-brand-soft" : "hover:bg-primary-50",
          )}
        >
          <Upload className="size-5 text-muted-foreground" aria-hidden />
          <p className="text-sm font-medium">
            제조내역 엑셀(.xlsx)을 여기에 끌어다 놓거나 클릭해서 선택
          </p>
          <p className="text-xs text-muted-foreground">
            8~9행 머리글, 10행부터 데이터 · 최대 5MB
          </p>
          {file && (
            <p className="flex items-center gap-1 text-sm">
              <FileSpreadsheet className="size-4" aria-hidden />
              {file.name}
            </p>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="hidden"
          onChange={(e) => {
            choose(e.target.files);
            e.target.value = "";
          }}
        />
        {pending && !preview && (
          <p className="mt-3 text-sm text-muted-foreground">파일 읽는 중…</p>
        )}
        {message && (
          <p
            role={message.ok ? "status" : "alert"}
            className={cn(
              "mt-3 text-sm",
              message.ok ? "text-primary" : "text-destructive",
            )}
          >
            {message.text}
          </p>
        )}
      </section>

      {preview && (
        <>
          {preview.alreadyUploaded && (
            <p
              role="alert"
              className="rounded-card border bg-danger-soft px-6 py-4 text-sm text-danger-strong"
            >
              이미 업로드한 파일입니다 (
              {preview.alreadyUploaded.uploadedAt.slice(0, 10)},{" "}
              {preview.alreadyUploaded.uploadedBy}). 내용을 고친 파일이라면
              수정본을 저장한 뒤 다시 올려 주세요.
            </p>
          )}

          <section className="rounded-card border bg-card p-6">
            <h2 className={cardTitleClass}>미리보기 — {preview.fileName}</h2>
            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
              {SUMMARY.map(({ key, label }) => (
                <div key={key}>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="mt-1 text-xl font-bold tabular-nums">
                    {preview.summary[key].toLocaleString("ko-KR")}
                  </dd>
                </div>
              ))}
            </dl>
            {preview.summary.noShippedDate > 0 && (
              <p className="mt-3 text-xs text-muted-foreground">
                새 행 중 출고일 없음{" "}
                {preview.summary.noShippedDate.toLocaleString("ko-KR")}행 —
                저장은 되지만 생산 실적에는 들어가지 않습니다.
              </p>
            )}
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 font-medium">시트</th>
                  <th className="py-2 text-right font-medium">읽은 행</th>
                  <th className="py-2 text-right font-medium">건너뜀</th>
                  <th className="py-2 text-right font-medium">파일 안 중복</th>
                  <th className="py-2 font-medium">상태</th>
                </tr>
              </thead>
              <tbody>
                {preview.sheets.map((s) => (
                  <tr key={s.name} className="border-b last:border-0">
                    <td className="py-2">{s.name}</td>
                    <td className="py-2 text-right tabular-nums">{s.rows}</td>
                    <td className="py-2 text-right tabular-nums">
                      {s.skipped}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {s.duplicatesInFile}
                    </td>
                    <td className="py-2 text-xs">
                      {s.error ? (
                        <span className="text-destructive">{s.error}</span>
                      ) : (
                        <span className="text-muted-foreground">양식 일치</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {preview.changed.length > 0 && (
            <section className="rounded-card border bg-card p-6">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className={cardTitleClass}>
                  값이 다른 기존 행{" "}
                  {preview.changed.length.toLocaleString("ko-KR")}건
                </h2>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-primary"
                    checked={overwrite.size === preview.changed.length}
                    onChange={(e) =>
                      setOverwrite(
                        e.target.checked
                          ? new Set(preview.changed.map((r) => r.key))
                          : new Set(),
                      )
                    }
                  />
                  모두 덮어쓰기
                </label>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                체크한 행만 엑셀 값으로 덮어씁니다. 수량 등 엑셀에 없는 값은
                그대로 둡니다.
              </p>
              <ul className="mt-4 space-y-3">
                {preview.changed.slice(0, limit).map((r) => (
                  <li key={r.key} className="rounded-lg border p-3 text-sm">
                    <label className="flex items-center gap-2 font-medium">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        checked={overwrite.has(r.key)}
                        onChange={(e) => toggle(r.key, e.target.checked)}
                      />
                      {r.serialNo}
                      <span className="text-xs font-normal text-muted-foreground">
                        {r.sheet} · {r.row}행
                      </span>
                    </label>
                    <ul className="mt-2 space-y-1 pl-6 text-xs">
                      {r.diffs.map((d) => (
                        <li key={d.field}>
                          <span className="text-muted-foreground">
                            {d.label}:
                          </span>{" "}
                          {d.before || "(없음)"} →{" "}
                          <strong>{d.after || "(없음)"}</strong>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {preview.created.length > 0 && (
            <section className="rounded-card border bg-card p-6">
              <h2 className={cardTitleClass}>
                새로 저장 {preview.created.length.toLocaleString("ko-KR")}행
              </h2>
              <div className="mt-4">
                <RowTable rows={preview.created} limit={limit} />
              </div>
            </section>
          )}

          {preview.hidden.length > 0 && (
            <section className="rounded-card border bg-card p-6">
              <h2 className={cardTitleClass}>
                숨긴 행과 같은 일련번호{" "}
                {preview.hidden.length.toLocaleString("ko-KR")}행
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                저장하지 않습니다. 다시 쓰려면 제조내역 화면의 [숨긴 행
                보기]에서 복구하세요.
              </p>
              <div className="mt-4">
                <RowTable rows={preview.hidden} limit={limit} />
              </div>
            </section>
          )}

          {(preview.errors.length > 0 || preview.warnings.length > 0) && (
            <section className="rounded-card border bg-card p-6">
              <h2 className={cardTitleClass}>오류·변환 경고</h2>
              <ul className="mt-3 space-y-1 text-sm">
                {preview.errors.map((e, i) => (
                  <li key={`e${i}`} className="text-destructive">
                    [{e.sheet}
                    {e.row ? ` ${e.row}행` : ""}] {e.message}
                  </li>
                ))}
                {preview.warnings.slice(0, limit).map((w, i) => (
                  <li key={`w${i}`} className="text-warning-strong">
                    [{w.sheet} {w.row}행 · {w.serialNo}] {w.message}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="flex flex-wrap items-center justify-end gap-3">
            {!showAll &&
              Math.max(
                preview.created.length,
                preview.changed.length,
                preview.hidden.length,
                preview.warnings.length,
              ) > LIST_LIMIT && (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  className="text-sm text-primary hover:underline"
                >
                  목록 모두 보기
                </button>
              )}
            {nothingToSave && !preview.alreadyUploaded && (
              <span className="text-sm text-muted-foreground">
                저장할 내용이 없습니다 (새 일련번호 없음, 덮어쓸 행 선택 안 함)
              </span>
            )}
            <button
              type="button"
              onClick={save}
              disabled={!canPressSave}
              className={buttonPrimaryClass}
            >
              {pending ? "처리 중…" : saved ? "저장됨" : "저장"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
