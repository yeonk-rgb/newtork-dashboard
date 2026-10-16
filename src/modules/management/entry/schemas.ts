// 월간 입력 저장 요청 검증 (Zod) — 클라이언트 값은 믿지 않고 서버에서 다시 검증한다
import { z } from "zod";

import { MAX_DIGITS } from "./money-input";

/** 숫자 문자열(콤마 없음, 0~15자리) → bigint. 빈칸은 0원 */
const amount = z
  .string()
  .regex(
    new RegExp(`^\\d{0,${MAX_DIGITS}}$`),
    "금액은 숫자만 15자리까지 입력할 수 있습니다.",
  )
  .transform((v) => (v === "" ? 0n : BigInt(v)));

export const ENTRY_FIELDS = [
  "productSales",
  "goodsSales",
  "serviceSales",
  "goodsPurchase",
  "materialPurchase",
  "operatingExpense",
] as const;
export type EntryField = (typeof ENTRY_FIELDS)[number];

const yearMonth = {
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
};

/** 불러올 때의 updatedAt (새 달이면 null) — 동시 수정 확인용 */
const expectedUpdatedAt = z.iso.datetime().nullable();

export const saveEntrySchema = z.object({
  ...yearMonth,
  /** draft: 임시저장 / confirm: 확정 / update-confirmed: 확정된 달 수정(확정 유지) */
  intent: z.enum(["draft", "confirm", "update-confirmed"]),
  values: z.object({
    productSales: amount,
    goodsSales: amount,
    serviceSales: amount,
    goodsPurchase: amount,
    materialPurchase: amount,
    operatingExpense: amount,
  }),
  otherExpenses: z
    .array(z.object({ categoryId: z.string().min(1).max(64), amount }))
    .max(100),
  expectedUpdatedAt,
});
export type SaveEntryInput = z.input<typeof saveEntrySchema>;

export const unconfirmSchema = z.object({
  ...yearMonth,
  expectedUpdatedAt: z.iso.datetime(),
});
export type UnconfirmInput = z.input<typeof unconfirmSchema>;
