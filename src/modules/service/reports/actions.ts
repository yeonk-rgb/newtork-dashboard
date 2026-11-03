"use server";
// 출장보고서 입력·수정·숨김·복구, 첨부 올리기·숨김, PDF로 등록 — 친구 저장소 ServiceReportViewSet 규칙 그대로
// 권한: 입력·수정·첨부 = 서비스 edit(팀장 이상), 숨김·복구 = confirm. 저장과 변경 이력은 한 트랜잭션, updatedAt 으로 동시 수정 확인
import { createHash } from "node:crypto";

import { refresh } from "next/cache";

import {
  date,
  diffFields,
  labelOf,
  type AuditField,
} from "@/shared/audit/diff";
import { recordAudit } from "@/shared/audit/record";
import { getCurrentUser, type AppUser } from "@/shared/auth";
import { prisma } from "@/shared/db/client";
import type { Prisma, SvcAttachmentKind } from "@/shared/db/generated/client";
import { getNow } from "@/shared/time/now";

import { ATTACHMENT_KIND_LABEL, BILLING_LABEL } from "../labels";
import { parseReportLines, PdfImportError, type Extracted } from "../pdf/parse";
import { readLines } from "../pdf/read-lines";
import { regionLabel } from "../regions/regions";
import { NO_EDIT_MESSAGE, serviceAbilities } from "../rules";
import { fieldErrors, reportInputSchema, type ReportValues } from "./schemas";

export type ActionResult = {
  ok: boolean;
  message: string;
  errors?: Record<string, string>;
  id?: string;
};

class ConflictError extends Error {}
const CONFLICT = "다른 사람이 먼저 수정했습니다. 새로고침 후 다시 시도하세요.";
const MAX_BYTES = 20 * 1024 * 1024;
// 확장자와 파일 앞부분(매직 넘버)을 함께 확인 (친구 앱 FILE_SIGNATURES)
const SIGNATURES: Record<string, { magic: number[]; type: string }> = {
  ".pdf": { magic: [0x25, 0x50, 0x44, 0x46], type: "application/pdf" },
  ".png": { magic: [0x89, 0x50, 0x4e, 0x47], type: "image/png" },
  ".jpg": { magic: [0xff, 0xd8, 0xff], type: "image/jpeg" },
  ".jpeg": { magic: [0xff, 0xd8, 0xff], type: "image/jpeg" },
};

const actor = (u: AppUser) => ({ id: u.id, loginId: u.loginId });
const day = (v: string) => (v ? new Date(`${v}T00:00:00Z`) : null);
/** 한국 시간 "YYYY-MM-DDTHH:mm" → UTC 시각 */
const kstTime = (v: string) => (v ? new Date(`${v}:00+09:00`) : null);

async function editor() {
  const user = await getCurrentUser();
  return user && serviceAbilities(user).canEdit ? user : null;
}

type AuditRow = Record<string, unknown>;
const REPORT_FIELDS: AuditField<AuditRow>[] = [
  { key: "title", label: "출장 목적" },
  { key: "status", label: "작성 상태" },
  { key: "requestOrgType", label: "요청처 구분" },
  { key: "requestOrg", label: "요청처" },
  { key: "siteContact", label: "현장담당자/연락처" },
  { key: "address", label: "출장지 주소" },
  { key: "regionLabel", label: "지역" },
  { key: "tripStart", label: "출장 시작일", format: date },
  { key: "tripEnd", label: "출장 종료일", format: date },
  { key: "extraTrip", label: "추가 출장" },
  { key: "authorName", label: "작성자" },
  { key: "writtenAt", label: "작성일" },
  { key: "happyCallDate", label: "해피콜 예정일", format: date },
  { key: "companions", label: "동행자" },
  { key: "workType", label: "작업 구분" },
  { key: "products", label: "제품 목록" },
  { key: "faultDescription", label: "고장 내용" },
  { key: "workDescription", label: "작업 내용" },
  { key: "workResult", label: "작업 결과" },
  { key: "billing", label: "비용청구 유무", format: labelOf(BILLING_LABEL) },
  { key: "quoteType", label: "견적서 구분" },
  { key: "quote", label: "견적서" },
  { key: "approver", label: "승인자" },
  { key: "cc", label: "참조자" },
  { key: "parts", label: "부품 사용 내역" },
  { key: "note", label: "메모" },
];

/** 화면 표기 글자로 — 목록은 한 줄씩 */
function auditRow(v: {
  region: string | null;
  sigungu: string | null;
  companions: string[];
  products: {
    modelName: string;
    spec: string;
    serialNo: string;
    quantity: number | null;
  }[];
  parts: { name: string; quantity: number | null }[];
  writtenAt: string;
  [k: string]: unknown;
}): AuditRow {
  return {
    ...v,
    regionLabel: regionLabel(v.region, v.sigungu),
    companions: v.companions.join(", "),
    products: v.products
      .map(
        (p) =>
          `${p.modelName} / ${p.spec || "-"} / ${p.serialNo || "-"} / ${p.quantity ?? "미입력"}대`,
      )
      .join("\n"),
    parts: v.parts
      .map((p) => `${p.name} (수량 ${p.quantity ?? "미입력"})`)
      .join("\n"),
  };
}

const kstLocal = (d: Date | null) =>
  d ? new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 16) : "";
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

/** 저장된 보고서 → 비교용 값. 트랜잭션 밖에서 읽는다 (관계 3개를 한 연결에서 동시에 읽으면 pg 경고 —
 * 읽은 값이 수정 대상과 같은 판인지는 updatedAt 으로 확인) */
async function currentValues(id: string) {
  const r = await prisma.svcReport.findUnique({
    where: { id },
    include: {
      companions: { orderBy: { id: "asc" } },
      products: { orderBy: { id: "asc" } },
      parts: { include: { part: true }, orderBy: { position: "asc" } },
    },
  });
  if (!r) return null;
  return {
    report: r,
    values: auditRow({
      ...r,
      tripStart: iso(r.tripStart),
      tripEnd: iso(r.tripEnd),
      happyCallDate: iso(r.happyCallDate),
      writtenAt: kstLocal(r.writtenAt).replace("T", " "),
      companions: r.companions.map((c) => c.name),
      products: r.products,
      parts: r.parts.map((p) => ({ name: p.part.name, quantity: p.quantity })),
    }),
  };
}

function reportData(v: ReportValues) {
  return {
    title: v.title,
    status: v.status,
    requestOrgType: v.requestOrgType,
    requestOrg: v.requestOrg,
    siteContact: v.siteContact,
    address: v.address,
    region: v.region,
    sigungu: v.sigungu,
    tripStart: day(v.tripStart),
    tripEnd: day(v.tripEnd),
    extraTrip: v.extraTrip,
    authorName: v.authorName,
    writtenAt: kstTime(v.writtenAt),
    happyCallDate: day(v.happyCallDate),
    workType: v.workType,
    faultDescription: v.faultDescription,
    workDescription: v.workDescription,
    workResult: v.workResult,
    billing: v.billing || null,
    quoteType: v.quoteType,
    quote: v.quote,
    approver: v.approver,
    cc: v.cc,
    note: v.note,
  };
}

/** 동행자·제품·부품을 통째로 바꾼다. 처음 쓰는 부품명은 부품 목록에 새로 만든다 (숨긴 부품이면 되살림) */
async function saveChildren(
  tx: Prisma.TransactionClient,
  reportId: string,
  v: ReportValues,
  user: AppUser,
) {
  await tx.svcReportCompanion.deleteMany({ where: { reportId } });
  await tx.svcReportProduct.deleteMany({ where: { reportId } });
  await tx.svcReportPart.deleteMany({ where: { reportId } });
  if (v.companions.length) {
    await tx.svcReportCompanion.createMany({
      data: v.companions.map((name) => ({ reportId, name })),
    });
  }
  if (v.products.length) {
    await tx.svcReportProduct.createMany({
      data: v.products.map((p) => ({ reportId, ...p })),
    });
  }
  for (const [position, p] of v.parts.entries()) {
    const part = await tx.svcPart.upsert({
      where: { name: p.name },
      create: { name: p.name, createdById: user.id, updatedById: user.id },
      update: { deletedAt: null, deletedById: null },
    });
    await tx.svcReportPart.create({
      data: { reportId, partId: part.id, position, quantity: p.quantity },
    });
  }
}

function parseInput(raw: unknown) {
  const parsed = reportInputSchema.safeParse(raw);
  if (parsed.success) return { values: parsed.data };
  const errors = fieldErrors(parsed.error);
  const nested = (["products", "parts"] as const).filter((k) => errors[k]);
  return {
    error: {
      ok: false,
      message: nested.length
        ? `${nested.map((k) => (k === "products" ? "제품 목록" : "부품 사용 내역")).join(", ")}을(를) 확인하세요: ${nested.map((k) => errors[k]).join(" ")}`
        : "입력값을 확인하세요.",
      errors,
    } satisfies ActionResult,
  };
}

async function createIn(
  tx: Prisma.TransactionClient,
  v: ReportValues,
  user: AppUser,
  now: Date,
  meta?: Record<string, unknown>,
) {
  const report = await tx.svcReport.create({
    data: { ...reportData(v), createdById: user.id, updatedById: user.id },
  });
  await saveChildren(tx, report.id, v, user);
  await recordAudit(tx, {
    occurredAt: now,
    actor: actor(user),
    area: "service",
    screen: "service-reports",
    action: "CREATE",
    target: { type: "SvcReport", id: report.id, label: v.title },
    changes: diffFields(
      null,
      auditRow({ ...v, writtenAt: v.writtenAt.replace("T", " ") }),
      REPORT_FIELDS,
    ),
    ...(meta ? { meta } : {}),
  });
  return report;
}

export async function createReport(raw: unknown): Promise<ActionResult> {
  const user = await editor();
  if (!user) return { ok: false, message: NO_EDIT_MESSAGE };
  const parsed = parseInput(raw);
  if (parsed.error) return parsed.error;
  const now = await getNow();
  const report = await prisma.$transaction((tx) =>
    createIn(tx, parsed.values, user, now),
  );
  refresh();
  return {
    ok: true,
    id: report.id,
    message: "출장보고서를 저장했습니다. 원본 PDF와 사진을 첨부하세요.",
  };
}

export async function updateReport(
  id: string,
  updatedAt: string,
  raw: unknown,
): Promise<ActionResult> {
  const user = await editor();
  if (!user) return { ok: false, message: NO_EDIT_MESSAGE };
  const parsed = parseInput(raw);
  if (parsed.error) return parsed.error;
  const v = parsed.values;
  const now = await getNow();
  const current = await currentValues(String(id));
  if (
    !current ||
    current.report.deletedAt ||
    current.report.updatedAt.toISOString() !== updatedAt
  ) {
    return { ok: false, message: CONFLICT };
  }
  try {
    await prisma.$transaction(async (tx) => {
      const updated = await tx.svcReport.updateMany({
        where: { id: current.report.id, updatedAt: new Date(updatedAt) },
        data: { ...reportData(v), updatedById: user.id },
      });
      if (updated.count === 0) throw new ConflictError();
      await saveChildren(tx, current.report.id, v, user);
      const changes = diffFields(
        current.values,
        auditRow({ ...v, writtenAt: v.writtenAt.replace("T", " ") }),
        REPORT_FIELDS,
      );
      if (changes.length) {
        await recordAudit(tx, {
          occurredAt: now,
          actor: actor(user),
          area: "service",
          screen: "service-reports",
          action: "UPDATE",
          target: { type: "SvcReport", id: current.report.id, label: v.title },
          changes,
        });
      }
    });
  } catch (error) {
    if (error instanceof ConflictError) return { ok: false, message: CONFLICT };
    throw error;
  }
  refresh();
  return { ok: true, id: String(id), message: "출장보고서를 수정했습니다." };
}

async function setHidden(id: string, hide: boolean): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !serviceAbilities(user).canHide) {
    return { ok: false, message: NO_EDIT_MESSAGE };
  }
  const now = await getNow();
  try {
    await prisma.$transaction(async (tx) => {
      const r = await tx.svcReport.findUnique({ where: { id } });
      if (!r || (r.deletedAt !== null) === hide) throw new ConflictError();
      await tx.svcReport.update({
        where: { id },
        data: hide
          ? { deletedAt: now, deletedById: user.id }
          : { deletedAt: null, deletedById: null },
      });
      await recordAudit(tx, {
        occurredAt: now,
        actor: actor(user),
        area: "service",
        screen: "service-reports",
        action: hide ? "HIDE" : "RESTORE",
        target: { type: "SvcReport", id, label: r.title },
      });
    });
  } catch (error) {
    if (error instanceof ConflictError) return { ok: false, message: CONFLICT };
    throw error;
  }
  refresh();
  return { ok: true, message: hide ? "숨겼습니다." : "복구했습니다." };
}

export async function hideReport(id: string) {
  return setHidden(String(id), true);
}
export async function restoreReport(id: string) {
  return setHidden(String(id), false);
}

// ---------- 첨부 ----------

type CheckedFile = {
  name: string;
  type: string;
  bytes: Uint8Array<ArrayBuffer>;
  sha256: string;
};

async function checkFile(
  file: unknown,
  allowed = Object.keys(SIGNATURES),
): Promise<CheckedFile | string> {
  if (!(file instanceof File) || file.size === 0) return "파일을 선택하세요.";
  const name = file.name.slice(0, 255);
  const ext = name.includes(".")
    ? `.${name.split(".").pop()!.toLowerCase()}`
    : "";
  if (!allowed.includes(ext)) {
    const names = [
      ...new Set(
        allowed.map((e) => e.slice(1).toUpperCase().replace("JPEG", "JPG")),
      ),
    ];
    return `${names.join(", ")} 파일만 올릴 수 있습니다.`;
  }
  if (file.size > MAX_BYTES) return "파일이 너무 큽니다(최대 20MB).";
  const bytes = new Uint8Array(await file.arrayBuffer());
  const { magic, type } = SIGNATURES[ext];
  if (!magic.every((b, i) => bytes[i] === b)) {
    return "파일 내용이 확장자와 맞지 않습니다.";
  }
  return {
    name,
    type,
    bytes,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
}

/** 같은 파일이 이미 첨부된 보고서 (숨긴 첨부·숨긴 보고서는 빼고) */
async function sameFileReport(sha256: string) {
  const a = await prisma.svcReportAttachment.findFirst({
    where: { sha256, deletedAt: null, report: { deletedAt: null } },
    select: { report: { select: { id: true, title: true, tripStart: true } } },
  });
  return a ? brief(a.report) : null;
}

const brief = (r: { id: string; title: string; tripStart: Date | null }) => ({
  id: r.id,
  title: r.title,
  tripStart: iso(r.tripStart),
});

/** 출장 시작일·요청처·작성자가 같고, 일련번호가 있으면 그것까지 겹치는 기존 보고서 (최대 5건) */
async function similarReports(v: {
  tripStart?: string | null;
  requestOrg?: string;
  authorName?: string;
  products?: { serialNo: string }[];
}) {
  if (!v.tripStart || !v.requestOrg) return [];
  const serials = (v.products ?? []).map((p) => p.serialNo).filter(Boolean);
  const rows = await prisma.svcReport.findMany({
    where: {
      deletedAt: null,
      tripStart: day(v.tripStart),
      requestOrg: v.requestOrg,
      authorName: v.authorName ?? "",
      ...(serials.length
        ? { products: { some: { serialNo: { in: serials } } } }
        : {}),
    },
    select: { id: true, title: true, tripStart: true },
    take: 5,
  });
  return rows.map(brief);
}

export async function uploadAttachments(
  formData: FormData,
): Promise<ActionResult> {
  const user = await editor();
  if (!user) return { ok: false, message: NO_EDIT_MESSAGE };
  const reportId = String(formData.get("reportId") ?? "");
  const kind = String(formData.get("kind") ?? "") as SvcAttachmentKind;
  if (!(kind in ATTACHMENT_KIND_LABEL)) {
    return { ok: false, message: "파일 종류를 선택하세요." };
  }
  const report = await prisma.svcReport.findUnique({ where: { id: reportId } });
  if (!report || report.deletedAt) {
    return { ok: false, message: "출장보고서를 찾을 수 없습니다." };
  }
  const files = formData.getAll("file");
  const failed: string[] = [];
  let saved = 0;
  const now = await getNow();
  for (const file of files) {
    const checked = await checkFile(file);
    const name = file instanceof File ? file.name : "파일";
    if (typeof checked === "string") {
      failed.push(`${name}: ${checked}`);
      continue;
    }
    await prisma.$transaction(async (tx) => {
      const a = await tx.svcReportAttachment.create({
        data: {
          reportId,
          kind,
          originalName: checked.name,
          contentType: checked.type,
          size: checked.bytes.length,
          sha256: checked.sha256,
          content: checked.bytes,
          uploadedById: user.id,
        },
      });
      await recordAudit(tx, {
        occurredAt: now,
        actor: actor(user),
        area: "service",
        screen: "service-attachments",
        action: "CREATE",
        target: {
          type: "SvcReportAttachment",
          id: a.id,
          label: `${report.title} · ${checked.name}`,
        },
        meta: { kind: ATTACHMENT_KIND_LABEL[kind], size: checked.bytes.length },
      });
    });
    saved++;
  }
  if (saved) refresh();
  return {
    ok: failed.length === 0,
    message: [
      saved ? `${saved}개 파일을 첨부했습니다.` : "",
      failed.join(" / "),
    ]
      .filter(Boolean)
      .join(" "),
  };
}

export async function hideAttachment(id: string): Promise<ActionResult> {
  const user = await editor();
  if (!user) return { ok: false, message: NO_EDIT_MESSAGE };
  const now = await getNow();
  const done = await prisma.$transaction(async (tx) => {
    const a = await tx.svcReportAttachment.findUnique({
      where: { id: String(id) },
      select: {
        id: true,
        originalName: true,
        deletedAt: true,
        report: { select: { title: true } },
      },
    });
    if (!a || a.deletedAt) return false;
    await tx.svcReportAttachment.update({
      where: { id: a.id },
      data: { deletedAt: now, deletedById: user.id },
    });
    await recordAudit(tx, {
      occurredAt: now,
      actor: actor(user),
      area: "service",
      screen: "service-attachments",
      action: "HIDE",
      target: {
        type: "SvcReportAttachment",
        id: a.id,
        label: `${a.report.title} · ${a.originalName}`,
      },
    });
    return true;
  });
  if (!done) return { ok: false, message: CONFLICT };
  refresh();
  return { ok: true, message: "첨부 파일을 숨겼습니다." };
}

// ---------- PDF로 등록 ----------

export type PdfPreview =
  | { ok: false; message: string }
  | (Extracted & {
      ok: true;
      sameFile: ReturnType<typeof brief> | null;
      similar: ReturnType<typeof brief>[];
    });

/** 출장보고서 PDF 를 읽어 입력 폼에 넣을 값 — 아무것도 저장하지 않는다 */
export async function previewReportPdf(
  formData: FormData,
): Promise<PdfPreview> {
  const user = await editor();
  if (!user) return { ok: false, message: NO_EDIT_MESSAGE };
  const checked = await checkFile(formData.get("file"), [".pdf"]);
  if (typeof checked === "string") return { ok: false, message: checked };
  try {
    const parts = await prisma.svcPart.findMany({
      where: { deletedAt: null },
      select: { name: true },
    });
    const result = parseReportLines(
      await readLines(checked.bytes),
      parts.map((p) => p.name),
    );
    return {
      ok: true,
      ...result,
      sameFile: await sameFileReport(checked.sha256),
      similar: await similarReports(result.data),
    };
  } catch (error) {
    if (error instanceof PdfImportError)
      return { ok: false, message: error.message };
    throw error;
  }
}

/** 사람이 확인한 값으로 새 보고서 + 원본 PDF 첨부 (기존 보고서는 바꾸지 않음) */
export async function createReportFromPdf(formData: FormData): Promise<
  ActionResult & {
    similar?: ReturnType<typeof brief>[];
    sameFile?: ReturnType<typeof brief>;
  }
> {
  const user = await editor();
  if (!user) return { ok: false, message: NO_EDIT_MESSAGE };
  const checked = await checkFile(formData.get("file"), [".pdf"]);
  if (typeof checked === "string") return { ok: false, message: checked };
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("data") ?? ""));
  } catch {
    return { ok: false, message: "보고서 내용을 읽을 수 없습니다." };
  }
  const parsed = parseInput(raw);
  if (parsed.error) return parsed.error;
  const same = await sameFileReport(checked.sha256);
  if (same) {
    return {
      ok: false,
      message: `이미 등록된 PDF입니다(보고서 ${same.title}).`,
      sameFile: same,
    };
  }
  const similar = await similarReports(parsed.values);
  if (similar.length && formData.get("confirmDuplicate") !== "1") {
    return {
      ok: false,
      message:
        "출장 시작일·요청처·작성자·일련번호가 같은 보고서가 이미 있습니다. 중복이 아니면 확인 후 다시 저장하세요.",
      similar,
    };
  }
  const now = await getNow();
  const report = await prisma.$transaction(async (tx) => {
    const r = await createIn(tx, parsed.values, user, now, {
      fileName: checked.name,
    });
    await tx.svcReportAttachment.create({
      data: {
        reportId: r.id,
        kind: "ORIGINAL",
        originalName: checked.name,
        contentType: checked.type,
        size: checked.bytes.length,
        sha256: checked.sha256,
        content: checked.bytes,
        uploadedById: user.id,
      },
    });
    return r;
  });
  refresh();
  return {
    ok: true,
    id: report.id,
    message: "PDF로 출장보고서를 등록했습니다. 원본 PDF가 첨부되었습니다.",
  };
}
