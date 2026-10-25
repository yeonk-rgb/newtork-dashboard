// 월간 입력 다운로드 테스트·비교 스크립트용 가짜 데이터 (실제 재무 데이터 아님)
// 2026년 3분기: 7월 확정, 8월 확정(경비 33,648,000), 9월 임시저장. 비활성 항목 "협회비"는 7월에만 금액
import type { EntryField } from "../schemas";
import type { EntryCategoryInfo, EntryMonthData } from "./plan";

export const SAMPLE_CATEGORIES: EntryCategoryInfo[] = [
  { id: "c-ad", name: "광고선전비", isActive: true, sortOrder: 1 },
  { id: "c-ent", name: "접대비", isActive: true, sortOrder: 2 },
  { id: "c-car", name: "차량유지비", isActive: true, sortOrder: 3 },
  { id: "c-wel", name: "복리후생비", isActive: true, sortOrder: 4 },
  { id: "c-fee", name: "지급수수료", isActive: true, sortOrder: 5 },
  { id: "c-old", name: "협회비", isActive: false, sortOrder: 6 },
];

const values = (v: Partial<Record<EntryField, bigint>>) => ({
  productSales: 0n,
  goodsSales: 0n,
  serviceSales: 0n,
  goodsPurchase: 0n,
  materialPurchase: 0n,
  operatingExpense: 0n,
  ...v,
});

export const SAMPLE_MONTHS: EntryMonthData[] = [
  {
    year: 2026,
    month: 7,
    status: "CONFIRMED",
    confirmedAt: new Date("2026-08-03T01:30:00Z"),
    values: values({
      productSales: 182_400_000n,
      goodsSales: 31_250_000n,
      serviceSales: 12_800_000n,
      goodsPurchase: 24_600_000n,
      materialPurchase: 61_300_000n,
      operatingExpense: 32_910_000n,
    }),
    others: new Map([
      ["c-ad", 2_400_000n],
      ["c-ent", 1_850_000n],
      ["c-car", 920_000n],
      ["c-wel", 1_300_000n],
      ["c-fee", 0n],
      ["c-old", 500_000n],
    ]),
  },
  {
    year: 2026,
    month: 8,
    status: "CONFIRMED",
    // 8/31 15:10 (UTC) = 한국 9/1 00:10 — 확정일은 한국 날짜로 표시
    confirmedAt: new Date("2026-08-31T15:10:00Z"),
    values: values({
      productSales: 168_900_000n,
      goodsSales: 28_400_000n,
      serviceSales: 9_600_000n,
      goodsPurchase: 21_900_000n,
      materialPurchase: 58_750_000n,
      operatingExpense: 33_648_000n,
    }),
    others: new Map([
      ["c-ad", 2_100_000n],
      ["c-ent", 1_420_000n],
      ["c-car", 880_000n],
      ["c-wel", 1_300_000n],
      ["c-fee", 260_000n],
      ["c-old", 0n],
    ]),
  },
  {
    year: 2026,
    month: 9,
    status: "DRAFT",
    confirmedAt: null,
    values: values({
      productSales: 120_000_000n,
      goodsSales: 20_000_000n,
      goodsPurchase: 15_000_000n,
      operatingExpense: 30_000_000n,
    }),
    others: new Map([["c-ad", 1_000_000n]]),
  },
];
