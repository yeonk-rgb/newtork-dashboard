// AI 분석에 회사 실제 숫자를 보내도 되는지 (서버 전용)
// 외부 AI 전송 동의(05-19) = AI_ALLOW_REAL_DATA=true 하나로 두 차단을 같이 푼다 (2026-10-26 결정):
// 1) 배포 서버(next start)의 [분석하기] 차단 — next dev·테스트(로컬 샘플 DB)는 원래 막지 않음
// 2) 엑셀 업로드로 옮긴 달(실제 숫자)이 AI 입력에 들어가는 분기 차단 — 개발 서버에서도 막음
// 어느 경우에도 외부로 보내는 것은 buildAiInput() 의 합계 숫자뿐 (거래처명·직원 이름·건별 내역 제외)
import "server-only";

/** 대표님 허락 — AI_ALLOW_REAL_DATA=true */
export function isAiRealDataAllowed(): boolean {
  return process.env.AI_ALLOW_REAL_DATA === "true";
}

export function isAiRealDataBlocked(): boolean {
  if (process.env.NODE_ENV !== "production") return false;
  return !isAiRealDataAllowed();
}

/** 엑셀 업로드로 옮긴 달이 들어간 분기: 허락 전에는 막고, 허락하면 분석한다 */
export function isUploadedDataBlocked(hasUploadedInput: boolean): boolean {
  return hasUploadedInput && !isAiRealDataAllowed();
}
