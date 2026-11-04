// 출장보고서 입력 검증 (화면·Server Action 공용) — 친구 저장소 ServiceReportSerializer 규칙 그대로
// 지역은 공식 목록으로 검증하고, 둘 다 비었고 주소가 있으면 같은 규칙으로 판정 (사람이 고른 값은 주소로 덮어쓰지 않음)
import { z } from "zod";

import { isValidRegion, parseAddress, SIGUNGU } from "../regions/regions";

const text = (max: number) => z.string().trim().max(max).default("");
const day = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), {
    message: "날짜는 YYYY-MM-DD 형식이어야 합니다.",
  })
  .default("");
/** 수량 — 빈 칸·없음 = null (미입력) */
const qty = (min: number) =>
  z.preprocess(
    (v) =>
      v === undefined || v === null || String(v).trim() === ""
        ? null
        : Number(v),
    z
      .number()
      .int(`수량은 ${min} 이상의 정수로 입력하세요.`)
      .min(min, `수량은 ${min} 이상의 정수로 입력하세요.`)
      .nullable(),
  );

export const reportInputSchema = z
  .object({
    title: z.string().trim().min(1, "출장 목적을 입력하세요.").max(300),
    status: text(30),
    requestOrgType: text(50),
    requestOrg: text(200),
    siteContact: text(200),
    address: text(300),
    region: z.string().trim().max(20).default(""),
    sigungu: z.string().trim().max(20).default(""),
    tripStart: day,
    tripEnd: day,
    extraTrip: text(100),
    authorName: text(50),
    /** 한국 시간 "YYYY-MM-DDTHH:mm" */
    writtenAt: z
      .string()
      .trim()
      .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v), {
        message: "작성일 형식이 올바르지 않습니다.",
      })
      .default(""),
    happyCallDate: day,
    workType: text(50),
    faultDescription: text(5000),
    workDescription: text(5000),
    workResult: text(5000),
    billing: z.enum(["PAID", "FREE", ""]).default(""),
    quoteType: text(50),
    quote: text(300),
    approver: text(50),
    cc: text(200),
    note: text(5000),
    companions: z.array(z.string().max(50)).default([]),
    products: z
      .array(
        z.object({
          modelName: z.string().trim().min(1, "모델명을 입력하세요.").max(50),
          spec: text(200),
          serialNo: text(50),
          quantity: qty(0),
        }),
      )
      .default([]),
    parts: z
      .array(
        z.object({
          name: z.string().trim().min(1, "부품명을 입력하세요.").max(200),
          quantity: qty(1),
        }),
      )
      .default([])
      .refine((ps) => new Set(ps.map((p) => p.name)).size === ps.length, {
        message: "같은 부품이 두 번 들어 있습니다.",
      }),
  })
  .transform((v, ctx) => {
    if (v.tripStart && v.tripEnd && v.tripEnd < v.tripStart) {
      ctx.addIssue({
        code: "custom",
        path: ["tripEnd"],
        message: "출장 종료일이 시작일보다 빠릅니다.",
      });
    }
    // 동행자: 앞뒤 공백 제거, 빈 이름·중복 제외 (순서 유지)
    const companions = [
      ...new Set(v.companions.map((c) => c.trim()).filter(Boolean)),
    ];
    let region: string | null = v.region || null;
    let sigungu: string | null = region ? v.sigungu || null : null;
    if (region === null && sigungu === null && v.address) {
      ({ region, sigungu } = parseAddress(v.address));
    } else if (region !== null && !(region in SIGUNGU)) {
      ctx.addIssue({
        code: "custom",
        path: ["region"],
        message: "공식 시·도 목록에 없는 이름입니다.",
      });
    } else if (!isValidRegion(region, sigungu)) {
      ctx.addIssue({
        code: "custom",
        path: ["sigungu"],
        message: `${region}에 없는 시·군·구입니다.`,
      });
    }
    return { ...v, companions, region, sigungu };
  });

export type ReportInput = z.input<typeof reportInputSchema>;
export type ReportValues = z.output<typeof reportInputSchema>;

/** 검증 오류 → { 칸: 문구 } (제품·부품 목록 안 오류는 목록 이름으로) */
export function fieldErrors(error: z.ZodError) {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    out[key] ??= issue.message;
  }
  return out;
}
