// 변경 이력 조회 (server-only) — 권한 조건은 rules.ts 의 historyWhere() 가 넣는다 (관리자 기록은 관리자(대표)만)
import "server-only";

import { prisma } from "@/shared/db/client";

import {
  actorText,
  formatKstDateTime,
  presentHistoryRow,
  type AuditLogRecord,
  type HistoryRow,
} from "./labels";
import {
  HISTORY_EXPORT_MAX,
  HISTORY_PAGE_SIZE,
  historyWhere,
  type HistoryAbilities,
  type HistoryFilter,
  type RowHistoryType,
} from "./rules";

const SELECT = {
  id: true,
  occurredAt: true,
  actorId: true,
  actorLoginId: true,
  screen: true,
  action: true,
  targetLabel: true,
  changes: true,
  meta: true,
} as const;

/** 사용자 id → 이름 (사용자 표에 없으면 null — 화면에는 그때 아이디만) */
async function loadNames(ids: Iterable<string>) {
  const unique = [...new Set(ids)];
  const users = unique.length
    ? await prisma.authUser.findMany({
        where: { id: { in: unique } },
        select: { id: true, name: true, loginId: true },
      })
    : [];
  const byId = new Map(users.map((u) => [u.id, u]));
  return (id: string) => byId.get(id) ?? null;
}

async function present(records: AuditLogRecord[]): Promise<HistoryRow[]> {
  const userOf = await loadNames(records.map((r) => r.actorId));
  return records.map((r) =>
    presentHistoryRow(r, (id) => userOf(id)?.name ?? null),
  );
}

export type HistoryPage = {
  rows: HistoryRow[];
  total: number;
  page: number;
  pageCount: number;
  /** 사람 고르기 목록 — 이 사용자가 볼 수 있는 기록을 남긴 사람만 */
  actors: { id: string; label: string }[];
};

export async function loadHistoryPage(
  filter: HistoryFilter,
  abilities: HistoryAbilities,
): Promise<HistoryPage> {
  const where = historyWhere(filter, abilities);
  const [total, records, actorRows] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      select: SELECT,
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      skip: (filter.page - 1) * HISTORY_PAGE_SIZE,
      take: HISTORY_PAGE_SIZE,
    }),
    prisma.auditLog.groupBy({
      by: ["actorId", "actorLoginId"],
      where: abilities.canSeeAdmin ? {} : { area: "management" },
    }),
  ]);
  const userOf = await loadNames([
    ...records.map((r) => r.actorId),
    ...actorRows.map((a) => a.actorId),
  ]);
  // 같은 사람이 아이디를 바꿨으면 지금 아이디(없으면 마지막으로 본 아이디) 하나로
  const actors = new Map<string, string>();
  for (const a of actorRows) {
    const user = userOf(a.actorId);
    actors.set(
      a.actorId,
      actorText(user?.name ?? null, user?.loginId ?? a.actorLoginId),
    );
  }
  return {
    rows: records.map((r) =>
      presentHistoryRow(r, (id) => userOf(id)?.name ?? null),
    ),
    total,
    page: filter.page,
    pageCount: Math.max(1, Math.ceil(total / HISTORY_PAGE_SIZE)),
    actors: [...actors]
      .map(([id, label]) => ({ id, label }))
      .sort((a, b) => a.label.localeCompare(b.label, "ko")),
  };
}

export class HistoryTooManyRowsError extends Error {
  constructor(readonly total: number) {
    super(
      `${total.toLocaleString("ko-KR")}건이라 한 번에 내려받을 수 없습니다. 기간을 줄여 ${HISTORY_EXPORT_MAX.toLocaleString("ko-KR")}건 이하로 다시 시도하세요.`,
    );
  }
}

/** 엑셀 내려받기 — 지금 필터 그대로, 쪽 나눔 없이 (최대 HISTORY_EXPORT_MAX 건) */
export async function loadHistoryForExport(
  filter: Omit<HistoryFilter, "page">,
  abilities: HistoryAbilities,
): Promise<HistoryRow[]> {
  const where = historyWhere(filter, abilities);
  const total = await prisma.auditLog.count({ where });
  if (total > HISTORY_EXPORT_MAX) throw new HistoryTooManyRowsError(total);
  const records = await prisma.auditLog.findMany({
    where,
    select: SELECT,
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
  });
  return present(records);
}

export type RowOrigin = {
  /** "엑셀 이관으로 생성 — 파일명, 이관한 사람, 날짜" */
  text: string;
};

export type RowHistory = {
  rows: HistoryRow[];
  /** 엑셀 이관으로 생긴 행이면 맨 아래(가장 오래된 기록) 한 줄 */
  origin: RowOrigin | null;
};

/** 행 [이력] — 채권·채무·미수금 한 행의 기록 (관리자 화면 기록은 섞이지 않게 area "management" 만) */
export async function loadRowHistory(
  type: RowHistoryType,
  id: string,
): Promise<RowHistory> {
  const records = await prisma.auditLog.findMany({
    where: { area: "management", targetType: type, targetId: id },
    select: SELECT,
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
  });
  const rows = await present(records);
  const origin = type === "LedgerEntry" ? await ledgerOrigin(id) : null;
  return { rows, origin };
}

async function ledgerOrigin(id: string): Promise<RowOrigin | null> {
  const entry = await prisma.ledgerEntry.findUnique({
    where: { id },
    select: { uploadId: true },
  });
  if (!entry?.uploadId) return null;
  const [upload, importLog] = await Promise.all([
    prisma.dataUpload.findUnique({
      where: { id: entry.uploadId },
      select: { fileNames: true, createdById: true, createdAt: true },
    }),
    // 변경 이력 PR ② 이후 이관은 요약 기록이 있다 (그때 아이디·시각) — 그 전 이관은 업로드 이력 값으로
    prisma.auditLog.findFirst({
      where: {
        area: "management",
        action: "IMPORT",
        targetType: "DataUpload",
        targetId: entry.uploadId,
      },
      select: { actorId: true, actorLoginId: true, occurredAt: true },
    }),
  ]);
  if (!upload) return null;
  const fileName = Array.isArray(upload.fileNames)
    ? upload.fileNames.map(String).join(", ")
    : "";
  const actorId = importLog?.actorId ?? upload.createdById;
  const user = (await loadNames([actorId]))(actorId);
  const actor = actorText(
    user?.name ?? null,
    importLog?.actorLoginId ?? user?.loginId ?? "알 수 없는 사용자",
  );
  const at = formatKstDateTime(importLog?.occurredAt ?? upload.createdAt);
  return {
    text: `엑셀 이관으로 생성 — ${[fileName, actor, at].filter(Boolean).join(", ")}`,
  };
}
