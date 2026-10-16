// 금액 입력칸: 숫자만, 자동 콤마, 커서 위치 유지 (순수 함수 — 테스트용으로 분리)

/** 최대 15자리 (999조 원 미만) */
export const MAX_DIGITS = 15;

/** 입력 문자열에서 숫자만 남기고 앞의 0 제거, 최대 자리수 제한. 빈 값은 "" */
export function digitsOnly(raw: string): string {
  const digits = raw.replace(/\D/g, "").replace(/^0+(?=\d)/, "");
  return digits.slice(0, MAX_DIGITS);
}

/** "1234567" → "1,234,567" */
export function formatDigits(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * 콤마를 다시 넣은 뒤 커서를 원래 숫자 뒤에 두기 위한 위치.
 * @param digitsBeforeCaret 커서 앞에 있던 숫자 개수
 */
export function caretAfterFormat(
  formatted: string,
  digitsBeforeCaret: number,
): number {
  if (digitsBeforeCaret <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) seen++;
    if (seen === digitsBeforeCaret) return i + 1;
  }
  return formatted.length;
}

/** 빈칸은 0원으로 본다 (CLAUDE.md: 임시저장 시 빈 칸은 0으로 저장) */
export function digitsToBigInt(digits: string): bigint {
  return digits === "" ? 0n : BigInt(digits);
}
