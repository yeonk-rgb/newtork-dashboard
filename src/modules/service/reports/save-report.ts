// 출장보고서 저장 공용 (서버 전용) — 화면 Server Action 과 엑셀 가져오기 스크립트(npm run import:service)가 같이 쓴다
import "server-only";

import {
  date,
  diffFields,
  labelOf,
  type AuditField,
} from "@/shared/audit/diff";
import { recordAudit } from "@/shared/audit/record";
import type { Prisma } from "@/shared/db/generated/client";

import { BILLING_LABEL } from "../labels";
import { regionLabel } from "../regions/regions";
import type { ReportValues } from "./schemas";

const day = (v: string) => (v ? new Date(`${v}T00:00:00Z`) : null);
/** 한국 시간 "YYYY-MM-DDTHH:mm" → UTC 시각 */
const kstTime = (v: string) => (v ? new Date(`${v}:00+09:00`) : null);

export type AuditRow = Record<string, unknown>;
export const REPORT_FIELDS: AuditField<AuditRow>[] = [
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
export function auditRow(v: {
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

export function reportData(v: ReportValues) {
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
export async function saveChildren(
  tx: Prisma.TransactionClient,
  reportId: string,
  v: ReportValues,
  user: { id: string },
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

export async function createReportIn(
  tx: Prisma.TransactionClient,
  v: ReportValues,
  user: { id: string; loginId: string },
  now: Date,
  meta?: Record<string, unknown>,
  screen = "service-reports",
) {
  const report = await tx.svcReport.create({
    data: { ...reportData(v), createdById: user.id, updatedById: user.id },
  });
  await saveChildren(tx, report.id, v, user);
  await recordAudit(tx, {
    occurredAt: now,
    actor: { id: user.id, loginId: user.loginId },
    area: "service",
    screen,
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
