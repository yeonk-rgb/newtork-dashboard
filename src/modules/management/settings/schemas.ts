// 목표·항목 설정 저장 요청 검증 (Zod) + 항목 이름 중복 검사 (화면·서버 공용 순수 함수)
import { z } from "zod";

import { MAX_DIGITS } from "../entry/money-input";

const digits = z
  .string()
  .regex(
    new RegExp(`^\\d{0,${MAX_DIGITS}}$`),
    "금액은 숫자만 15자리까지 입력할 수 있습니다.",
  );

export const saveTargetSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  revenueTarget: digits
    // 형식이 틀린 값도 refine 이 실행되므로 BigInt 변환 전에 숫자인지 먼저 확인 (예외 대신 검증 실패로)
    .refine(
      (v) => /^\d+$/.test(v) && BigInt(v) > 0n,
      "연간 목표매출액을 입력하세요.",
    )
    .transform((v) => BigInt(v)),
  /** 1~4분기 (빈칸 = 자동 배분) */
  quarters: z
    .tuple([digits, digits, digits, digits])
    .transform(
      (qs) =>
        qs.map((q) => (q === "" ? null : BigInt(q))) as [
          bigint | null,
          bigint | null,
          bigint | null,
          bigint | null,
        ],
    ),
  /** 직원 수 (명, 빈칸 = 입력 안 함) — 인당 생산성 */
  headcount: z
    .string()
    .regex(/^\d{0,4}$/, "직원 수는 숫자만 4자리까지 입력할 수 있습니다.")
    .refine((v) => v === "" || Number(v) > 0, "직원 수는 1명 이상입니다.")
    .optional()
    .transform((v) => (v ? Number(v) : null)),
  expectedUpdatedAt: z.iso.datetime().nullable(),
});
export type SaveTargetInput = z.input<typeof saveTargetSchema>;

export const COST_TYPES = ["FIXED", "VARIABLE"] as const;
export const NAME_MAX = 30;

export const saveCategoriesSchema = z.object({
  /** 화면 순서대로 (sortOrder = 순번) */
  items: z
    .array(
      z.object({
        /** null = 새 항목 */
        id: z.string().min(1).max(64).nullable(),
        name: z
          .string()
          .transform((v) => v.trim().replace(/\s+/g, " "))
          .pipe(
            z
              .string()
              .min(1, "항목 이름을 입력하세요.")
              .max(
                NAME_MAX,
                `항목 이름은 ${NAME_MAX}자까지 입력할 수 있습니다.`,
              ),
          ),
        costType: z.enum(COST_TYPES).nullable(),
        isActive: z.boolean(),
      }),
    )
    .max(100),
  deletedIds: z.array(z.string().min(1).max(64)).max(100),
  /** 불러올 때의 항목 버전 — 동시 수정 확인 */
  version: z.string(),
});
export type SaveCategoriesInput = z.input<typeof saveCategoriesSchema>;

/** 이름 비교용: 앞뒤 공백 제거, 연속 공백 하나로, 대소문자 무시 */
export function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

/** 이름 문제가 있는 행 번호 → 메시지 (빈 이름, 너무 김, 중복) */
export function categoryNameErrors(names: string[]): Map<number, string> {
  const errors = new Map<number, string>();
  const seen = new Map<string, number>();
  names.forEach((name, i) => {
    const key = normalizeName(name);
    if (key === "") {
      errors.set(i, "항목 이름을 입력하세요.");
      return;
    }
    if (name.trim().length > NAME_MAX) {
      errors.set(i, `${NAME_MAX}자까지 입력할 수 있습니다.`);
      return;
    }
    const first = seen.get(key);
    if (first !== undefined) {
      errors.set(i, "같은 이름의 항목이 이미 있습니다.");
      if (!errors.has(first))
        errors.set(first, "같은 이름의 항목이 이미 있습니다.");
    } else {
      seen.set(key, i);
    }
  });
  return errors;
}
