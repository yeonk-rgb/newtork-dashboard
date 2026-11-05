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

export type ResolvedQuote = QuoteValues & { itemId: string };

/** 단가 행의 부품 찾기: 파트넘버로 찾고, 같은 파트넘버가 여럿이면 품목으로 고른다 */
function resolveItem(
  v: QuoteValues,
  byPart: Map<string, ExistingItem[]>,
): { ok: true; item: ExistingItem } | { ok: false; message: string } {
  const candidates = byPart.get(v.key) ?? [];
  if (candidates.length === 0) {
    return {
      ok: false,
      message: `${v.partNo}: 단가표에 없는 파트넘버입니다. 부품 단가표를 먼저 올리거나 [부품 추가]에서 등록하세요.`,
    };
  }
  if (v.name) {
    const k = itemKey(v.partNo, v.name);
    const hit = candidates.find((c) => c.key === k);
    if (hit) return { ok: true, item: hit };
    return {
      ok: false,
      message: `${v.partNo}: 품목 "${v.name}"이(가) 단가표와 다릅니다. 단가표 품목: ${candidates.map((c) => c.name).join(", ")}`,
    };
  }
  if (candidates.length > 1) {
    return {
      ok: false,
      message: `${v.partNo}: 같은 파트넘버 부품이 ${candidates.length}개입니다(${candidates.map((c) => c.name).join(", ")}). 품목 칸을 넣어 주세요.`,
    };
  }
  return { ok: true, item: candidates[0] };
}

export function classifyQuotes(
  rows: { row: number; values: QuoteValues }[],
  items: Map<string, ExistingItem>,
  existing: Map<string, ExistingQuote>,
): Judged<ResolvedQuote> {
  const out = empty<ResolvedQuote>();
  const byPart = new Map<string, ExistingItem[]>();
  for (const i of items.values()) {
    byPart.set(i.partKey, [...(byPart.get(i.partKey) ?? []), i]);
  }
  for (const r of rows) {
    const v = r.values;
    const found = resolveItem(v, byPart);
    if (!found.ok) {
      out.errors.push({ row: r.row, message: found.message });
      continue;
    }
    if (found.item.hidden) {
      out.errors.push({
        row: r.row,
        message: `${v.partNo}: 숨긴 부품입니다. 부품별 비교의 [숨긴 부품 보기]에서 복구한 뒤 올리세요.`,
      });
      continue;
    }
    const resolved = { row: r.row, values: { ...v, itemId: found.item.id } };
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
    if (diffs.length) out.changed.push({ ...resolved, id: e.id, diffs });
    else out.unchanged.push(resolved);
  }
  return out;
}
