"use server";
// 채권·채무 저장 Server Action — 권한·검증·동시 수정을 모두 서버에서 다시 확인한다
import { refresh } from "next/cache";

import { getCurrentUser, type AppUser } from "@/shared/auth";
import { prisma } from "@/shared/db/client";

import { getNow, getTodayKst } from "../data/load-summary-input";
import { KIND_LABEL } from "./labels";
import {
  canCreateLedgerEntry,
  isFutureMonth,
  ledgerAbilities,
  ledgerDateErrors,
  parseDateOnly,
  toDateOnly,
  type LedgerAbilities,
} from "./rules";
import {
  createLedgerSchema,
  ledgerRowActionSchema,
  toLedgerData,
  updateLedgerSchema,
  type LedgerFields,
} from "./schemas";

export type LedgerActionResult =
  | { ok: true; message: string }
  | {
      ok: false;
      code: "FORBIDDEN" | "INVALID" | "CONFLICT" | "NOT_FOUND";
      message: string;
    };

const forbidden = (message: string): LedgerActionResult => ({
  ok: false,
  code: "FORBIDDEN",
  message,
});
const invalid = (message: string): LedgerActionResult => ({
  ok: false,
  code: "INVALID",
  message,
});
const conflict: LedgerActionResult = {
  ok: false,
  code: "CONFLICT",
  message: "다른 사람이 먼저 수정했습니다. 새로고침 후 다시 시도하세요.",
};

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "입력값을 확인하세요.";
}

const date = (value: string | null) => (value ? parseDateOnly(value)! : null);

/** 날짜 규칙 확인 + DB 저장값 (실패하면 메시지) */
async function checkedData(
  fields: LedgerFields,
): Promise<ReturnType<typeof toLedgerData> | string> {
  const today = toDateOnly(await getTodayKst());
  const errors = ledgerDateErrors(
    {
      kind: fields.kind,
      arStatus: fields.kind === "AR" ? fields.arStatus : null,
      dueOn: fields.dueOn,
      settledOn: fields.settledOn,
    },
    today,
  );
  const error = errors.settledOn ?? errors.dueOn;
  return error ?? toLedgerData(fields);
}

function withDates(data: ReturnType<typeof toLedgerData>) {
  return { ...data, dueOn: date(data.dueOn), settledOn: date(data.settledOn) };
}

export async function createLedgerEntry(
  raw: unknown,
): Promise<LedgerActionResult> {
  const user = await getCurrentUser();
  if (!user || !canCreateLedgerEntry(user)) {
    return forbidden("채권·채무를 입력할 권한이 없습니다. (열람만 가능)");
  }
  const parsed = createLedgerSchema.safeParse(raw);
  if (!parsed.success) return invalid(firstIssue(parsed.error));
  const { year, month, fields } = parsed.data;

  if (isFutureMonth({ year, month }, toDateOnly(await getTodayKst()))) {
    return invalid("이번 달 이후의 기준년월에는 입력할 수 없습니다.");
  }
  const data = await checkedData(fields);
  if (typeof data === "string") return invalid(data);

  await prisma.ledgerEntry.create({
    data: {
      year,
      month,
      ...withDates(data),
      createdById: user.id,
      updatedById: user.id,
    },
  });

  refresh();
  return {
    ok: true,
    message: `${KIND_LABEL[fields.kind]} ${fields.partnerName} 행을 추가했습니다.`,
  };
}

type Loaded = {
  user: AppUser;
  row: NonNullable<Awaited<ReturnType<typeof prisma.ledgerEntry.findUnique>>>;
  abilities: LedgerAbilities;
};

/**
 * 행 하나를 불러와 권한·동시 수정을 확인 (실패하면 결과를 바로 돌려준다)
 * target: 복구만 "hidden"(숨긴 행 대상), 나머지 동작은 숨기지 않은 행만
 */
async function loadForAction(
  id: string,
  expectedUpdatedAt: string,
  target: "visible" | "hidden" = "visible",
): Promise<Loaded | LedgerActionResult> {
  const user = await getCurrentUser();
  if (!user) return forbidden("로그인이 필요합니다.");
  const row = await prisma.ledgerEntry.findUnique({ where: { id } });
  if (!row) return { ok: false, code: "NOT_FOUND", message: "행이 없습니다." };
  if (row.updatedAt.toISOString() !== expectedUpdatedAt) return conflict;
  if (target === "visible" && row.deletedAt !== null) {
    return invalid("숨긴 항목입니다. 복구한 뒤 수정하세요.");
  }
  if (target === "hidden" && row.deletedAt === null) {
    return invalid("이미 복구된 항목입니다. 새로고침하세요.");
  }
  const abilities = ledgerAbilities(user, { hidden: row.deletedAt !== null });
  return { user, row, abilities };
}

/** updatedAt 이 그대로일 때만 수정 (확인과 저장 사이에 끼어든 저장도 막음) */
async function updateIfUnchanged(
  loaded: Loaded,
  data: Parameters<typeof prisma.ledgerEntry.updateMany>[0]["data"],
  hidden = false,
): Promise<boolean> {
  const updated = await prisma.ledgerEntry.updateMany({
    where: {
      id: loaded.row.id,
      updatedAt: loaded.row.updatedAt,
      deletedAt: hidden ? { not: null } : null,
    },
    data: { ...data, updatedById: loaded.user.id },
  });
  return updated.count > 0;
}

export async function updateLedgerEntry(
  raw: unknown,
): Promise<LedgerActionResult> {
  const parsed = updateLedgerSchema.safeParse(raw);
  if (!parsed.success) return invalid(firstIssue(parsed.error));
  const { id, expectedUpdatedAt, fields } = parsed.data;

  const loaded = await loadForAction(id, expectedUpdatedAt);
  if ("ok" in loaded) return loaded;
  if (!loaded.abilities.canEdit) {
    return forbidden(loaded.abilities.notice ?? "수정할 권한이 없습니다.");
  }
  if (loaded.row.kind !== fields.kind) {
    return invalid("구분은 바꿀 수 없습니다. 숨긴 뒤 새 행으로 추가하세요.");
  }
  const data = await checkedData(fields);
  if (typeof data === "string") return invalid(data);

  if (!(await updateIfUnchanged(loaded, withDates(data)))) return conflict;

  refresh();
  return { ok: true, message: `${fields.partnerName} 행을 저장했습니다.` };
}

export async function hideLedgerEntry(
  raw: unknown,
): Promise<LedgerActionResult> {
  const parsed = ledgerRowActionSchema.safeParse(raw);
  if (!parsed.success) return invalid("요청 값을 확인하세요.");

  const loaded = await loadForAction(
    parsed.data.id,
    parsed.data.expectedUpdatedAt,
  );
  if ("ok" in loaded) return loaded;
  if (!loaded.abilities.canHide) {
    return forbidden("숨김 처리는 팀장만 할 수 있습니다.");
  }

  const saved = await updateIfUnchanged(loaded, {
    deletedAt: await getNow(),
    deletedById: loaded.user.id,
  });
  if (!saved) return conflict;

  refresh();
  return {
    ok: true,
    message: `${loaded.row.partnerName} 행을 숨겼습니다. [숨긴 항목 보기]에서 복구할 수 있습니다.`,
  };
}

export async function restoreLedgerEntry(
  raw: unknown,
): Promise<LedgerActionResult> {
  const parsed = ledgerRowActionSchema.safeParse(raw);
  if (!parsed.success) return invalid("요청 값을 확인하세요.");

  const loaded = await loadForAction(
    parsed.data.id,
    parsed.data.expectedUpdatedAt,
    "hidden",
  );
  if ("ok" in loaded) return loaded;
  if (!loaded.abilities.canRestore) {
    return forbidden("복구는 팀장만 할 수 있습니다.");
  }

  const saved = await updateIfUnchanged(
    loaded,
    { deletedAt: null, deletedById: null },
    true,
  );
  if (!saved) return conflict;

  refresh();
  return { ok: true, message: `${loaded.row.partnerName} 행을 복구했습니다.` };
}
