// 서비스팀 조회 (서버 전용) — 출장 시작일이 기간 안인 출장보고서
import "server-only";

import { prisma } from "@/shared/db/client";
import { periodDateRange, type Period } from "@/shared/period/period";

import type { ReportRow } from "../metrics/overview";
import { SERVICE_SAMPLE_BY } from "./sample";

export async function loadReports(period: Period): Promise<ReportRow[]> {
  const rows = await prisma.svcReport.findMany({
    where: {
      tripStart: periodDateRange(period),
      deletedAt: null,
    },
    select: {
      billing: true,
      region: true,
      sigungu: true,
      createdById: true,
      products: { select: { quantity: true } },
      parts: {
        select: {
          partId: true,
          quantity: true,
          part: { select: { name: true } },
        },
      },
    },
  });
  return rows.map((r) => ({
    billing: r.billing,
    region: r.region,
    sigungu: r.sigungu,
    parts: r.parts.map((p) => ({
      partId: p.partId,
      name: p.part.name,
      quantity: p.quantity,
    })),
    productQuantities: r.products.map((p) => p.quantity),
    sample: r.createdById === SERVICE_SAMPLE_BY,
  }));
}
