// 배포 서버의 AI 분석 허용 여부 (서버 전용)
// 외부 AI 전송 동의(05-19) 전에는 배포 서버(next start)에서 [분석하기]를 막는다 — AI_ALLOW_REAL_DATA=true 일 때만 허용
// next dev·테스트(로컬 샘플 DB)는 영향 없음
import "server-only";

export function isAiRealDataBlocked(): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  return process.env.AI_ALLOW_REAL_DATA !== "true";
}
