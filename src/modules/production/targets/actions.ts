"use server";
// 연간 목표 1개 + 월별 목표 12개 저장 (친구 저장소 TargetView 그대로 — 비운 칸 = 미입력, 연간과 월 합계가 달라도 저장)
// 권한: 생산 수정(팀장·관리자·경영지원팀), 저장과 변경 이력은 한 트랜잭션
import { refresh } from "next/cache";
import { z } from "zod";

import { recordAudit } from "@/shared/audit/record";
import { getCurrentUser } from "@/shared/auth";
import { prisma } from "@/shared/db/client";
import { getNow } from "@/shared/time/now";

import { NO_EDIT_MESSAGE, productionAbilities } from "../rules";

const amount = z
  .number()
  .int("정수로 입력하세요.")
  .min(0, "0 이상으로 입력하세요.")
  .max(1_000_000, "너무 큰 값입니다.")
  .nullable();

const schema = z.object({
  year: z.number().int().min(1900).max(2100),
  annual: amount,
  monthly: z.array(amount).length(12),
});

export type TargetInput = z.input<typeof schema>;

const show = (v: number | null | undefined) =>
  v === null || v === undefined ? null : `${v.toLocaleString("ko-KR")}대`;

export async function saveTargets(raw: unknown) {
  const user = await getCurrentUser();
  if (!user || !productionAbilities(user).canEdit) {
    return { ok: false, message: NO_EDIT_MESSAGE };
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "입력값을 확인하세요.",
    };
  }
  const { year, annual, monthly } = parsed.data;
  const now = await getNow();
  await prisma.$transaction(async (tx) => {
    const [beforeAnnual, beforeMonthly] = await Promise.all([
      tx.prodAnnualTarget.findUnique({ where: { year } }),
      tx.prodMonthlyTarget.findMany({ where: { year } }),
    ]);
    const prev = new Map(beforeMonthly.map((m) => [m.month, m.target]));
    await tx.prodAnnualTarget.upsert({
      where: { year },
      create: { year, annualTarget: annual, updatedById: user.id },
      update: { annualTarget: annual, updatedById: user.id },
    });
    for (const [i, value] of monthly.entries()) {
      const month = i + 1;
      if (value === null) {
        await tx.prodMonthlyTarget.deleteMany({ where: { year, month } });
      } else {
        await tx.prodMonthlyTarget.upsert({
          where: { year_month: { year, month } },
          create: { year, month, target: value, updatedById: user.id },
          update: { target: value, updatedById: user.id },
        });
      }
    }
    const changes = [
      {
        field: "annual",
        label: "연간 목표",
        before: show(beforeAnnual?.annualTarget),
        after: show(annual),
      },
      ...monthly.map((v, i) => ({
        field: `month${i + 1}`,
        label: `${i + 1}월 목표`,
        before: show(prev.get(i + 1)),
        after: show(v),
      })),
    ].filter((c) => c.before !== c.after);
    await recordAudit(tx, {
      occurredAt: now,
      actor: { id: user.id, loginId: user.loginId },
      area: "production",
      screen: "production-targets",
      action: "UPDATE",
      target: {
        type: "ProdTarget",
        id: String(year),
        label: `${year}년 목표 생산량`,
      },
      changes,
    });
  });
  refresh();
  return { ok: true, message: `${year}년 목표를 저장했습니다.` };
}
