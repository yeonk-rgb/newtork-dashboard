"use server";
// 미수금 저장 Server Action — 권한·검증·동시 수정을 모두 서버에서 다시 확인한다
import { refresh } from "next/cache";

import { getCurrentUser, type AppUser } from "@/shared/auth";
import { prisma } from "@/shared/db/client";

import { getNow, getTodayKst } from "../data/load-summary-input";
import {
  canCreateReceivable,
  parseDateOnly,
  receivableAbilities,
  receivableDateErrors,
  toDateOnly,
  type ReceivableAbilities,
} from "./rules";
import {
  collectReceivableSchema,
  createReceivableSchema,
  rowActionSchema,
  updateReceivableSchema,
} from "./schemas";

export type ReceivableActionResult =
  | { ok: true; message: string }
  | {
      ok: false;
      code: "FORBIDDEN" | "INVALID" | "CONFLICT" | "NOT_FOUND";
      message: string;
    };

const CONFLICT_MESSAGE =
  "다른 사람이 먼저 수정했습니다. 새로고침 후 다시 시도하세요.";

const forbidden = (message: string): ReceivableActionResult => ({
  ok: false,
  code: "FORBIDDEN",
  message,
});
const invalid = (message: string): ReceivableActionResult => ({
  ok: false,
  code: "INVALID",
  message,
});
const conflict: ReceivableActionResult = {
  ok: false,
  code: "CONFLICT",
  message: CONFLICT_MESSAGE,
};

const date = (value: string) => parseDateOnly(value)!;

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "입력값을 확인하세요.";
}

function firstDateError(errors: Record<string, string | undefined>) {
  return Object.values(errors).find(Boolean) ?? null;
}

type Loaded = {
  user: AppUser;
  row: NonNullable<Awaited<ReturnType<typeof prisma.receivable.findUnique>>>;
  abilities: ReceivableAbilities;
};

/**
 * 건 하나를 불러와 권한·동시 수정을 확인 (실패하면 결과를 바로 돌려준다)
 * target: 복구만 "hidden"(숨긴 건 대상), 나머지 동작은 숨기지 않은 건만
 */
async function loadForAction(
  id: string,
  expectedUpdatedAt: string,
  target: "visible" | "hidden" = "visible",
): Promise<Loaded | ReceivableActionResult> {
  const user = await getCurrentUser();
  if (!user) return forbidden("로그인이 필요합니다.");
  const row = await prisma.receivable.findUnique({ where: { id } });
  if (!row) {
    return { ok: false, code: "NOT_FOUND", message: "미수금 건이 없습니다." };
  }
  if (row.updatedAt.toISOString() !== expectedUpdatedAt) return conflict;
  if (target === "visible" && row.deletedAt !== null) {
    return invalid("숨긴 항목입니다. 복구한 뒤 수정하세요.");
  }
  if (target === "hidden" && row.deletedAt === null) {
    return invalid("이미 복구된 항목입니다. 새로고침하세요.");
  }
  const abilities = receivableAbilities(user, {
    isCollected: row.isCollected,
    hidden: row.deletedAt !== null,
  });
  return { user, row, abilities };
}

/**
 * updatedAt 이 그대로일 때만 수정 (확인과 저장 사이에 끼어든 저장도 막음).
 * hidden: 숨김 상태 조건 (복구는 숨긴 건, 나머지는 숨기지 않은 건만)
 */
async function updateIfUnchanged(
  loaded: Loaded,
  data: Parameters<typeof prisma.receivable.updateMany>[0]["data"],
  hidden = false,
): Promise<boolean> {
  const updated = await prisma.receivable.updateMany({
    where: {
      id: loaded.row.id,
      updatedAt: loaded.row.updatedAt,
      deletedAt: hidden ? { not: null } : null,
    },
    data: { ...data, updatedById: loaded.user.id },
  });
  return updated.count > 0;
}

/** 대시보드 미수금은 기간 마지막 날 기준 잔액이라, 저장 후 안내에 덧붙인다 */
const DASHBOARD_NOTE = "대시보드 미수금에 반영됩니다.";

export async function createReceivable(
  raw: unknown,
): Promise<ReceivableActionResult> {
  const user = await getCurrentUser();
  if (!user || !canCreateReceivable(user)) {
    return forbidden("미수금 등록 권한이 없습니다. (열람만 가능)");
  }
  const parsed = createReceivableSchema.safeParse(raw);
  if (!parsed.success) return invalid(firstIssue(parsed.error));
  const input = parsed.data;

  const today = toDateOnly(await getTodayKst());
  const dateError = firstDateError(receivableDateErrors(input, today));
  if (dateError) return invalid(dateError);

  await prisma.receivable.create({
    data: {
      customerName: input.customerName,
      occurredOn: date(input.occurredOn),
      amount: input.amount,
      dueOn: input.dueOn ? date(input.dueOn) : null,
      note: input.note,
      createdById: user.id,
      updatedById: user.id,
    },
  });

  refresh(); // 메인·경영지원 대시보드 미수금 숫자가 새 값으로 다시 그려지도록
  return {
    ok: true,
    message: `${input.customerName} 미수금을 등록했습니다. ${DASHBOARD_NOTE}`,
  };
}

export async function updateReceivable(
  raw: unknown,
): Promise<ReceivableActionResult> {
  const parsed = updateReceivableSchema.safeParse(raw);
  if (!parsed.success) return invalid(firstIssue(parsed.error));
  const input = parsed.data;

  const loaded = await loadForAction(input.id, input.expectedUpdatedAt);
  if ("ok" in loaded) return loaded;
  const { row, abilities } = loaded;
  if (!abilities.canEdit) {
    return forbidden(abilities.notice ?? "이 건을 수정할 권한이 없습니다.");
  }

  // 수금 완료 건은 수금일도 함께 수정 (미수 건에 수금일이 오면 무시하지 않고 거부)
  if (!row.isCollected && input.collectedOn !== null) {
    return invalid("미수 건은 [수금 처리]로 수금일을 입력하세요.");
  }
  if (row.isCollected && input.collectedOn === null) {
    return invalid("수금일을 입력하세요.");
  }

  const today = toDateOnly(await getTodayKst());
  const dateError = firstDateError(
    receivableDateErrors(
      {
        occurredOn: input.occurredOn,
        dueOn: input.dueOn,
        ...(row.isCollected ? { collectedOn: input.collectedOn } : {}),
      },
      today,
    ),
  );
  if (dateError) return invalid(dateError);

  const saved = await updateIfUnchanged(loaded, {
    customerName: input.customerName,
    occurredOn: date(input.occurredOn),
    amount: input.amount,
    dueOn: input.dueOn ? date(input.dueOn) : null,
    note: input.note,
    ...(row.isCollected ? { collectedOn: date(input.collectedOn!) } : {}),
  });
  if (!saved) return conflict;

  refresh();
  return {
    ok: true,
    message: `${input.customerName} 미수금을 수정했습니다. ${DASHBOARD_NOTE}`,
  };
}

export async function collectReceivable(
  raw: unknown,
): Promise<ReceivableActionResult> {
  const parsed = collectReceivableSchema.safeParse(raw);
  if (!parsed.success) return invalid(firstIssue(parsed.error));
  const input = parsed.data;

  const loaded = await loadForAction(input.id, input.expectedUpdatedAt);
  if ("ok" in loaded) return loaded;
  const { row, abilities } = loaded;
  if (!abilities.canCollect) {
    return row.isCollected
      ? invalid("이미 수금 완료된 건입니다.")
      : forbidden(abilities.notice ?? "수금 처리 권한이 없습니다.");
  }

  const today = toDateOnly(await getTodayKst());
  const dateError = receivableDateErrors(
    { occurredOn: toDateOnly(row.occurredOn), collectedOn: input.collectedOn },
    today,
  ).collectedOn;
  if (dateError) return invalid(dateError);

  const saved = await updateIfUnchanged(loaded, {
    isCollected: true,
    collectedOn: date(input.collectedOn),
  });
  if (!saved) return conflict;

  refresh();
  return {
    ok: true,
    message: `${row.customerName} ${input.collectedOn} 수금 처리했습니다. ${DASHBOARD_NOTE}`,
  };
}

export async function uncollectReceivable(
  raw: unknown,
): Promise<ReceivableActionResult> {
  const parsed = rowActionSchema.safeParse(raw);
  if (!parsed.success) return invalid("요청 값을 확인하세요.");

  const loaded = await loadForAction(
    parsed.data.id,
    parsed.data.expectedUpdatedAt,
  );
  if ("ok" in loaded) return loaded;
  if (!loaded.abilities.canUncollect) {
    return forbidden("수금 취소는 팀장만 할 수 있습니다.");
  }

  const saved = await updateIfUnchanged(loaded, {
    isCollected: false,
    collectedOn: null,
  });
  if (!saved) return conflict;

  refresh();
  return {
    ok: true,
    message: `${loaded.row.customerName} 수금을 취소하고 미수로 되돌렸습니다.`,
  };
}

export async function hideReceivable(
  raw: unknown,
): Promise<ReceivableActionResult> {
  const parsed = rowActionSchema.safeParse(raw);
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
    message: `${loaded.row.customerName} 건을 숨겼습니다. 목록·대시보드·통계에서 제외됩니다.`,
  };
}

export async function restoreReceivable(
  raw: unknown,
): Promise<ReceivableActionResult> {
  const parsed = rowActionSchema.safeParse(raw);
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
  return {
    ok: true,
    message: `${loaded.row.customerName} 건을 복구했습니다. 대시보드에 다시 반영됩니다.`,
  };
}
