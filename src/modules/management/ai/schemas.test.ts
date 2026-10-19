import { describe, expect, it } from "vitest";

import {
  aiCommentResultSchema,
  normalizeAiComment,
  readStoredComment,
  SENTENCE_MAX,
} from "./schemas";

const ok = {
  summary: [
    "분기 목표 대비 82.4%로 17.6%p 부족입니다.",
    "연간 진도는 뒤처집니다.",
  ],
  shortfalls: [],
  improvements: ["9월 실적을 확정합니다."],
};

describe("normalizeAiComment", () => {
  it("정상 응답은 그대로", () => {
    expect(normalizeAiComment(ok)).toEqual({
      result: ok,
      report: { truncated: 0, dropped: 0 },
    });
  });

  it("80자 초과 문장은 실패시키지 않고 79자 + … 로 자른다", () => {
    const long = "가".repeat(SENTENCE_MAX + 5);
    const exact = "나".repeat(SENTENCE_MAX);
    const normalized = normalizeAiComment({
      ...ok,
      shortfalls: [long, exact],
    })!;
    expect(normalized.result.shortfalls[0]).toBe(`${"가".repeat(79)}…`);
    expect([...normalized.result.shortfalls[0]].length).toBe(SENTENCE_MAX);
    expect(normalized.result.shortfalls[1]).toBe(exact);
    expect(normalized.report).toEqual({ truncated: 1, dropped: 0 });
  });

  it("3개를 넘으면 앞의 3개만, 빈 문장·공백은 정리", () => {
    const normalized = normalizeAiComment({
      summary: ["  첫  문장 ", "", "둘째", "셋째", "넷째"],
      shortfalls: ["   "],
      improvements: ["a", "b", "c", "d"],
    })!;
    expect(normalized.result).toEqual({
      summary: ["첫 문장", "둘째", "셋째"],
      shortfalls: [],
      improvements: ["a", "b", "c"],
    });
    expect(normalized.report).toEqual({ truncated: 0, dropped: 2 });
  });

  it("매출 현황 문장이 하나도 없을 때만 실패", () => {
    expect(normalizeAiComment({ ...ok, summary: [] })).toBeNull();
    expect(normalizeAiComment({ ...ok, summary: [" "] })).toBeNull();
  });
});

describe("readStoredComment", () => {
  it("새 형식", () => {
    expect(readStoredComment(ok)).toEqual({ ...ok, legacy: false });
  });

  it("옛 형식(문자열 요약 + weaknesses)도 화면에서 읽는다", () => {
    expect(
      readStoredComment({
        summary: "3분기 매출은 6억 원입니다. 목표 대비 60%입니다.",
        weaknesses: ["목표 미달"],
        improvements: ["9월 확정"],
      }),
    ).toEqual({
      summary: ["3분기 매출은 6억 원입니다. 목표 대비 60%입니다."],
      shortfalls: ["목표 미달"],
      improvements: ["9월 확정"],
      legacy: true,
    });
  });

  it("알 수 없는 형식은 null", () => {
    expect(readStoredComment({ foo: 1 })).toBeNull();
    expect(readStoredComment(null)).toBeNull();
  });
});

describe("aiCommentResultSchema (새로 저장하는 형식)", () => {
  it("옛 형식은 저장 형식으로 통과하지 않는다", () => {
    expect(
      aiCommentResultSchema.safeParse({
        summary: "문자열",
        weaknesses: [],
        improvements: [],
      }).success,
    ).toBe(false);
  });

  it("문장 81자·4개는 저장 형식 위반 (normalize 를 거쳐야 함)", () => {
    expect(
      aiCommentResultSchema.safeParse({
        ...ok,
        improvements: ["가".repeat(81)],
      }).success,
    ).toBe(false);
    expect(
      aiCommentResultSchema.safeParse({
        ...ok,
        shortfalls: ["1", "2", "3", "4"],
      }).success,
    ).toBe(false);
  });
});
