"use server";
// 경영지원 관리 [지난달 내용 불러오기] — 미리보기(읽기만)와 저장. 권한·조건을 저장할 때 서버에서 다시 확인한다 (2026-10-26 결정 05-23)
// 저장: Serializable 트랜잭션 — 이번 달이 비어 있고 지난달 행 수가 미리보기 때와 같을 때만 행 추가 + 변경 기록 요약 1건
import { refresh } from "next/cache";
import { z } from "zod";

import { recordAudit } from "@/shared/audit/record";
import { getCurrentUser } from "@/shared/auth";
import { prisma } from "@/shared/db/client";
import { addMonths, type YearMonth } from "@/shared/period/period";

import { auditActor } from "../audit-fields";
import { getNow, getTodayKst } from "../data/load-summary-input";
import { TERMS } from "../terms";
import { planCopy, type CopySourceRow } from "./copy-previous";
import type { LedgerKind } from "./labels";
import {
  canCreateLedgerEntry,
  formatLedgerMonth,
  isFutureMonth,
  parseLedgerMonth,
  toDateOnly,
} from "./rules";

export type CopyPreview =
  | {
      ok: true;
      /** 지난달 "YYYY-MM" */
      from: string;
      /** 이번 달에 이미 있는 행 (숨긴 행 제외) — 1 이상이면 불러올 수 없음 */
      existing: number;
      /** 지난달 행 수 (숨긴 행 제외) — 저장할 때 같은지 다시 확인 */
      sourceCount: number;
      kinds: { kind: LedgerKind; count: number; amount: string }[];
      collected: { count: number; amount: string };
    }
  | { ok: false; code: "FORBIDDEN" | "INVALID"; message: string };

export type CopyResult =
  | { ok: true; message: string }
  | {
      ok: false;
      code: "FORBIDDEN" | "INVALID" | "CONFLICT";
      message: string;
    };

const monthSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
});
const copySchema = monthSchema.extend({
  includeCollected: z.boolean(),
  expectedSourceCount: z.number().int().min(0),
});

class ConflictError extends Error {}

type Checked =
  | {
      ok: true;
      user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
      ym: YearMonth;
      from: YearMonth;
    }
  | { ok: false; code: "FORBIDDEN" | "INVALID"; message: string };

async function check(month: string): Promise<Checked> {
  const user = await getCurrentUser();
  if (!user || !canCreateLedgerEntry(user)) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message: `${TERMS.ledger}를 입력할 권한이 없습니다. (열람만 가능)`,
    };
  }
  const ym = parseLedgerMonth(month);
  if (!ym)
    return { ok: false, code: "INVALID", message: "기준년월을 확인하세요." };
  if (isFutureMonth(ym, toDateOnly(await getTodayKst()))) {
    return {
      ok: false,
      code: "INVALID",
      message: "이번 달 이후의 기준년월에는 입력할 수 없습니다.",
    };
  }
  return { ok: true, user, ym, from: addMonths(ym, -1) };
}

const visible = (ym: YearMonth) => ({
  year: ym.year,
  month: ym.month,
  deletedAt: null,
});

async function loadSource(
  db: Pick<typeof prisma, "ledgerEntry">,
  from: YearMonth,
): Promise<CopySourceRow[]> {
  return db.ledgerEntry.findMany({
    where: visible(from),
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: {
      kind: true,
      arStatus: true,
      purchaseType: true,
      expenseType: true,
      autoTransfer: true,
      partnerCode: true,
      partnerName: true,
      amount: true,
      note: true,
      dueOn: true,
      settledOn: true,
    },
  });
}

/** 미리보기 — DB 쓰기 없음 */
export async function previewCopyPrevious(raw: unknown): Promise<CopyPreview> {
  const parsed = monthSchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, code: "INVALID", message: "기준년월을 확인하세요." };
  const c = await check(parsed.data.month);
  if (!c.ok) return c;

  const [existing, source] = await Promise.all([
    prisma.ledgerEntry.count({ where: visible(c.ym) }),
    loadSource(prisma, c.from),
  ]);
  const { summary } = planCopy(source, { includeCollected: false });
  return {
    ok: true,
    from: formatLedgerMonth(c.from),
    existing,
    sourceCount: source.length,
    // 미리보기 금액은 당월 수금 제외 기준 — 포함하면 외상매출금에 collected 가 더해진다 (화면에서 계산)
    kinds: summary.kinds.map((k) => ({ ...k, amount: k.amount.toString() })),
    collected: {
      count: summary.collected.count,
      amount: summary.collected.amount.toString(),
    },
  };
}

/** 저장 — 이번 달이 비어 있고 지난달 행 수가 미리보기 때와 같을 때만 */
export async function copyPreviousMonth(raw: unknown): Promise<CopyResult> {
  const parsed = copySchema.safeParse(raw);
  if (!parsed.success)
    return { ok: false, code: "INVALID", message: "입력값을 확인하세요." };
  const input = parsed.data;
  const c = await check(input.month);
  if (!c.ok) return c;
  const { user, ym, from } = c;
  const now = await getNow();
  const monthText = formatLedgerMonth(ym);
  const fromText = formatLedgerMonth(from);

  let saved = 0;
  try {
    await prisma.$transaction(
      async (tx) => {
        if ((await tx.ledgerEntry.count({ where: visible(ym) })) > 0) {
          throw new ConflictError(
            `${monthText}에 이미 입력된 행이 있어 불러올 수 없습니다. 새로고침 후 확인하세요.`,
          );
        }
        const source = await loadSource(tx, from);
        if (source.length !== input.expectedSourceCount) {
          throw new ConflictError(
            `${fromText} 내용이 미리보기 뒤에 바뀌었습니다. 다시 열어 확인하세요.`,
          );
        }
        const { entries, summary } = planCopy(source, {
          includeCollected: input.includeCollected,
        });
        if (entries.length === 0) {
          throw new ConflictError(`${fromText}에 불러올 행이 없습니다.`);
        }
        await tx.ledgerEntry.createMany({
          // 화면 목록은 createdAt 순 — 지난달 순서가 유지되도록 1ms씩 늘린다
          data: entries.map((e, i) => ({
            ...e,
            year: ym.year,
            month: ym.month,
            createdById: user.id,
            updatedById: user.id,
            createdAt: new Date(now.getTime() + i),
          })),
        });
        // 변경 기록: 요약 1건 (엑셀 이관과 같은 방식 — 행마다 남기지 않음)
        await recordAudit(tx, {
          occurredAt: now,
          actor: auditActor(user),
          area: "management",
          screen: "ledger-copy",
          action: "CREATE",
          target: {
            type: "LedgerMonth",
            id: monthText,
            label: `${TERMS.ledger} ${monthText} · 지난달(${fromText}) 내용 불러오기`,
          },
          meta: {
            month: monthText,
            from: fromText,
            savedRows: entries.length,
            collectedRows: summary.collected.count,
            includeCollected: input.includeCollected ? "포함" : "제외",
          },
        });
        saved = entries.length;
      },
      { isolationLevel: "Serializable" },
    );
  } catch (error) {
    if (error instanceof ConflictError) {
      return { ok: false, code: "CONFLICT", message: error.message };
    }
    throw error;
  }

  refresh();
  return {
    ok: true,
    message: `${fromText} 내용 ${saved}행을 ${monthText}로 불러왔습니다. 잔액을 이번 달 값으로 고치세요.`,
  };
}
