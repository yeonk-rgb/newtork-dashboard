// 경영지원 관리 저장 요청 검증 (Zod) — 클라이언트 값은 믿지 않고 서버에서 다시 검증한다
// 구분(kind)마다 쓰는 칸이 달라 discriminated union 으로 나눈다. 오늘 날짜 규칙은 rules.ts 의 ledgerDateErrors
import { z } from "zod";

import { MAX_DIGITS } from "../entry/money-input";
import { AR_STATUSES, EXPENSE_TYPES, PURCHASE_TYPES } from "./labels";
import {
  isPartnerCode,
  normalizePartnerName,
  NOTE_MAX,
  parseDateOnly,
  PARTNER_NAME_MAX,
} from "./rules";

const optionalDate = z
  .string()
  .nullable()
  .transform((v) => (v === "" ? null : v))
  .refine(
    (v) => v === null || parseDateOnly(v) !== null,
    "날짜 형식이 올바르지 않습니다.",
  );

const amount = z
  .string()
  .regex(
    new RegExp(`^\\d{1,${MAX_DIGITS}}$`),
    "잔액은 숫자만 15자리까지 입력할 수 있습니다.",
  )
  // 형식이 틀린 값도 refine 이 실행되므로 BigInt 변환 전에 숫자인지 먼저 확인
  .refine((v) => /^\d+$/.test(v) && BigInt(v) > 0n, "잔액을 입력하세요.")
  .transform((v) => BigInt(v));

const common = {
  partnerName: z
    .string()
    .transform(normalizePartnerName)
    .pipe(
      z
        .string()
        .min(1, "거래처명을 입력하세요.")
        .max(
          PARTNER_NAME_MAX,
          `거래처명은 ${PARTNER_NAME_MAX}자까지 입력할 수 있습니다.`,
        ),
    ),
  amount,
  note: z
    .string()
    .transform((v) => v.trim())
    .pipe(
      z.string().max(NOTE_MAX, `적요는 ${NOTE_MAX}자까지 입력할 수 있습니다.`),
    )
    .transform((v) => (v === "" ? null : v)),
  dueOn: optionalDate,
  settledOn: optionalDate,
};

/** 거래처코드: 빈칸 = null, 입력하면 숫자 10자리 (문자열 그대로 — 앞자리 0 유지) */
const partnerCode = z
  .string()
  .transform((v) => v.trim())
  .refine(
    (v) => v === "" || isPartnerCode(v),
    "거래처코드는 숫자 10자리로 입력하세요. (예: 0000000087)",
  )
  .transform((v) => (v === "" ? null : v));

const choice = <T extends readonly [string, ...string[]]>(
  values: T,
  message: string,
) => z.enum(values, { error: message });

export const ledgerFieldsSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("AR"),
    arStatus: choice(AR_STATUSES, "상태를 고르세요."),
    partnerCode,
    ...common,
  }),
  z.object({
    kind: z.literal("AP"),
    purchaseType: choice(PURCHASE_TYPES, "매입유형을 고르세요."),
    ...common,
  }),
  z.object({ kind: z.literal("ACCRUED_STAFF"), ...common }),
  z.object({
    kind: z.literal("ACCRUED_VENDOR"),
    expenseType: choice(EXPENSE_TYPES, "비용유형을 고르세요."),
    autoTransfer: z.boolean(),
    ...common,
  }),
]);
export type LedgerFields = z.output<typeof ledgerFieldsSchema>;

/** 구분에 맞지 않는 칸은 null(자동이체는 false)로 채운 DB 저장값 */
export function toLedgerData(fields: LedgerFields) {
  return {
    kind: fields.kind,
    arStatus: fields.kind === "AR" ? fields.arStatus : null,
    partnerCode: fields.kind === "AR" ? fields.partnerCode : null,
    purchaseType: fields.kind === "AP" ? fields.purchaseType : null,
    expenseType: fields.kind === "ACCRUED_VENDOR" ? fields.expenseType : null,
    autoTransfer:
      fields.kind === "ACCRUED_VENDOR" ? fields.autoTransfer : false,
    partnerName: fields.partnerName,
    amount: fields.amount,
    note: fields.note,
    dueOn: fields.dueOn,
    settledOn: fields.settledOn,
  };
}

const id = z.string().min(1).max(64);
/** 불러올 때의 updatedAt — 동시 수정 확인용 */
const expectedUpdatedAt = z.iso.datetime();

export const createLedgerSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
  fields: ledgerFieldsSchema,
});
export type CreateLedgerInput = z.input<typeof createLedgerSchema>;

/** 구분(kind)은 바꿀 수 없다 — 서버가 저장된 행의 구분과 같은지 확인 */
export const updateLedgerSchema = z.object({
  id,
  expectedUpdatedAt,
  fields: ledgerFieldsSchema,
});
export type UpdateLedgerInput = z.input<typeof updateLedgerSchema>;

/** 숨김·복구 */
export const ledgerRowActionSchema = z.object({ id, expectedUpdatedAt });
