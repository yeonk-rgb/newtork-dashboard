"use client";
// 단가 데이터 업로드 (CSV·엑셀) — 파일 고르기 → [미리보기](DB 쓰기 없음) → [저장]
// 2026-11-05 담당자 피드백: 견적서 PDF 업로드 대신 CSV 부품 단가 데이터 업로드, 같은 내용은 덮어쓰기
// 저장할 때 서버가 파일을 다시 읽고 다시 판정한다 (미리보기 값은 보내지 않음)
import { useRef, useState, useTransition } from "react";

import { cn } from "@/shared/lib/utils";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  cardTitleClass,
  pillClass,
} from "@/shared/ui/styles";

import type { UploadKind } from "./parse-upload";
import {
  previewUnitPriceUpload,
  saveUnitPriceUpload,
  type PreviewLine,
  type UploadPreview,
} from "./upload-actions";

const KINDS: { kind: UploadKind; label: string; hint: string }[] = [
  {
    kind: "items",
    label: "부품 단가표",
    hint: '분류 · 파트넘버 · 품목 · 적용 모델 · 기준단가 — 고객사 "부품 및 단가리스트" 엑셀의 [부품] 시트도 그대로 올릴 수 있습니다',
  },
  {
    kind: "quotes",
    label: "출장지(판매처)별 단가 · 수주 내역",
    hint: "양식(파트넘버 · 품목 · 출장지 · 단가 · 적용 시작일 · 비고) 또는 회사 수주 내역 CSV(판매처 = 출장지, 수주일 = 적용 시작일, 제품정보-품명·단가) — 단가표에 없는 파트넘버는 품목으로 새로 등록합니다",
  },
];

const wonText = (v: number | null) =>
  v === null ? "(빈칸)" : `${v.toLocaleString("ko-KR")}원`;

export function UploadPanel({
  canEdit,
  fixedKind,
  title = "단가 데이터 업로드",
}: {
  canEdit: boolean;
  fixedKind?: UploadKind;
  title?: string;
}) {
  const [kind, setKind] = useState<UploadKind>(fixedKind ?? "items");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<UploadPreview | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const form = () => {
    const fd = new FormData();
    fd.set("kind", kind);
    if (file) fd.set("file", file);
    return fd;
  };
  const reset = () => {
    setPreview(null);
    setMessage(null);
  };
  const runPreview = () =>
    startTransition(async () => {
      setMessage(null);
      const r = await previewUnitPriceUpload(form());
      if (r.ok) setPreview(r.preview);
      else {
        setPreview(null);
        setMessage({ ok: false, text: r.message });
      }
    });
  const runSave = () =>
    startTransition(async () => {
      const r = await saveUnitPriceUpload(form());
      setMessage({ ok: r.ok, text: r.message });
      if (r.ok) {
        setPreview(null);
        setFile(null);
        if (inputRef.current) inputRef.current.value = "";
      }
    });
  const s = preview?.summary;
  const canSave =
    !!s && s.errors === 0 && s.created + s.changed > 0 && canEdit && !pending;
  const current = KINDS.find((k) => k.kind === kind)!;

  return (
    <section className="space-y-4 rounded-card border bg-card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={cardTitleClass}>{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            CSV(.csv) 또는 엑셀(.xlsx), 최대 5MB. 이미 있는{" "}
            {kind === "quotes" ? "부품·출장지·적용 시작일" : "파트넘버·품목"}
            은(는) 파일 값으로 덮어씁니다.
          </p>
        </div>
        <a
          href={`/api/service/unit-prices/template?kind=${kind}`}
          className={buttonSecondaryClass}
        >
          ⬇ {current.label} 양식(CSV)
        </a>
      </div>

      {!fixedKind && (
        <fieldset className="flex flex-wrap gap-2">
          <legend className="sr-only">올릴 자료</legend>
          {KINDS.map((k) => (
            <label
              key={k.kind}
              className={cn(
                "inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm",
                kind === k.kind && "border-primary bg-primary-50 text-primary",
              )}
            >
              <input
                type="radio"
                name="unit-price-kind"
                checked={kind === k.kind}
                onChange={() => {
                  setKind(k.kind);
                  reset();
                }}
              />
              {k.label}
            </label>
          ))}
        </fieldset>
      )}
      <p className="text-xs text-muted-foreground">{current.hint}</p>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx"
          aria-label={`${current.label} 파일`}
          disabled={!canEdit}
          onChange={(e) => {
            setFile(e.target.files?.[0] ?? null);
            reset();
          }}
          className="text-sm file:mr-3 file:h-10 file:rounded-lg file:border file:bg-card file:px-4 file:text-sm"
        />
        <button
          type="button"
          disabled={!file || !canEdit || pending}
          onClick={runPreview}
          className={buttonSecondaryClass}
        >
          미리보기
        </button>
        <button
          type="button"
          disabled={!canSave}
          onClick={runSave}
          className={buttonPrimaryClass}
        >
          저장
        </button>
      </div>

      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={cn(
            "rounded-lg px-3 py-2 text-sm",
            message.ok
              ? "bg-primary-50 text-primary"
              : "bg-danger-soft text-danger-strong",
          )}
        >
          {message.text}
        </p>
      )}

      {preview && s && (
        <div className="space-y-3">
          <p className="text-sm">
            <b>{preview.fileName}</b>
            <span className="text-muted-foreground">
              {" "}
              · 시트 &quot;{preview.sheetName}&quot;
              {preview.original && " (원본 [부품] 시트 형식으로 읽음)"}
              {preview.orderFormat &&
                " (수주 내역 형식으로 읽음 — 판매처 = 출장지, 수주일 = 적용 시작일)"}
            </span>
          </p>
          <div className="flex flex-wrap gap-2 text-xs">
            <Count label="새로 저장" n={s.created} tone="primary" />
            {s.newParts > 0 && (
              <Count label="새 부품 등록" n={s.newParts} tone="primary" />
            )}
            <Count label="덮어씀" n={s.changed} tone="copper" />
            <Count label="변경 없음" n={s.unchanged} />
            {s.hidden > 0 && (
              <Count label="숨긴 행과 같음 (저장 안 함)" n={s.hidden} />
            )}
            <Count
              label={
                preview.orderFormat
                  ? "건너뜀 (파트넘버·단가 없는 줄 — 출장수리비 등)"
                  : "건너뜀 (빈 줄·분류 제목)"
              }
              n={s.skipped}
            />
            {s.superseded > 0 && (
              <Count label="파일 안 같은 행 (아래 줄 기준)" n={s.superseded} />
            )}
            <Count
              label="오류"
              n={s.errors}
              tone={s.errors ? "danger" : undefined}
            />
          </div>
          {s.errors > 0 && (
            <div className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-strong">
              <p className="font-medium">
                오류가 있어 저장할 수 없습니다. 파일을 고친 뒤 다시 올려 주세요.
              </p>
              <ul className="mt-1 list-disc pl-5 text-xs">
                {preview.errors.map((e, i) => (
                  <li key={i}>
                    {e.row}행: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {s.errors === 0 && s.created + s.changed === 0 && (
            <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              저장할 내용이 없습니다 — 모든 행이 이미 저장된 값과 같습니다.
            </p>
          )}
          <Lines title="덮어쓸 행" lines={preview.changed} total={s.changed} />
          <Lines
            title="새로 저장할 행"
            lines={preview.created}
            total={s.created}
          />
          <Lines
            title="숨긴 행과 같음 — 저장하지 않음 (복구한 뒤 다시 올리세요)"
            lines={preview.hidden}
            total={s.hidden}
          />
        </div>
      )}
    </section>
  );
}

function Count({
  label,
  n,
  tone,
}: {
  label: string;
  n: number;
  tone?: "primary" | "copper" | "danger";
}) {
  return (
    <span
      className={cn(
        pillClass,
        tone === "primary" && "bg-primary-50 text-primary",
        tone === "copper" && "bg-copper-50 text-copper-700",
        tone === "danger" && "bg-danger-soft text-danger-strong",
        !tone && "bg-muted text-muted-foreground",
      )}
    >
      {label} {n.toLocaleString("ko-KR")}
    </span>
  );
}

function Lines({
  title,
  lines,
  total,
}: {
  title: string;
  lines: PreviewLine[];
  total: number;
}) {
  if (!lines.length) return null;
  return (
    <details open={lines.length <= 20} className="text-sm">
      <summary className="cursor-pointer font-medium">
        {title} {total.toLocaleString("ko-KR")}행
        {total > lines.length && ` (앞 ${lines.length}행만 표시)`}
      </summary>
      <div className="mt-2 max-h-96 overflow-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted text-left text-muted-foreground">
            <tr>
              <th className="px-2 py-1.5 font-medium">행</th>
              <th className="px-2 py-1.5 font-medium">파트넘버</th>
              <th className="px-2 py-1.5 font-medium">내용</th>
              <th className="px-2 py-1.5 text-right font-medium">금액</th>
              <th className="px-2 py-1.5 font-medium">바뀌는 칸</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.row} className="border-t">
                <td className="px-2 py-1.5 tabular-nums">{l.row}</td>
                <td className="px-2 py-1.5 font-medium whitespace-nowrap">
                  {l.partNo}
                </td>
                <td className="px-2 py-1.5">{l.detail}</td>
                <td className="px-2 py-1.5 text-right whitespace-nowrap tabular-nums">
                  {wonText(l.price)}
                </td>
                <td className="px-2 py-1.5">
                  {l.diffs?.map((d) => (
                    <div key={d.label} className="whitespace-nowrap">
                      {d.label}: {d.before} → <b>{d.after}</b>
                    </div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
