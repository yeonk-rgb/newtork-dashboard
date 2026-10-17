// AI 분석 코멘트: 응답 형식(Zod) + 생성 요청 검증
import { z } from "zod";

export const SUMMARY_MAX = 400;
export const ITEM_MAX = 200;

/** AI 응답 — 구조화 출력의 JSON 스키마로도 쓰고, 받은 뒤 한 번 더 검증한다 */
export const aiCommentResultSchema = z.object({
  /** 이번 분기 매출 현황 요약 2~3문장 */
  summary: z.string().trim().min(1).max(SUMMARY_MAX),
  /** 부족한 점 (최대 3개, 각 1문장) */
  weaknesses: z.array(z.string().trim().min(1).max(ITEM_MAX)).max(3),
  /** 다음 분기 개선 제안 (최대 3개, 각 1문장) */
  improvements: z.array(z.string().trim().min(1).max(ITEM_MAX)).max(3),
});
export type AiCommentResult = z.infer<typeof aiCommentResultSchema>;

export const generateAiCommentSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  quarter: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  /** 화면을 열 때 본 최신 코멘트 id (없으면 null) — 동시 생성 확인용 */
  expectedLatestId: z.string().min(1).max(64).nullable(),
});
export type GenerateAiCommentInput = z.input<typeof generateAiCommentSchema>;
