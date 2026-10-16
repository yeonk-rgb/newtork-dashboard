import { describe, expect, it } from "vitest";

import {
  draftKey,
  parseDraft,
  readDraft,
  removeDraft,
  writeDraft,
  type EntryDraft,
} from "./draft-storage";

function memoryStorage() {
  const map = new Map<string, string>();
  return {
    map,
    storage: {
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => void map.set(k, v),
      removeItem: (k: string) => void map.delete(k),
    },
  };
}

const throwing = () => {
  throw new Error("SecurityError: localStorage 차단");
};

const draft: EntryDraft = {
  v: 1,
  values: {
    productSales: "215306000",
    goodsSales: "",
    serviceSales: "0",
    goodsPurchase: "1",
    materialPurchase: "2",
    operatingExpense: "3",
  },
  other: { "cat-1": "1686000" },
  baseUpdatedAt: "2026-10-16T08:29:49.008Z",
  savedAt: "2026-10-16T09:00:00.000Z",
};

describe("draftKey", () => {
  it("사용자 id + 연·월이 키에 들어가 사용자끼리 섞이지 않는다", () => {
    expect(draftKey("dev-mgmt-leader", 2026, 9)).toBe(
      "newtork:entry-draft:v1:dev-mgmt-leader:2026-09",
    );
    expect(draftKey("dev-mgmt-member", 2026, 9)).not.toBe(
      draftKey("dev-mgmt-leader", 2026, 9),
    );
  });
});

describe("저장·읽기·삭제", () => {
  it("쓰고 읽고 지운다", () => {
    const { storage, map } = memoryStorage();
    const key = draftKey("u", 2026, 9);
    expect(writeDraft(() => storage, key, draft)).toBe(true);
    expect(readDraft(() => storage, key)).toEqual(draft);
    removeDraft(() => storage, key);
    expect(map.size).toBe(0);
  });

  it("저장소를 못 쓰는 환경에서도 예외 없이 동작", () => {
    expect(writeDraft(throwing, "k", draft)).toBe(false);
    expect(readDraft(throwing, "k")).toBeNull();
    expect(() => removeDraft(throwing, "k")).not.toThrow();
    expect(writeDraft(() => undefined, "k", draft)).toBe(false);
  });
});

describe("parseDraft", () => {
  it("손상되었거나 형식이 다르면 null", () => {
    expect(parseDraft(null)).toBeNull();
    expect(parseDraft("{깨진 json")).toBeNull();
    expect(parseDraft(JSON.stringify({ ...draft, v: 2 }))).toBeNull();
    expect(
      parseDraft(JSON.stringify({ ...draft, values: { productSales: "-5" } })),
    ).toBeNull();
    expect(
      parseDraft(JSON.stringify({ ...draft, other: { a: 3 } })),
    ).toBeNull();
  });
});
