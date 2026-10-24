import { describe, expect, it } from "vitest";

import {
  buildImportPlan,
  EMPTY_CHOICES,
  isTodoDone,
  previewTodo,
  toPreview,
  type ImportChoices,
} from "./plan";
import { OPTS, parseFixture } from "./test-helpers";

const NONE = { AR: 0, AP: 0, ACCRUED_STAFF: 0, ACCRUED_VENDOR: 0 };
const ALL_GOODS: ImportChoices["purchaseType"] = {
  41: "GOODS",
  42: "RAW_MATERIAL",
  43: "GOODS",
};
const plan = (
  parsed: Awaited<ReturnType<typeof parseFixture>>,
  choices: Partial<ImportChoices> = {},
  extra: { mode?: "overwrite" | "append" | null; existingTotal?: number } = {},
) =>
  buildImportPlan(
    parsed,
    { ...EMPTY_CHOICES, ...choices },
    {
      ...OPTS,
      mode: extra.mode ?? null,
      existingTotal: extra.existingTotal ?? 0,
    },
  );

describe("buildImportPlan", () => {
  it("빈 양식: '가져올 데이터 없음'만 (오류 아님)", async () => {
    const p = plan(await parseFixture("ledger-template.xlsx"));
    expect(p.blockers).toEqual([expect.objectContaining({ type: "empty" })]);
    expect(p.entries).toEqual([]);
  });

  it("매입유형을 안 고르면 막고, 고르면 16행 저장 계획", async () => {
    const parsed = await parseFixture("ledger-sample.xlsx");
    expect(plan(parsed).blockers.map((b) => [b.type, b.row])).toEqual([
      ["choice", 41],
      ["choice", 42],
      ["choice", 43],
    ]);
    const ok = plan(parsed, { purchaseType: ALL_GOODS });
    expect(ok.blockers).toEqual([]);
    expect(ok.entries).toHaveLength(16);
    expect(ok.summary.AR).toEqual({ count: 8, sum: 39_340_000n });
    expect(ok.summary.ACCRUED_VENDOR).toEqual({ count: 3, sum: 2_745_000n });
  });

  it("저장값: 코드 0 유지, 완료일(적요 날짜·기본값), 업체 비용유형 기본 '기타'·자동이체", async () => {
    const parsed = await parseFixture("ledger-sample.xlsx");
    const { entries } = plan(parsed, {
      purchaseType: ALL_GOODS,
      expenseType: { 67: "ADVERTISING" },
    });
    const at = (row: number) => entries.find((e) => e.row === row)?.fields;
    expect(at(6)).toMatchObject({ partnerCode: "0000000118" });
    expect(at(8)).toMatchObject({ settledOn: "2026-10-15", note: "10/15" });
    expect(at(5)).toMatchObject({ settledOn: "2026-10-25" });
    expect(at(25)).toMatchObject({ arStatus: "SCHEDULED", settledOn: null });
    expect(at(66)).toMatchObject({ expenseType: "OTHER", autoTransfer: true });
    expect(at(67)).toMatchObject({
      expenseType: "ADVERTISING",
      autoTransfer: false,
    });
    expect(at(42)).toMatchObject({ purchaseType: "RAW_MATERIAL" });
  });

  it("9월로 가져오면 적요 10/15 는 쓰지 않고 9월 말일, 적요 원문은 그대로 저장", async () => {
    const parsed = await parseFixture("ledger-sample.xlsx", {
      ...OPTS,
      month: 9,
    });
    const { entries } = buildImportPlan(
      parsed,
      { ...EMPTY_CHOICES, purchaseType: ALL_GOODS },
      { ...OPTS, month: 9, mode: null, existingTotal: 0 },
    );
    expect(entries.find((e) => e.row === 8)?.fields).toMatchObject({
      arStatus: "COLLECTED",
      settledOn: "2026-09-30",
      note: "10/15",
    });
  });

  it("완료일을 직접 고치면 그 값, 오늘 이후면 막음", async () => {
    const parsed = await parseFixture("ledger-sample.xlsx");
    const base = { purchaseType: ALL_GOODS };
    expect(
      plan(parsed, { ...base, settledOn: { 5: "2026-10-03" } }).entries.find(
        (e) => e.row === 5,
      )?.fields,
    ).toMatchObject({ settledOn: "2026-10-03" });
    const future = plan(parsed, { ...base, settledOn: { 5: "2026-10-26" } });
    expect(future.blockers[0].message).toContain("오늘 이후");
  });

  it("미분류는 상태를 골라야 가져오기 가능 — 당월수금완료를 고르면 완료일 기본값", async () => {
    const parsed = await parseFixture("ledger-sample-issues.xlsx");
    const before = plan(parsed, { purchaseType: ALL_GOODS });
    expect(
      before.blockers
        .filter((b) => b.message.includes("미분류"))
        .map((b) => b.row),
    ).toEqual([25, 26, 28]);

    const after = plan(parsed, {
      purchaseType: ALL_GOODS,
      arStatus: { 25: "SCHEDULED", 26: "COLLECTED", 28: "LONG_OVERDUE" },
    });
    expect(after.blockers).toEqual([]);
    // 26행 적요 날짜(10/20)는 수금완료 그룹이 아니었으므로 완료일 후보로 쓰지 않음
    expect(after.entries.find((e) => e.row === 26)?.fields).toMatchObject({
      arStatus: "COLLECTED",
      settledOn: "2026-10-25",
      note: "10/20",
    });
  });

  it("같은 달 데이터가 있으면 덮어쓰기·추가를 골라야 함", async () => {
    const parsed = await parseFixture("ledger-sample.xlsx");
    const choices = { purchaseType: ALL_GOODS };
    expect(
      plan(parsed, choices, { existingTotal: 6 }).blockers.map(
        (b) => b.message,
      ),
    ).toEqual([
      "2026년 10월에 이미 6행이 있습니다. 덮어쓰기·추가 중에 고르세요.",
    ]);
    expect(
      plan(parsed, choices, { existingTotal: 6, mode: "overwrite" }).blockers,
    ).toEqual([]);
  });

  it("행 오류가 하나라도 있으면 그 행은 저장 계획에서 빠지고 막음", async () => {
    const parsed = await parseFixture("ledger-sample.xlsx");
    parsed.blocks[2].rows[0] = {
      ...parsed.blocks[2].rows[0],
      amount: null,
      errors: ["음수 잔액입니다 (선수금·과입금인지 확인하세요)."],
    };
    const p = plan(parsed, { purchaseType: ALL_GOODS });
    expect(p.blockers).toEqual([
      expect.objectContaining({ type: "error", row: 53 }),
    ]);
    expect(p.entries.find((e) => e.row === 53)).toBeUndefined();
  });
});

describe("toPreview·previewTodo", () => {
  it("금액은 문자열, 업체 자동이체 합계, 남은 할 일", async () => {
    const parsed = await parseFixture("ledger-sample-issues.xlsx");
    const preview = toPreview(parsed, {
      fileName: "a.xlsx",
      fileSha256: "x",
      year: 2026,
      month: 10,
      today: "2026-10-25",
      existing: { ...NONE, AR: 2 },
    });
    const vendor = preview.blocks.find((b) => b.kind === "ACCRUED_VENDOR")!;
    expect([vendor.sum, vendor.autoTransferSum]).toEqual(["2745000", "165000"]);
    expect(preview.existingTotal).toBe(2);
    expect(preview.defaultSettledOn).toBe("2026-10-25");

    const todo = previewTodo(preview, EMPTY_CHOICES, null);
    expect(todo).toEqual({
      errors: 0,
      unclassified: 3,
      missingPurchaseType: 3,
      needsMode: true,
      empty: false,
    });
    expect(isTodoDone(todo)).toBe(false);
    expect(
      isTodoDone(
        previewTodo(
          preview,
          {
            ...EMPTY_CHOICES,
            purchaseType: ALL_GOODS,
            arStatus: { 25: "SCHEDULED", 26: "SCHEDULED", 28: "SCHEDULED" },
          },
          "append",
        ),
      ),
    ).toBe(true);
  });

  it("빈 양식은 empty", async () => {
    const parsed = await parseFixture("ledger-template.xlsx");
    const preview = toPreview(parsed, {
      fileName: "t.xlsx",
      fileSha256: "x",
      year: 2026,
      month: 10,
      today: "2026-10-25",
      existing: NONE,
    });
    expect(previewTodo(preview, EMPTY_CHOICES, null).empty).toBe(true);
  });
});
