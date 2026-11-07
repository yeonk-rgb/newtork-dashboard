// 업로드 판정 (순수 함수) — 새로 / 바뀜(덮어씀) / 같음 / 숨긴 행과 같음(저장 안 함) / 오류
// 담당자 피드백(2026-11-05): 추가 업로드 시 같은 내용은 덮어쓴다 → 바뀐 행은 체크 없이 모두 덮어씀
// 같은 부품 = 파트넘버 + 품목 (친구 UNIQUE(part_no, name)), 같은 단가 = 부품 + 출장지 + 적용 시작일
import { itemKey } from "./compute";
import type { ItemValues, QuoteValues, RowError } from "./parse-upload";

export type FieldDiff = { label: string; before: string; after: string };

export type ExistingItem = {
  id: string;
  /** 파트넘버 + 품목 */
  key: string;
  partKey: string;
  partNo: string;
  category: string;
  name: string;
  appliesTo: string;
  basePrice: number | null;
  hidden: boolean;
};

export type ExistingQuote = {
  id: string;
  /** quoteKey(itemId, company, date) */
  key: string;
  unitPrice: number;
  note: string;
  quoteNo: string;
  hidden: boolean;
};

export type Judged<T> = {
  created: { row: number; values: T }[];
  changed: { row: number; values: T; id: string; diffs: FieldDiff[] }[];
  unchanged: { row: number; values: T }[];
  hidden: { row: number; values: T }[];
  errors: RowError[];
};

const empty = <T>(): Judged<T> => ({
  created: [],
  changed: [],
  unchanged: [],
  hidden: [],
  errors: [],
});

const wonText = (v: number | null) =>
  v === null ? "(없음)" : `${v.toLocaleString("ko-KR")}원`;
const plain = (v: string) => (v === "" ? "(없음)" : v);

const ITEM_FIELDS = [
  { key: "partNo", label: "파트넘버", show: plain },
  { key: "category", label: "분류", show: plain },
  { key: "name", label: "품목", show: plain },
  { key: "appliesTo", label: "적용 모델", show: plain },
  { key: "basePrice", label: "뉴토크 기준값", show: wonText },
] as const;

export function classifyItems(
  rows: { row: number; values: ItemValues }[],
  existing: Map<string, ExistingItem>,
): Judged<ItemValues> {
  const out = empty<ItemValues>();
  for (const r of rows) {
    const e = existing.get(r.values.key);
    if (!e) {
      out.created.push(r);
      continue;
    }
    if (e.hidden) {
      out.hidden.push(r);
      continue;
    }
    const diffs = ITEM_FIELDS.filter((f) => e[f.key] !== r.values[f.key]).map(
      (f) => ({
        label: f.label,
        before: (f.show as (v: unknown) => string)(e[f.key]),
        after: (f.show as (v: unknown) => string)(r.values[f.key]),
      }),
    );
    if (diffs.length) out.changed.push({ ...r, id: e.id, diffs });
    else out.unchanged.push(r);
  }
  return out;
}

export const quoteKey = (itemId: string, company: string, date: string) =>
  `${itemId}|${company}|${date}`;

/** itemId = null → 단가표에 없는 파트넘버라 저장할 때 새로 등록 (newPartKey 로 묶음) */
export type ResolvedQuote = QuoteValues & {
  itemId: string | null;
  newPart: boolean;
};

/**
 * 단가 행의 부품 찾기 (친구 우민영 저장소 catalogIndex 그대로):
 * 그 파트넘버 부품이 1개면 그 부품(품목 표기가 달라도), 여럿이면 품목으로 고르고, 없으면 품목이 있을 때 새로 등록
 */
function resolveItem(
  v: QuoteValues,
  byPart: Map<string, ExistingItem[]>,
): { ok: true; item: ExistingItem | null } | { ok: false; message: string } {
  const candidates = byPart.get(v.key) ?? [];
  if (candidates.length === 1) return { ok: true, item: candidates[0] };
  if (candidates.length > 1) {
    const hit = v.name
      ? candidates.find((c) => c.key === itemKey(v.partNo, v.name))
      : undefined;
    if (hit) return { ok: true, item: hit };
    return {
      ok: false,
      message: `${v.partNo}: 이 파트넘버의 부품이 ${candidates.length}개입니다(${candidates.map((c) => c.name).join(", ")}). 품목 칸에 정확한 품목을 적어 주세요.`,
    };
  }
  if (v.name) return { ok: true, item: null };
  return {
    ok: false,
    message: `${v.partNo}: 단가표에 없는 파트넘버입니다. 품목 칸을 적으면 새 부품으로 함께 등록합니다.`,
  };
}

export function classifyQuotes(
  rows: { row: number; values: QuoteValues }[],
  items: Map<string, ExistingItem>,
  existing: Map<string, ExistingQuote>,
): Judged<ResolvedQuote> & { newParts: number; superseded: number } {
  const out = empty<ResolvedQuote>();
  const byPart = new Map<string, ExistingItem[]>();
  for (const i of items.values()) {
    byPart.set(i.partKey, [...(byPart.get(i.partKey) ?? []), i]);
  }
  const newParts = new Set<string>();
  // 품목 표기가 달라도 같은 부품으로 찾아지면 같은 단가 → 부품·출장지·적용 시작일이 같으면 아래 줄 기준
  const resolvedAll = rows.map((r) => resolveItem(r.values, byPart));
  const target = (i: number) => {
    const f = resolvedAll[i];
    const v = rows[i].values;
    return f.ok
      ? quoteKey(f.item?.id ?? `new:${v.key}`, v.company, v.effectiveDate)
      : `err:${i}`;
  };
  const lastOf = new Map<string, number>();
  rows.forEach((_, i) => lastOf.set(target(i), i));
  let superseded = 0;
  for (const [index, r] of rows.entries()) {
    const v = r.values;
    if (lastOf.get(target(index)) !== index) {
      superseded += 1;
      continue;
    }
    const found = resolvedAll[index];
    if (!found.ok) {
      out.errors.push({ row: r.row, message: found.message });
      continue;
    }
    if (!found.item) {
      // 단가표에 없음 → 저장할 때 같은 파트넘버끼리 1개만 새로 등록 (첫 줄의 품목·적용 모델)
      newParts.add(v.key);
      out.created.push({
        row: r.row,
        values: { ...v, itemId: null, newPart: true },
      });
      continue;
    }
    if (found.item.hidden) {
      out.errors.push({
        row: r.row,
        message: `${v.partNo}: 숨긴 부품입니다. 부품별 비교의 [숨긴 부품 보기]에서 복구한 뒤 올리세요.`,
      });
      continue;
    }
    const resolved = {
      row: r.row,
      values: { ...v, itemId: found.item.id, newPart: false },
    };
    const e = existing.get(quoteKey(found.item.id, v.company, v.effectiveDate));
    if (!e) {
      out.created.push(resolved);
      continue;
    }
    if (e.hidden) {
      out.hidden.push(resolved);
      continue;
    }
    const diffs: FieldDiff[] = [];
    if (e.unitPrice !== v.unitPrice) {
      diffs.push({
        label: "단가",
        before: wonText(e.unitPrice),
        after: wonText(v.unitPrice),
      });
    }
    if (e.note !== v.note) {
      diffs.push({
        label: "비고",
        before: plain(e.note),
        after: plain(v.note),
      });
    }
    if (e.quoteNo !== v.quoteNo && v.format === "order") {
      diffs.push({
        label: "판매번호",
        before: plain(e.quoteNo),
        after: plain(v.quoteNo),
      });
    }
    if (diffs.length) out.changed.push({ ...resolved, id: e.id, diffs });
    else out.unchanged.push(resolved);
  }
  return { ...out, newParts: newParts.size, superseded };
}
