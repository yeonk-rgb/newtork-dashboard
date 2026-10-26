// 월간 입력 임시 보관 (브라우저 localStorage) — 뒤로 가기 등으로 나가도 입력이 사라지지 않게.
// - 키에 사용자 id + 연·월 포함 (사용자 전환 시 섞이지 않게)
// - 저장소를 못 쓰는 환경(사생활 보호 모드·차단 등)에서는 조용히 아무것도 하지 않는다
import type { EntryField } from "./schemas";

export type EntryDraft = {
  v: 1;
  values: Record<EntryField, string>;
  other: Record<string, string>;
  /** 월말 통장 잔액 (선택 칸, 2026-10-26 추가 — 예전 보관값에는 없음) */
  cash?: string;
  /** 임시 보관할 때 화면이 불러왔던 서버 updatedAt (그 뒤 다른 저장이 있었는지 안내용) */
  baseUpdatedAt: string | null;
  /** 보관 시각 (ISO) */
  savedAt: string;
};

type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
/** window.localStorage 접근 자체가 예외를 던지는 브라우저가 있어 함수로 받는다 */
export type GetStorage = () => StorageLike | undefined;

export function draftKey(userId: string, year: number, month: number): string {
  return `newtork:entry-draft:v1:${userId}:${year}-${String(month).padStart(2, "0")}`;
}

const DIGITS = /^\d{0,15}$/;
const isDigitsRecord = (value: unknown): value is Record<string, string> =>
  typeof value === "object" &&
  value !== null &&
  Object.values(value).every((v) => typeof v === "string" && DIGITS.test(v));

/** 저장된 문자열 검증 — 형식이 다르거나 손상되면 null */
export function parseDraft(raw: string | null): EntryDraft | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<EntryDraft>;
    if (
      data.v !== 1 ||
      !isDigitsRecord(data.values) ||
      !isDigitsRecord(data.other) ||
      !(
        data.cash === undefined ||
        (typeof data.cash === "string" && DIGITS.test(data.cash))
      ) ||
      typeof data.savedAt !== "string" ||
      !(data.baseUpdatedAt === null || typeof data.baseUpdatedAt === "string")
    ) {
      return null;
    }
    return data as EntryDraft;
  } catch {
    return null;
  }
}

/** 보관된 원문 문자열 (useSyncExternalStore 용 — 문자열이라 값이 같으면 같은 스냅샷) */
export function readRawDraft(
  getStorage: GetStorage,
  key: string,
): string | null {
  try {
    return getStorage()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

/** 다른 탭에서 바뀐 경우 알림 (같은 탭의 변경은 렌더 때 다시 읽는다) */
export function subscribeStorage(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

export function readDraft(
  getStorage: GetStorage,
  key: string,
): EntryDraft | null {
  try {
    return parseDraft(getStorage()?.getItem(key) ?? null);
  } catch {
    return null;
  }
}

export function writeDraft(
  getStorage: GetStorage,
  key: string,
  draft: EntryDraft,
): boolean {
  try {
    const storage = getStorage();
    if (!storage) return false;
    storage.setItem(key, JSON.stringify(draft));
    return true;
  } catch {
    return false;
  }
}

export function removeDraft(getStorage: GetStorage, key: string): void {
  try {
    getStorage()?.removeItem(key);
  } catch {
    // 저장소를 못 쓰면 지울 것도 없다
  }
}

export const browserStorage: GetStorage = () =>
  typeof window === "undefined" ? undefined : window.localStorage;
