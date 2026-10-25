// 변경 이력 권한·필터 (순수 함수 — 화면·조회·엑셀 내려받기·행 이력 공용)
// 관리자 화면 기록(area "admin")은 관리자(대표)만: 화면에서 숨기는 게 아니라 조회 조건(historyWhere)에서 뺀다
import type { Prisma } from "@/shared/db/generated/client";
import { can, canManageUsers } from "@/shared/auth/can";
import type { AppUser } from "@/shared/auth/types";
import { AUDIT_ACTIONS } from "@/shared/audit/types";

import { HISTORY_SCREENS } from "./labels";

export type HistoryAbilities = {
  /** 목록·행 이력 (관리자(대표) + 경영지원팀 = 경영지원 열람) */
  canView: boolean;
  /** area "admin" 기록 (관리자(대표)만) */
  canSeeAdmin: boolean;
  /** 엑셀 내려받기 (관리자(대표)만) */
  canExport: boolean;
};

export function historyAbilities(user: AppUser): HistoryAbilities {
  const canView = can(user, "view", "management");
  const admin = canView && canManageUsers(user);
  return { canView, canSeeAdmin: admin, canExport: admin };
}

export const HISTORY_PAGE_SIZE = 50;
/** 기본 기간: 오늘 포함 최근 30일 */
export const HISTORY_DEFAULT_DAYS = 30;
/** 엑셀 한 번에 내려받는 최대 건수 (넘으면 기간을 줄여 달라고 안내) */
export const HISTORY_EXPORT_MAX = 10_000;

export type HistoryFilter = {
  /** 한국 날짜 "YYYY-MM-DD" (양 끝 포함) */
  from: string;
  to: string;
  actorId: string | null;
  screen: string | null;
  action: string | null;
  q: string | null;
  page: number;
};

type Params = Record<string, string | string[] | undefined>;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
const KST_MS = 9 * 60 * 60 * 1000;

const dateOnly = (d: Date) => d.toISOString().slice(0, 10);

function validDate(v: string | null): string | null {
  if (!v || !DATE.test(v)) return null;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && dateOnly(d) === v ? v : null;
}

const one = (p: Params, k: string) => {
  const v = p[k];
  const s = (Array.isArray(v) ? v[0] : v)?.trim();
  return s ? s : null;
};

/**
 * 주소 값 → 필터. 틀린 값은 버리고 기본값 (기간 = 오늘 포함 최근 30일, 1쪽)
 * @param today getTodayKst() — 한국 날짜의 UTC 자정
 */
export function parseHistoryFilter(params: Params, today: Date): HistoryFilter {
  let to = validDate(one(params, "to")) ?? dateOnly(today);
  let from =
    validDate(one(params, "from")) ??
    dateOnly(new Date(today.getTime() - (HISTORY_DEFAULT_DAYS - 1) * DAY_MS));
  if (from > to) [from, to] = [to, from];
  const screen = one(params, "screen");
  const action = one(params, "action");
  const page = Number(one(params, "page"));
  return {
    from,
    to,
    actorId: one(params, "actor"),
    screen: HISTORY_SCREENS.some((s) => s.key === screen) ? screen : null,
    action: (AUDIT_ACTIONS as readonly string[]).includes(action ?? "")
      ? action
      : null,
    q: one(params, "q")?.slice(0, 100) ?? null,
    page: Number.isInteger(page) && page > 0 ? page : 1,
  };
}

/** 한국 날짜 하루의 시작 시각 (UTC) */
function kstStart(date: string): Date {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() - KST_MS);
}

/** 조회 조건 — 관리자(대표)가 아니면 어떤 필터를 넣어도 area "management" 만 */
export function historyWhere(
  filter: Omit<HistoryFilter, "page">,
  abilities: HistoryAbilities,
): Prisma.AuditLogWhereInput {
  return {
    occurredAt: {
      gte: kstStart(filter.from),
      lt: new Date(kstStart(filter.to).getTime() + DAY_MS),
    },
    ...(filter.actorId ? { actorId: filter.actorId } : {}),
    ...(filter.screen ? { screen: filter.screen } : {}),
    ...(filter.action ? { action: filter.action } : {}),
    ...(filter.q
      ? { targetLabel: { contains: filter.q, mode: "insensitive" as const } }
      : {}),
    ...(abilities.canSeeAdmin ? {} : { area: "management" }),
  };
}

/** 필터 → 주소 (쪽 이동·엑셀 내려받기가 같은 조건을 쓰게) */
export function historySearch(
  filter: Omit<HistoryFilter, "page"> & { page?: number },
): string {
  const p = new URLSearchParams({ from: filter.from, to: filter.to });
  if (filter.actorId) p.set("actor", filter.actorId);
  if (filter.screen) p.set("screen", filter.screen);
  if (filter.action) p.set("action", filter.action);
  if (filter.q) p.set("q", filter.q);
  if (filter.page && filter.page > 1) p.set("page", String(filter.page));
  return p.toString();
}

/** 화면 고르기 목록 — 관리자(대표)가 아니면 관리자 화면은 목록에도 없다 */
export function screenOptions(abilities: HistoryAbilities) {
  return HISTORY_SCREENS.filter(
    (s) => abilities.canSeeAdmin || s.area === "management",
  );
}

/** 내려받기 파일 이름 — 변경이력_2026-10-01_2026-10-31.xlsx */
export function historyFileName(filter: { from: string; to: string }) {
  return `변경이력_${filter.from}_${filter.to}.xlsx`;
}

/** 행 [이력]을 볼 수 있는 대상 종류 */
export const ROW_HISTORY_TYPES = ["LedgerEntry", "Receivable"] as const;
export type RowHistoryType = (typeof ROW_HISTORY_TYPES)[number];
