// AI 분석 코멘트: 응답 형식(Zod) + 저장 형식 + 옛 형식 읽기 + 생성 요청 검증
import { z } from "zod";

/** 프롬프트는 문장당 60자, 검증은 80자 — 넘으면 실패시키지 않고 그 문장만 잘라 표시 */
export const SENTENCE_PROMPT_MAX = 60;
export const SENTENCE_MAX = 80;
const ELLIPSIS = "…";

/**
 * AI 응답(구조화 출력의 JSON 스키마). 개수·길이 제한은 넣지 않고
 * 받은 뒤 normalizeAiComment 에서 정리한다 (61~80자·4번째 문장 때문에 분석 전체가 실패하지 않게)
 */
export const aiCommentResponseSchema = z.object({
  /** 매출 현황 2~3문장 — 첫 문장 분기 목표 달성률, 둘째 문장 연간 진도 */
  summary: z.array(z.string()),
  /** 부족한 점 0~3개, 중요한 순서 */
  shortfalls: z.array(z.string()),
  /** 다음 분기 개선 제안 1~3개, shortfalls 와 짝 */
  improvements: z.array(z.string()),
});
export type AiCommentResponse = z.infer<typeof aiCommentResponseSchema>;

const sentence = z.string().min(1).max(SENTENCE_MAX);

/** 서버가 붙이는 부분 (AI 가 만들지 않음 — annotations.ts). 프롬프트 v2 이전 기록에는 없다 */
const annotationFields = {
  /** 연간 목표 달성 한 줄 */
  headline: z.string().min(1).max(200).optional(),
  /** 장기 미수금 거래처 (금액 큰 순, 최대 3곳) — 2026-10-26부터 외상매출금 장기 미수금, 그 전 기록은 90일 초과 + 경과일 */
  longOverdue: z
    .array(
      z.object({
        name: z.string().min(1).max(100),
        amount: z.string().min(1).max(30),
        /** 옛 기록(90일 초과 건별)만 — 외상매출금에는 발생일이 없어 새 기록에는 없음 */
        ageDays: z.number().int().min(0).optional(),
      }),
    )
    .max(3)
    .optional(),
};

/** DB 에 저장하는 형식 (새로 저장하는 것은 항상 이 형식) */
export const aiCommentResultSchema = z.object({
  summary: z.array(sentence).min(1).max(3),
  shortfalls: z.array(sentence).max(3),
  improvements: z.array(sentence).max(3),
  ...annotationFields,
});
export type AiCommentResult = z.infer<typeof aiCommentResultSchema>;

export type NormalizeReport = {
  /** 80자를 넘어 잘린 문장 수 */
  truncated: number;
  /** 3개를 넘어 버린 문장 수 */
  dropped: number;
};

/** 문장 다듬기: 공백 정리, 빈 문장 제거, 80자 초과는 79자 + "…" */
function cleanSentences(list: string[], report: NormalizeReport): string[] {
  const cleaned = list
    .map((s) => s.replace(/\s+/g, " ").trim())
    .filter((s) => s !== "")
    .map((s) => {
      // 한글 등 조합 문자가 깨지지 않게 코드 포인트 단위로 자른다
      const chars = [...s];
      if (chars.length <= SENTENCE_MAX) return s;
      report.truncated += 1;
      return `${chars.slice(0, SENTENCE_MAX - 1).join("")}${ELLIPSIS}`;
    });
  if (cleaned.length > 3) report.dropped += cleaned.length - 3;
  return cleaned.slice(0, 3);
}

/**
 * AI 응답 → 저장 형식. 매출 현황 문장이 하나도 없을 때만 실패(null).
 * 길이·개수 초과는 잘라서 살린다 (잘린 수는 report 로 알려 로그에 남긴다)
 */
export function normalizeAiComment(
  response: AiCommentResponse,
): { result: AiCommentResult; report: NormalizeReport } | null {
  const report: NormalizeReport = { truncated: 0, dropped: 0 };
  const result = {
    summary: cleanSentences(response.summary, report),
    shortfalls: cleanSentences(response.shortfalls, report),
    improvements: cleanSentences(response.improvements, report),
  };
  const parsed = aiCommentResultSchema.safeParse(result);
  return parsed.success ? { result: parsed.data, report } : null;
}

/** 8단계 첫 버전(PROMPT_VERSION 2026-10-17.1)의 저장 형식 — 화면 읽기만 지원 */
const legacyResultSchema = z.object({
  summary: z.string().min(1),
  weaknesses: z.array(z.string()),
  improvements: z.array(z.string()),
});

/** 화면 표시용: 새 형식 그대로, 옛 형식은 새 모양으로 바꿔 읽는다 (DB 는 바꾸지 않음) */
export type AiCommentDisplay = AiCommentResult & { legacy: boolean };

export function readStoredComment(json: unknown): AiCommentDisplay | null {
  const current = aiCommentResultSchema.safeParse(json);
  if (current.success) return { ...current.data, legacy: false };
  const legacy = legacyResultSchema.safeParse(json);
  if (legacy.success) {
    return {
      summary: [legacy.data.summary],
      shortfalls: legacy.data.weaknesses,
      improvements: legacy.data.improvements,
      legacy: true,
    };
  }
  return null;
}

export const generateAiCommentSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  quarter: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  /** 화면을 열 때 본 최신 코멘트 id (없으면 null) — 동시 생성 확인용 */
  expectedLatestId: z.string().min(1).max(64).nullable(),
  /** 관리자(대표)가 외부 AI 전송 확인창에서 [확인]을 눌렀는지 (aiAbilities().consentNotice 가 있을 때만 필요) */
  consent: z.boolean().optional(),
});
export type GenerateAiCommentInput = z.input<typeof generateAiCommentSchema>;
