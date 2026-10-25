// 엑셀 업로드 저장 (서버 전용): 한 트랜잭션 — 전부 성공하거나 전부 취소
// - 연간목표: 연도별 upsert (분기 목표는 그대로)
// - 월별실적: 연·월별 upsert, 확정(CONFIRMED)으로 저장 → 바로 대시보드 반영
//   광고선전비·접대비는 같은 이름 항목에, 그외지출액은 '기타(엑셀 이관)' 항목에 넣고,
//   그 달의 나머지 '그 외 지출' 항목은 0원으로 맞춘다 (그외지출액에 포함된 것으로 보고 이중 집계 방지)
// - uploadId 를 남겨 외부 AI 분석 차단(05-19)과 이력에 쓴다
import "server-only";

import type { Prisma } from "@/shared/db/generated/client";
import { recordAudit } from "@/shared/audit/record";
import { prisma } from "@/shared/db/client";

import type { UploadPlan } from "./parse-upload";

export const OTHER_CATEGORY_NAME = "기타(엑셀 이관)";

export type SaveSource = {
  userId: string;
  /** 변경 기록에 남길 그때 아이디 */
  loginId: string;
  fileNames: string[];
  now: Date;
};

type Tx = Prisma.TransactionClient;

/** 이름으로 '그 외 지출' 항목을 찾고 없으면 맨 뒤에 만든다 */
async function ensureCategory(tx: Tx, name: string): Promise<string> {
  const found = await tx.expenseCategory.findUnique({ where: { name } });
  if (found) return found.id;
  const last = await tx.expenseCategory.aggregate({
    _max: { sortOrder: true },
  });
  const created = await tx.expenseCategory.create({
    data: { name, sortOrder: (last._max.sortOrder ?? 0) + 1 },
  });
  return created.id;
}

export async function saveUploadPlan(
  plan: UploadPlan,
  source: SaveSource,
): Promise<{ uploadId: string; savedRows: number }> {
  const savedRows = plan.targets.length + plan.months.length;
  return prisma.$transaction(
    async (tx) => {
      const upload = await tx.dataUpload.create({
        data: {
          fileNames: source.fileNames,
          sheets: plan.sheets,
          savedRows,
          createdById: source.userId,
        },
      });
      const audit = { updatedById: source.userId, uploadId: upload.id };

      for (const t of plan.targets) {
        await tx.annualTarget.upsert({
          where: { year: t.year },
          create: {
            year: t.year,
            revenueTarget: t.revenueTarget,
            createdById: source.userId,
            ...audit,
          },
          update: { revenueTarget: t.revenueTarget, ...audit },
        });
      }

      if (plan.months.length > 0) {
        const categoryIds = {
          advertising: await ensureCategory(tx, "광고선전비"),
          entertainment: await ensureCategory(tx, "접대비"),
          otherExpense: await ensureCategory(tx, OTHER_CATEGORY_NAME),
        };
        for (const m of plan.months) {
          const values = {
            productSales: m.productSales,
            goodsSales: m.goodsSales,
            serviceSales: m.serviceSales,
            goodsPurchase: m.goodsPurchase,
            materialPurchase: m.materialPurchase,
            operatingExpense: m.operatingExpense,
            status: "CONFIRMED" as const,
            confirmedAt: source.now,
            ...audit,
          };
          const finance = await tx.monthlyFinance.upsert({
            where: { year_month: { year: m.year, month: m.month } },
            create: {
              year: m.year,
              month: m.month,
              createdById: source.userId,
              ...values,
            },
            update: values,
          });
          const amounts = [
            [categoryIds.advertising, m.advertising],
            [categoryIds.entertainment, m.entertainment],
            [categoryIds.otherExpense, m.otherExpense],
          ] as const;
          for (const [categoryId, amount] of amounts) {
            await tx.otherExpense.upsert({
              where: {
                monthlyFinanceId_categoryId: {
                  monthlyFinanceId: finance.id,
                  categoryId,
                },
              },
              create: { monthlyFinanceId: finance.id, categoryId, amount },
              update: { amount },
            });
          }
          await tx.otherExpense.updateMany({
            where: {
              monthlyFinanceId: finance.id,
              categoryId: { notIn: amounts.map(([id]) => id) },
            },
            data: { amount: 0n },
          });
        }
      }
      // 변경 기록: 요약 1건 (행마다 남기지 않음). 저장된 목표·월은 uploadId 로 이어진다
      await recordAudit(tx, {
        occurredAt: source.now,
        actor: { id: source.userId, loginId: source.loginId },
        area: "management",
        screen: "upload",
        action: "IMPORT",
        target: {
          type: "DataUpload",
          id: upload.id,
          label: `엑셀 업로드 · ${source.fileNames.join(", ")}`,
        },
        meta: {
          uploadId: upload.id,
          fileNames: source.fileNames,
          savedRows,
          targetYears: plan.targets.map((t) => t.year),
          months: plan.months.map(
            (m) => `${m.year}-${String(m.month).padStart(2, "0")}`,
          ),
        },
      });
      return { uploadId: upload.id, savedRows };
    },
    { timeout: 60_000, maxWait: 10_000 },
  );
}

/** 미리보기의 "기존 값 덮어씀" 표시용 */
export async function loadExistingData() {
  const [months, targets] = await Promise.all([
    prisma.monthlyFinance.findMany({
      select: { year: true, month: true, status: true },
    }),
    prisma.annualTarget.findMany({ select: { year: true } }),
  ]);
  return {
    months: new Map(months.map((m) => [`${m.year}-${m.month}`, m.status])),
    targetYears: new Set(targets.map((t) => t.year)),
  };
}

export async function loadRecentUploads(limit = 5) {
  return prisma.dataUpload.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
