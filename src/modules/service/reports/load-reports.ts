// 출장보고서 조회 (서버 전용) — 친구 저장소 ServiceReportViewSet.get_queryset 필터 그대로 + 숨긴 보고서 보기
// 순서: 출장 시작일 최신순(출장일 없는 것 먼저 — 친구 앱 PostgreSQL 내림차순과 같음), 같으면 나중에 입력한 것 먼저. 50건씩
import "server-only";

import { prisma } from "@/shared/db/client";
import type { Prisma } from "@/shared/db/generated/client";

import { SIDO } from "../regions/regions";

export const PAGE_SIZE = 50;

export type ReportFilter = {
  q: string;
  from: string;
  to: string;
  /** "PAID" | "FREE" | "none" | "" */
  billing: string;
  /** 시·도 이름 | "none" | "" */
  region: string;
  /** 시·군·구 이름 | "none"(시·도만 앎) | "" — 대시보드 지도에서 들어올 때 */
  sigungu: string;
  person: string;
  model: string;
  /** "none" = 출장 시작일 없는 것만 */
  tripDate: string;
  hidden: boolean;
  page: number;
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (v: string | string[] | undefined) =>
  (typeof v === "string" ? v : "").trim();

export function parseReportFilter(
  sp: Record<string, string | string[] | undefined>,
): ReportFilter {
  const billing = str(sp.billing);
  const region = str(sp.region);
  const page = Number(str(sp.page));
  return {
    q: str(sp.q).slice(0, 100),
    from: DATE.test(str(sp.from)) ? str(sp.from) : "",
    to: DATE.test(str(sp.to)) ? str(sp.to) : "",
    billing: ["PAID", "FREE", "none"].includes(billing) ? billing : "",
    region:
      region === "none" || (SIDO as readonly string[]).includes(region)
        ? region
        : "",
    sigungu: str(sp.sigungu).slice(0, 20),
    person: str(sp.person).slice(0, 50),
    model: str(sp.model).slice(0, 50),
    tripDate: str(sp.trip_date) === "none" ? "none" : "",
    hidden: str(sp.hidden) === "1",
    page: Number.isInteger(page) && page > 1 ? page : 1,
  };
}

/** 필터 → 주소 (쪽 이동·링크가 같은 조건을 쓰게) */
export function reportSearch(f: ReportFilter, page = f.page) {
  const p = new URLSearchParams();
  const set = (k: string, v: string) => v && p.set(k, v);
  set("q", f.q);
  set("from", f.from);
  set("to", f.to);
  set("billing", f.billing);
  set("region", f.region);
  set("sigungu", f.sigungu);
  set("person", f.person);
  set("model", f.model);
  set("trip_date", f.tripDate);
  if (f.hidden) p.set("hidden", "1");
  if (page > 1) p.set("page", String(page));
  return p.toString();
}

const utc = (d: string) => new Date(`${d}T00:00:00Z`);
const contains = (v: string) => ({ contains: v, mode: "insensitive" as const });

export function reportWhere(f: ReportFilter): Prisma.SvcReportWhereInput {
  const and: Prisma.SvcReportWhereInput[] = [
    { deletedAt: f.hidden ? { not: null } : null },
  ];
  if (f.q) {
    and.push({
      OR: [
        { title: contains(f.q) },
        { requestOrg: contains(f.q) },
        { address: contains(f.q) },
        { authorName: contains(f.q) },
        { companions: { some: { name: contains(f.q) } } },
        { products: { some: { modelName: contains(f.q) } } },
        { products: { some: { serialNo: contains(f.q) } } },
      ],
    });
  }
  if (f.from || f.to) {
    and.push({
      tripStart: {
        ...(f.from ? { gte: utc(f.from) } : {}),
        ...(f.to ? { lte: utc(f.to) } : {}),
      },
    });
  }
  if (f.billing === "none") and.push({ billing: null });
  else if (f.billing) and.push({ billing: f.billing as "PAID" | "FREE" });
  if (f.region === "none") and.push({ region: null });
  else if (f.region) and.push({ region: f.region });
  if (f.sigungu === "none") and.push({ region: { not: null }, sigungu: null });
  else if (f.sigungu) and.push({ sigungu: f.sigungu });
  if (f.person) {
    and.push({
      OR: [
        { authorName: f.person },
        { companions: { some: { name: f.person } } },
      ],
    });
  }
  if (f.model) and.push({ products: { some: { modelName: f.model } } });
  if (f.tripDate === "none") and.push({ tripStart: null });
  return { AND: and };
}

export async function loadReportPage(f: ReportFilter) {
  const where = reportWhere(f);
  const [total, rows] = await Promise.all([
    prisma.svcReport.count({ where }),
    prisma.svcReport.findMany({
      where,
      orderBy: [
        { tripStart: { sort: "desc", nulls: "first" } },
        { createdAt: "desc" },
      ],
      skip: (f.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        title: true,
        tripStart: true,
        tripEnd: true,
        requestOrg: true,
        region: true,
        sigungu: true,
        workType: true,
        billing: true,
        authorName: true,
        deletedAt: true,
        companions: { select: { name: true }, orderBy: { id: "asc" } },
        products: { select: { modelName: true }, orderBy: { id: "asc" } },
        _count: { select: { attachments: { where: { deletedAt: null } } } },
      },
    }),
  ]);
  return { total, rows };
}

export type ReportListRow = Awaited<
  ReturnType<typeof loadReportPage>
>["rows"][number];

const REPORT_SELECT = {
  id: true,
  title: true,
  status: true,
  requestOrgType: true,
  requestOrg: true,
  siteContact: true,
  address: true,
  region: true,
  sigungu: true,
  tripStart: true,
  tripEnd: true,
  extraTrip: true,
  authorName: true,
  writtenAt: true,
  happyCallDate: true,
  workType: true,
  faultDescription: true,
  workDescription: true,
  workResult: true,
  billing: true,
  quoteType: true,
  quote: true,
  approver: true,
  cc: true,
  note: true,
  deletedAt: true,
  createdById: true,
  updatedById: true,
  createdAt: true,
  updatedAt: true,
  companions: { select: { name: true }, orderBy: { id: "asc" } },
  products: {
    select: { modelName: true, spec: true, serialNo: true, quantity: true },
    orderBy: { id: "asc" },
  },
  parts: {
    select: {
      partId: true,
      quantity: true,
      part: { select: { name: true } },
    },
    orderBy: { position: "asc" },
  },
} as const;

/** 상세·수정용 1건 (숨긴 것도 — 화면이 안내), 없으면 null */
export async function loadReport(id: string) {
  const report = await prisma.svcReport.findUnique({
    where: { id },
    select: {
      ...REPORT_SELECT,
      attachments: {
        where: { deletedAt: null },
        select: {
          id: true,
          kind: true,
          originalName: true,
          contentType: true,
          size: true,
          uploadedById: true,
          uploadedAt: true,
        },
        orderBy: { uploadedAt: "asc" },
      },
    },
  });
  if (!report) return null;
  // 이 보고서 출장지(요청처와 이름이 같은 출장지)의 부품 가격 — 없으면 null (다른 값으로 채우지 않음)
  const prices = report.requestOrg
    ? await prisma.svcSitePartPrice.findMany({
        where: {
          deletedAt: null,
          site: { name: report.requestOrg, deletedAt: null },
          partId: { in: report.parts.map((p) => p.partId) },
        },
        select: { partId: true, unitPrice: true },
      })
    : [];
  const priceOf = new Map(prices.map((p) => [p.partId, Number(p.unitPrice)]));
  return {
    ...report,
    parts: report.parts.map((p) => ({
      partId: p.partId,
      name: p.part.name,
      quantity: p.quantity,
      sitePrice: priceOf.get(p.partId) ?? null,
    })),
  };
}

export type ReportDetail = NonNullable<Awaited<ReturnType<typeof loadReport>>>;

const distinct = (values: string[]) =>
  [...new Set(values.filter(Boolean))].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );

/** 입력 화면 자동완성 — 이미 쓴 이름 목록 (친구 NamesView 그대로, 숨긴 보고서 제외) */
export async function loadNames() {
  const live = { deletedAt: null };
  const [reports, companions, models, parts] = await Promise.all([
    prisma.svcReport.findMany({
      where: live,
      select: {
        authorName: true,
        approver: true,
        requestOrg: true,
        workType: true,
      },
    }),
    prisma.svcReportCompanion.findMany({
      where: { report: live },
      select: { name: true },
    }),
    prisma.svcReportProduct.findMany({
      where: { report: live },
      select: { modelName: true },
    }),
    prisma.svcPart.findMany({
      where: live,
      select: { name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  return {
    people: distinct([
      ...reports.map((r) => r.authorName),
      ...reports.map((r) => r.approver),
      ...companions.map((c) => c.name),
    ]),
    models: distinct(models.map((m) => m.modelName)),
    requestOrgs: distinct(reports.map((r) => r.requestOrg)),
    workTypes: distinct(reports.map((r) => r.workType)),
    parts: parts.map((p) => p.name),
  };
}

export type Names = Awaited<ReturnType<typeof loadNames>>;
