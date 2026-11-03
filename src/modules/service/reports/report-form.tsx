"use client";
// 출장보고서 입력·수정 — 친구 저장소 ServiceReportFormView.vue 그대로. 구역 순서는 출장보고서 PDF 와 같다
// PDF 에 없는 값(주소, 부품 수량)은 비워 둘 수 있고, 지역은 주소에서 판정(regions.ts — 저장할 때와 같은 규칙)
// ?from=pdf: PDF 를 올리면 서버가 읽은 값을 폼에 채우고(저장 안 함), 사람이 확인 후 저장하면 새 보고서 + 원본 PDF 첨부
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";

import { cn } from "@/shared/lib/utils";
import {
  buttonPrimaryClass,
  buttonSecondaryClass,
  cardTitleClass,
} from "@/shared/ui/styles";

import type { PdfPreview } from "./actions";
import {
  createReport,
  createReportFromPdf,
  previewReportPdf,
  updateReport,
} from "./actions";
import { emptyForm, emptyProduct, type FormValues } from "./form-values";
import type { Names } from "./load-reports";
import { parseAddress, regionChoices, regionLabel } from "../regions/regions";

const WARN_LABELS: Record<string, string> = {
  title: "출장 목적",
  tripStart: "출장 시작일",
  tripEnd: "출장 종료일",
  happyCallDate: "해피콜 예정일",
  writtenAt: "작성일",
  billing: "비용청구 유무",
  products: "제품 목록",
  parts: "부품 사용 내역",
  region: "지역",
  faultDescription: "고장 내용",
  workDescription: "작업 내용",
  workResult: "작업 결과",
};
const CHECK = "border-warning-strong! bg-warning-soft!";
const field =
  "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm aria-invalid:border-destructive";
const small =
  "h-8 w-full rounded-md border border-input bg-background px-2 text-sm";
const REGIONS = regionChoices();

function Label({
  htmlFor,
  children,
}: {
  htmlFor?: string;
  children: React.ReactNode;
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="mb-1 block text-[0.85rem] font-semibold"
    >
      {children}
    </label>
  );
}
function Help({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mt-1 text-xs text-muted-foreground", className)}>
      {children}
    </div>
  );
}
function Err({ message }: { message?: string }) {
  return message ? (
    <div className="mt-1 text-xs text-destructive">{message}</div>
  ) : null;
}
function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-card border bg-card p-6">
      <h2 className={cn(cardTitleClass, "mb-3.5 text-primary")}>{title}</h2>
      {children}
    </section>
  );
}

type Brief = { id: string; title: string; tripStart: string };

export function ReportForm({
  mode,
  id,
  updatedAt,
  initial,
  names,
}: {
  mode: "new" | "pdf" | "edit";
  id?: string;
  updatedAt?: string;
  initial?: FormValues;
  names: Names;
}) {
  const router = useRouter();
  const [form, setForm] = useState<FormValues>(initial ?? emptyForm());
  const [companion, setCompanion] = useState("");
  const [autoFilled, setAutoFilled] = useState(false);
  const [error, setError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();
  // PDF로 등록
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfError, setPdfError] = useState("");
  const [pdf, setPdf] = useState<Extract<PdfPreview, { ok: true }> | null>(
    null,
  );
  const [sameFile, setSameFile] = useState<Brief | null>(null);
  const [similar, setSimilar] = useState<Brief[]>([]);
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const [dragging, setDragging] = useState(false);
  const pdfInput = useRef<HTMLInputElement>(null);

  const set = <K extends keyof FormValues>(k: K, value: FormValues[K]) =>
    setForm((f) => ({ ...f, [k]: value }));
  const warnFor = (f: string) =>
    (pdf?.warnings ?? []).filter((w) => w.field === f).map((w) => w.message);
  const check = (f: string) => (warnFor(f).length ? CHECK : "");
  const truncatedAt = (i: number) =>
    pdf?.truncatedParts.find(
      (t) => t.index === i && form.parts[i]?.name === t.name,
    );
  const sigungus = REGIONS.find((r) => r.name === form.region)?.sigungu ?? [];
  const regionPreview = useMemo(
    () => (form.address.trim() ? parseAddress(form.address) : null),
    [form.address],
  );

  // 주소 → 시·도·시·군·구 자동 채움 (사람이 선택 상자에서 고칠 수 있다)
  const changeAddress = (address: string) => {
    const r = address.trim() ? parseAddress(address) : null;
    setForm((f) =>
      r?.region
        ? { ...f, address, region: r.region, sigungu: r.sigungu ?? "" }
        : { ...f, address },
    );
    setAutoFilled(!!r?.region);
  };
  const chooseRegion = (region: string) => {
    setAutoFilled(false);
    setForm((f) => ({
      ...f,
      region,
      sigungu:
        region === "세종특별자치시"
          ? "세종시"
          : (REGIONS.find((r) => r.name === region)?.sigungu ?? []).includes(
                f.sigungu,
              )
            ? f.sigungu
            : "",
    }));
  };
  const addCompanion = () => {
    const name = companion.trim();
    if (name && !form.companions.includes(name))
      set("companions", [...form.companions, name]);
    setCompanion("");
  };

  const analyzePdf = (file: File | undefined) => {
    if (!file) return;
    setPdfFile(file);
    setPdfError("");
    setPdf(null);
    setSameFile(null);
    setSimilar([]);
    setConfirmDuplicate(false);
    const body = new FormData();
    body.set("file", file);
    startTransition(async () => {
      const r = await previewReportPdf(body);
      if (!r.ok) {
        setPdfFile(null);
        setPdfError(r.message);
        return;
      }
      const d = r.data;
      setForm({
        ...emptyForm(),
        ...Object.fromEntries(
          Object.entries(d).filter(([, v]) => typeof v === "string"),
        ),
        billing: d.billing ?? "",
        companions: d.companions,
        products: d.products.length
          ? d.products.map((p) => ({
              ...p,
              quantity: p.quantity === null ? "" : String(p.quantity),
            }))
          : [emptyProduct()],
        parts: d.parts.map((p) => ({ name: p.name, quantity: "" })),
        region: "",
        sigungu: "",
      });
      setPdf(r);
      setSameFile(r.sameFile);
      setSimilar(r.similar);
    });
  };

  const blocked = mode === "pdf" && (!pdf || !!sameFile);
  const payload = () => ({
    ...form,
    sigungu: form.region ? form.sigungu : "",
    products: form.products.filter(
      (p) => p.modelName.trim() || p.serialNo.trim() || p.spec.trim(),
    ),
    parts: form.parts
      .filter((p) => p.name.trim())
      .map((p) => ({ ...p, name: p.name.trim() })),
  });

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (blocked) return;
    setError("");
    setErrors({});
    startTransition(async () => {
      let r;
      if (mode === "pdf") {
        const body = new FormData();
        body.set("file", pdfFile!);
        body.set("data", JSON.stringify(payload()));
        if (confirmDuplicate) body.set("confirmDuplicate", "1");
        r = await createReportFromPdf(body);
        if (r.sameFile) setSameFile(r.sameFile);
        if (r.similar) setSimilar(r.similar);
      } else if (mode === "edit") {
        r = await updateReport(id!, updatedAt!, payload());
      } else {
        r = await createReport(payload());
      }
      if (r.ok && r.id) {
        router.push(`/service/reports/${r.id}`);
        return;
      }
      setError(r.message);
      setErrors(r.errors ?? {});
    });
  };

  const showForm = mode !== "pdf" || !!pdf;

  return (
    <div className="space-y-4">
      {mode === "pdf" && (
        <section className="rounded-card border bg-card p-6">
          <h2 className={cn(cardTitleClass, "mb-2 text-primary")}>
            PDF로 등록
          </h2>
          <div
            role="button"
            tabIndex={0}
            onClick={() => pdfInput.current?.click()}
            onKeyDown={(e) => e.key === "Enter" && pdfInput.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              analyzePdf(e.dataTransfer.files[0]);
            }}
            className={cn(
              "cursor-pointer rounded-xl border-2 border-dashed bg-muted/40 p-4 text-center text-sm text-muted-foreground hover:border-primary hover:bg-primary-50",
              dragging && "border-primary bg-primary-50",
            )}
          >
            <input
              ref={pdfInput}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              data-test="pdf-input"
              onChange={(e) => {
                analyzePdf(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {pending && !pdf ? (
              "PDF를 읽는 중…"
            ) : pdfFile ? (
              <>
                <strong>{pdfFile.name}</strong> · 다른 파일로 바꾸려면
                클릭하거나 끌어 놓으세요
              </>
            ) : (
              <>
                사내 시스템에서 저장한 <strong>출장보고서 PDF</strong>를 클릭해
                고르거나 끌어 놓으세요 (최대 20MB)
              </>
            )}
          </div>
          {pdfError && (
            <p
              role="alert"
              className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-strong"
            >
              {pdfError}
            </p>
          )}
          {pdf &&
            (sameFile ? (
              <p
                role="alert"
                data-test="same-file"
                className="mt-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-strong"
              >
                이미 등록된 PDF입니다:{" "}
                <Link
                  href={`/service/reports/${sameFile.id}`}
                  className="underline"
                >
                  {sameFile.title}
                </Link>{" "}
                · 같은 파일은 다시 등록할 수 없습니다.
              </p>
            ) : (
              <>
                <p className="mt-2 rounded-lg bg-success-soft px-3 py-2 text-sm text-success-strong">
                  PDF에서 읽은 값을 아래 폼에 채웠습니다.{" "}
                  <strong>내용을 확인·수정한 뒤 저장</strong>하세요. 읽지 못한
                  칸은 비어 있습니다. 저장하면 새 출장보고서가 만들어지고 원본
                  PDF가 첨부됩니다(기존 보고서는 바뀌지 않음).
                </p>
                {pdf.warnings.length > 0 && (
                  <div
                    data-test="pdf-warnings"
                    className="mt-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-strong"
                  >
                    <strong>확인 필요 {pdf.warnings.length}건</strong> (노란 칸)
                    <ul className="list-disc pl-4">
                      {pdf.warnings.map((w, i) => (
                        <li key={i}>
                          {WARN_LABELS[w.field] ?? w.field}: {w.message}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {similar.length > 0 && (
                  <div
                    data-test="similar"
                    className="mt-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning-strong"
                  >
                    출장 시작일·요청처·작성자·일련번호가 같은 보고서가 이미
                    있습니다:
                    {similar.map((s) => (
                      <Link
                        key={s.id}
                        href={`/service/reports/${s.id}`}
                        className="ml-1 underline"
                      >
                        {s.title} ({s.tripStart})
                      </Link>
                    ))}
                    <label className="mt-1 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={confirmDuplicate}
                        onChange={(e) => setConfirmDuplicate(e.target.checked)}
                      />
                      중복이 아님을 확인했습니다(다른 출장입니다)
                    </label>
                  </div>
                )}
              </>
            ))}
        </section>
      )}

      {showForm && (
        <form noValidate onSubmit={save} className="space-y-4">
          <datalist id="dl-people">
            {names.people.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
          <datalist id="dl-models">
            {names.models.map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
          <datalist id="dl-orgs">
            {names.requestOrgs.map((o) => (
              <option key={o} value={o} />
            ))}
          </datalist>
          <datalist id="dl-work">
            {names.workTypes.map((w) => (
              <option key={w} value={w} />
            ))}
          </datalist>
          <datalist id="dl-parts">
            {names.parts.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>

          {error && (
            <p
              role="alert"
              className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger-strong"
            >
              {error}
            </p>
          )}

          <Card title="출장정보">
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12">
                <Label htmlFor="r-title">
                  출장 목적 <span className="text-destructive">*</span>
                </Label>
                <input
                  id="r-title"
                  value={form.title}
                  onChange={(e) => set("title", e.target.value)}
                  aria-invalid={!!errors.title}
                  className={cn(field, check("title"))}
                  placeholder="예: 오창과학산업단지 비저오염 저감시설 4토구 유입수문 A/S"
                />
                <Err message={errors.title} />
              </div>
              <div className="col-span-12 md:col-span-4">
                <Label htmlFor="r-org">요청처</Label>
                <input
                  id="r-org"
                  list="dl-orgs"
                  value={form.requestOrg}
                  onChange={(e) => set("requestOrg", e.target.value)}
                  className={field}
                />
              </div>
              <div className="col-span-12 md:col-span-4">
                <Label htmlFor="r-orgtype">요청처 구분</Label>
                <input
                  id="r-orgtype"
                  value={form.requestOrgType}
                  onChange={(e) => set("requestOrgType", e.target.value)}
                  className={field}
                  placeholder="예: 검색 불가"
                />
              </div>
              <div className="col-span-12 md:col-span-4">
                <Label htmlFor="r-contact">현장담당자 / 연락처</Label>
                <input
                  id="r-contact"
                  value={form.siteContact}
                  onChange={(e) => set("siteContact", e.target.value)}
                  className={field}
                />
              </div>
              <div className="col-span-12 md:col-span-8">
                <Label htmlFor="r-address">
                  출장지 주소{" "}
                  <span className="text-xs font-normal text-muted-foreground">
                    (출장보고서 PDF에 없는 항목 · 지역 집계에 사용)
                  </span>
                </Label>
                <input
                  id="r-address"
                  value={form.address}
                  onChange={(e) => changeAddress(e.target.value)}
                  className={field}
                  placeholder="예: 충북 청주시 청원구 오창읍 …"
                />
                <Help>
                  {!form.address.trim() ? (
                    "주소를 시·도부터 입력하면 아래 지역이 자동으로 채워집니다(예: 경남 창원시 의창구 …)."
                  ) : regionPreview?.region && regionPreview.sigungu ? (
                    <>
                      주소에서 판정:{" "}
                      <strong>
                        {regionLabel(
                          regionPreview.region,
                          regionPreview.sigungu,
                        )}
                      </strong>
                    </>
                  ) : regionPreview?.region ? (
                    <span className="text-warning-strong">
                      ⚠ 시·도({regionPreview.region})만 판정되었습니다.
                      시·군·구를 선택하세요.
                    </span>
                  ) : (
                    <span className="text-warning-strong">
                      ⚠ 주소에서 지역을 알 수 없습니다. 아래에서 직접 선택하거나
                      비워 두세요(미지정).
                    </span>
                  )}
                </Help>
              </div>
              <div className="col-span-6 md:col-span-4">
                <Label htmlFor="r-region">지역: 시·도</Label>
                <select
                  id="r-region"
                  value={form.region}
                  onChange={(e) => chooseRegion(e.target.value)}
                  aria-invalid={!!errors.region}
                  className={cn(
                    field,
                    warnFor("region").length && !form.region && CHECK,
                  )}
                >
                  <option value="">미지정</option>
                  {REGIONS.map((r) => (
                    <option key={r.name} value={r.name}>
                      {r.name}
                    </option>
                  ))}
                </select>
                <Err message={errors.region} />
              </div>
              <div className="col-span-6 md:col-span-4">
                <Label htmlFor="r-sigungu">시·군·구</Label>
                <select
                  id="r-sigungu"
                  value={form.sigungu}
                  onChange={(e) => {
                    setAutoFilled(false);
                    set("sigungu", e.target.value);
                  }}
                  disabled={!form.region || form.region === "세종특별자치시"}
                  aria-invalid={!!errors.sigungu}
                  className={cn(field, "disabled:bg-muted")}
                >
                  <option value="">
                    {form.region ? "미확인" : "시·도를 먼저 선택"}
                  </option>
                  {sigungus.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
                <Err message={errors.sigungu} />
              </div>
              <div className="col-span-12 self-end pb-2 text-xs text-muted-foreground md:col-span-4">
                {autoFilled
                  ? "주소에서 자동으로 채웠습니다. 다르면 직접 고르세요."
                  : "지역 집계·지도에 쓰입니다. 2026-10-01 공식 행정구역 기준."}
              </div>
              <div className="col-span-12 md:col-span-4">
                <Label htmlFor="r-status">작성 상태</Label>
                <input
                  id="r-status"
                  value={form.status}
                  onChange={(e) => set("status", e.target.value)}
                  className={field}
                  placeholder="예: 작성"
                />
              </div>
              <div className="col-span-6 md:col-span-3">
                <Label htmlFor="r-start">출장 시작일</Label>
                <input
                  id="r-start"
                  type="date"
                  value={form.tripStart}
                  onChange={(e) => set("tripStart", e.target.value)}
                  className={cn(field, check("tripStart"))}
                />
                <Help>출장 건수 집계 기준일</Help>
              </div>
              <div className="col-span-6 md:col-span-3">
                <Label htmlFor="r-end">출장 종료일</Label>
                <input
                  id="r-end"
                  type="date"
                  value={form.tripEnd}
                  onChange={(e) => set("tripEnd", e.target.value)}
                  aria-invalid={!!errors.tripEnd}
                  className={cn(field, check("tripEnd"))}
                />
                <Err message={errors.tripEnd} />
              </div>
              <div className="col-span-6 md:col-span-3">
                <Label htmlFor="r-extra">추가 출장</Label>
                <input
                  id="r-extra"
                  value={form.extraTrip}
                  onChange={(e) => set("extraTrip", e.target.value)}
                  className={field}
                  placeholder="예: 없음"
                />
              </div>
              <div className="col-span-6 md:col-span-3">
                <Label htmlFor="r-happy">해피콜 예정일</Label>
                <input
                  id="r-happy"
                  type="date"
                  value={form.happyCallDate}
                  onChange={(e) => set("happyCallDate", e.target.value)}
                  className={field}
                />
              </div>
              <div className="col-span-12 md:col-span-4">
                <Label htmlFor="r-author">작성자</Label>
                <input
                  id="r-author"
                  list="dl-people"
                  value={form.authorName}
                  onChange={(e) => set("authorName", e.target.value)}
                  className={field}
                  placeholder="예: 김현진 대리"
                />
              </div>
              <div className="col-span-12 md:col-span-4">
                <Label htmlFor="r-written">작성일</Label>
                <input
                  id="r-written"
                  type="datetime-local"
                  value={form.writtenAt}
                  onChange={(e) => set("writtenAt", e.target.value)}
                  className={cn(field, check("writtenAt"))}
                />
              </div>
              <div className="col-span-12 md:col-span-4">
                <Label htmlFor="r-companion">동행자</Label>
                <div className="flex">
                  <input
                    id="r-companion"
                    list="dl-people"
                    value={companion}
                    onChange={(e) => setCompanion(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCompanion();
                      }
                    }}
                    className={cn(field, "rounded-r-none")}
                  />
                  <button
                    type="button"
                    onClick={addCompanion}
                    className={cn(buttonSecondaryClass, "rounded-l-none")}
                  >
                    추가
                  </button>
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {form.companions.map((c, i) => (
                    <span
                      key={c}
                      className="inline-flex items-center gap-1 rounded-full border bg-card px-2 py-0.5 text-xs font-medium"
                    >
                      {c}
                      <button
                        type="button"
                        aria-label={`${c} 삭제`}
                        onClick={() =>
                          set(
                            "companions",
                            form.companions.filter((_, j) => j !== i),
                          )
                        }
                        className="text-muted-foreground hover:text-foreground"
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card title="작업 개요 · 제품 목록">
            <div className="mb-4 grid grid-cols-12">
              <div className="col-span-12 md:col-span-4">
                <Label htmlFor="r-worktype">작업 구분</Label>
                <input
                  id="r-worktype"
                  list="dl-work"
                  value={form.workType}
                  onChange={(e) => set("workType", e.target.value)}
                  className={field}
                  placeholder="예: 수리"
                />
              </div>
            </div>
            <div
              className={cn(
                "overflow-x-auto",
                warnFor("products").length &&
                  "rounded-md outline-2 outline-offset-2 outline-warning",
              )}
            >
              <table className="mb-2 w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted text-left text-xs text-muted-foreground">
                    <th className="px-2 py-1.5 font-medium">모델명</th>
                    <th className="px-2 py-1.5 font-medium">사양</th>
                    <th className="px-2 py-1.5 font-medium">일련번호</th>
                    <th className="w-28 px-2 py-1.5 font-medium">수량(대)</th>
                    <th className="w-11" />
                  </tr>
                </thead>
                <tbody>
                  {form.products.map((p, i) => {
                    const upd = (k: keyof typeof p, value: string) =>
                      set(
                        "products",
                        form.products.map((x, j) =>
                          j === i ? { ...x, [k]: value } : x,
                        ),
                      );
                    return (
                      <tr key={i} className="border-b last:border-0">
                        <td className="px-2 py-1">
                          <input
                            aria-label="모델명"
                            list="dl-models"
                            value={p.modelName}
                            onChange={(e) => upd("modelName", e.target.value)}
                            className={small}
                            placeholder="예: AVA03"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            aria-label="사양"
                            value={p.spec}
                            onChange={(e) => upd("spec", e.target.value)}
                            className={small}
                            placeholder="예: 380V/3Ph/60Hz, 29rpm"
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            aria-label="일련번호"
                            value={p.serialNo}
                            onChange={(e) => upd("serialNo", e.target.value)}
                            className={small}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <input
                            aria-label="수량"
                            type="number"
                            min={0}
                            value={p.quantity}
                            onChange={(e) => upd("quantity", e.target.value)}
                            className={small}
                          />
                        </td>
                        <td className="px-2 py-1">
                          <button
                            type="button"
                            aria-label="제품 행 삭제"
                            onClick={() =>
                              set(
                                "products",
                                form.products.filter((_, j) => j !== i),
                              )
                            }
                            className="h-8 w-8 rounded-md hover:bg-muted"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <button
              type="button"
              onClick={() =>
                set("products", [...form.products, emptyProduct()])
              }
              className={buttonSecondaryClass}
            >
              + 제품 추가
            </button>
          </Card>

          <Card title="수리 내역">
            <div className="grid gap-4 lg:grid-cols-3">
              {(
                [
                  ["faultDescription", "고장 내용"],
                  ["workDescription", "작업 내용"],
                  ["workResult", "작업 결과"],
                ] as const
              ).map(([k, label]) => (
                <div key={k}>
                  <Label htmlFor={`r-${k}`}>{label}</Label>
                  <textarea
                    id={`r-${k}`}
                    rows={6}
                    value={form[k]}
                    onChange={(e) => set(k, e.target.value)}
                    className={cn(field, "h-auto py-2", check(k))}
                  />
                </div>
              ))}
            </div>
            <Help className="mt-2">
              {mode === "pdf"
                ? "원본 PDF(사진·서명 포함)는 저장할 때 함께 첨부되어 상세 화면에서 열어 볼 수 있습니다."
                : "사진(명판, 작업 전·후, 부품 교체 전·후)과 원본 PDF는 저장한 뒤 상세 화면에서 첨부합니다."}
            </Help>
          </Card>

          <Card title="비고">
            <div className="grid grid-cols-12 gap-4">
              <div className="col-span-12 md:col-span-4">
                <span className="mb-1 block text-[0.85rem] font-semibold">
                  비용청구 유무
                </span>
                <div
                  role="radiogroup"
                  aria-label="비용청구 유무"
                  className={cn(
                    "inline-flex overflow-hidden rounded-lg border",
                    warnFor("billing").length &&
                      "outline-2 outline-offset-2 outline-warning",
                  )}
                >
                  {[
                    ["PAID", "유상"],
                    ["FREE", "무상"],
                    ["", "미입력"],
                  ].map(([value, label]) => (
                    <label
                      key={value || "none"}
                      className={cn(
                        "cursor-pointer border-r px-3 py-1.5 text-sm last:border-r-0",
                        form.billing === value
                          ? "bg-primary text-primary-foreground"
                          : "bg-card hover:bg-primary-50",
                      )}
                    >
                      <input
                        type="radio"
                        name="billing"
                        value={value}
                        checked={form.billing === value}
                        onChange={() => set("billing", value)}
                        className="sr-only"
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
              <div className="col-span-12 md:col-span-4">
                <Label htmlFor="r-approver">승인자</Label>
                <input
                  id="r-approver"
                  list="dl-people"
                  value={form.approver}
                  onChange={(e) => set("approver", e.target.value)}
                  className={field}
                />
              </div>
              <div className="col-span-12 md:col-span-4">
                <Label htmlFor="r-cc">참조자</Label>
                <input
                  id="r-cc"
                  value={form.cc}
                  onChange={(e) => set("cc", e.target.value)}
                  className={field}
                />
              </div>
              <div className="col-span-12 md:col-span-4">
                <Label htmlFor="r-quotetype">견적서 구분</Label>
                <input
                  id="r-quotetype"
                  value={form.quoteType}
                  onChange={(e) => set("quoteType", e.target.value)}
                  className={field}
                  placeholder="예: 검색 가능"
                />
              </div>
              <div className="col-span-12 md:col-span-8">
                <Label htmlFor="r-quote">견적서</Label>
                <input
                  id="r-quote"
                  value={form.quote}
                  onChange={(e) => set("quote", e.target.value)}
                  className={field}
                />
              </div>
              <div className="col-span-12">
                <span className="mb-1 block text-[0.85rem] font-semibold">
                  부품 사용 내역
                </span>
                {form.parts.map((p, i) => {
                  const t = truncatedAt(i);
                  const upd = (k: "name" | "quantity", value: string) =>
                    set(
                      "parts",
                      form.parts.map((x, j) =>
                        j === i ? { ...x, [k]: value } : x,
                      ),
                    );
                  return (
                    <div key={i} className="mb-2">
                      <div className="flex gap-2">
                        <input
                          aria-label="부품명"
                          list="dl-parts"
                          value={p.name}
                          onChange={(e) => upd("name", e.target.value)}
                          className={cn(small, t && CHECK)}
                          placeholder="부품명(목록에서 고르거나 새로 입력)"
                        />
                        <input
                          aria-label="부품 수량"
                          type="number"
                          min={1}
                          value={p.quantity}
                          onChange={(e) => upd("quantity", e.target.value)}
                          className={cn(small, "w-32 flex-none")}
                          placeholder="수량(선택)"
                        />
                        <button
                          type="button"
                          aria-label="부품 행 삭제"
                          onClick={() =>
                            set(
                              "parts",
                              form.parts.filter((_, j) => j !== i),
                            )
                          }
                          className="h-8 w-8 flex-none rounded-md hover:bg-muted"
                        >
                          ✕
                        </button>
                      </div>
                      {t && (
                        <div
                          data-test="truncated-part"
                          className="mt-1 text-xs text-warning-strong"
                        >
                          PDF에서 이름이 잘려 있습니다(&quot;…&quot;).{" "}
                          {t.suggestions.length ? (
                            <>
                              부품 목록에서 고르기:
                              {t.suggestions.map((s) => (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => upd("name", s)}
                                  className="ml-1 text-primary underline"
                                >
                                  {s}
                                </button>
                              ))}
                            </>
                          ) : (
                            "부품 목록에 앞부분이 같은 부품이 없습니다. 맞는 이름으로 고치거나 그대로 저장하세요."
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() =>
                    set("parts", [...form.parts, { name: "", quantity: "" }])
                  }
                  className={buttonSecondaryClass}
                >
                  + 부품 추가
                </button>
                <Help>
                  처음 쓰는 부품명은 부품·단가 목록에 새로 등록됩니다. 수량은
                  출장보고서 PDF에 없는 항목이라 확인된 경우에만 입력하세요.
                </Help>
              </div>
              <div className="col-span-12">
                <Label htmlFor="r-note">메모</Label>
                <textarea
                  id="r-note"
                  rows={2}
                  value={form.note}
                  onChange={(e) => set("note", e.target.value)}
                  className={cn(field, "h-auto py-2")}
                />
              </div>
            </div>
          </Card>

          <div className="flex justify-end gap-2 pb-4">
            <Link
              href={
                mode === "edit" ? `/service/reports/${id}` : "/service/reports"
              }
              className={buttonSecondaryClass}
            >
              취소
            </Link>
            <button
              type="submit"
              disabled={
                pending ||
                blocked ||
                (mode === "pdf" && similar.length > 0 && !confirmDuplicate)
              }
              className={cn(buttonPrimaryClass, "px-6")}
            >
              {pending ? "저장 중…" : "저장"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
