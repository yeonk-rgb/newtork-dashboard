// 미수금 저장 요청 검증 (Zod) — 클라이언트 값은 믿지 않고 서버에서 다시 검증한다
// 오늘 날짜에 따른 규칙(미래 날짜 등)은 rules.ts 의 receivableDateErrors 로 따로 확인
import { z } from "zod";

import { MAX_DIGITS } from "../entry/money-input";
import {
  CUSTOMER_MAX,
  normalizeCustomerName,
  NOTE_MAX,
  parseDateOnly,
} from "./rules";

const dateOnly = z
  .string()
  .refine((v) => parseDateOnly(v) !== null, "날짜 형식이 올바르지 않습니다.");

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
    "금액은 숫자만 15자리까지 입력할 수 있습니다.",
  )
  // 형식이 틀린 값도 refine 이 실행되므로 BigInt 변환 전에 숫자인지 먼저 확인
  .refine((v) => /^\d+$/.test(v) && BigInt(v) > 0n, "금액을 입력하세요.")
  .transform((v) => BigInt(v));

const id = z.string().min(1).max(64);
/** 불러올 때의 updatedAt — 동시 수정 확인용 */
const expectedUpdatedAt = z.iso.datetime();

export const receivableFieldsSchema = z.object({
  customerName: z
    .string()
    .transform(normalizeCustomerName)
    .pipe(
      z
        .string()
        .min(1, "거래처를 입력하세요.")
        .max(
          CUSTOMER_MAX,
          `거래처는 ${CUSTOMER_MAX}자까지 입력할 수 있습니다.`,
        ),
    ),
  occurredOn: dateOnly,
  amount,
  dueOn: optionalDate,
  note: z
    .string()
    .transform((v) => v.trim())
    .pipe(
      z.string().max(NOTE_MAX, `비고는 ${NOTE_MAX}자까지 입력할 수 있습니다.`),
    )
    .transform((v) => (v === "" ? null : v)),
});

export const createReceivableSchema = receivableFieldsSchema;
export type CreateReceivableInput = z.input<typeof createReceivableSchema>;

export const updateReceivableSchema = receivableFieldsSchema.extend({
  id,
  expectedUpdatedAt,
  /** 수금 완료 건 수정 시 수금일 (팀장만, 미수 건이면 null) */
  collectedOn: optionalDate,
});
export type UpdateReceivableInput = z.input<typeof updateReceivableSchema>;

export const collectReceivableSchema = z.object({
  id,
  expectedUpdatedAt,
  collectedOn: dateOnly,
});
export type CollectReceivableInput = z.input<typeof collectReceivableSchema>;

/** 수금 취소·숨김·복구 */
export const rowActionSchema = z.object({ id, expectedUpdatedAt });
export type RowActionInput = z.input<typeof rowActionSchema>;
