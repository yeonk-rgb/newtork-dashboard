// 제조내역 수정 입력 검증 (화면·Server Action 공용). 시트·일련번호는 식별 키라 고치지 않는다 (친구 저장소 serializer 와 같음)
import { z } from "zod";

import { INDUSTRIES } from "@/shared/contracts/production";

import { COLUMNS, type RecordField } from "../upload/columns";

/** 수정 창에서 고치는 칸 (일련번호 제외 엑셀 칸 + 수량) */
export const EDITABLE_FIELDS = COLUMNS.map((c) => c.field).filter(
  (f): f is Exclude<RecordField, "serialNo"> => f !== "serialNo",
);

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const dateField = z
  .string()
  .trim()
  .refine(
    (v) => {
      if (v === "") return true;
      if (!DATE.test(v)) return false;
      const d = new Date(`${v}T00:00:00Z`);
      return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(v);
    },
    { message: "날짜는 YYYY-MM-DD 형식으로 입력하세요." },
  );

const textField = z.string().trim().max(300, "300자 이하로 입력하세요.");

const fieldSchemas = Object.fromEntries(
  COLUMNS.filter((c) => c.field !== "serialNo").map((c) => [
    c.field,
    c.kind === "date" ? dateField : textField,
  ]),
) as Record<(typeof EDITABLE_FIELDS)[number], z.ZodString>;

export const recordEditSchema = z.object({
  id: z.string().min(1),
  /** 동시 수정 확인 (불러올 때의 updatedAt ISO) */
  updatedAt: z.string().min(1),
  ...fieldSchemas,
  quantity: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\d{1,6}$/.test(v), {
      message: "수량은 0 이상 정수로 입력하세요 (모르면 비워 두기).",
    }),
  /** 사업구분 — 같은 수주번호 전체에 적용. "" = 미분류 */
  category: z.enum(["", ...INDUSTRIES.map((i) => i.key)]),
});

export type RecordEditInput = z.input<typeof recordEditSchema>;
