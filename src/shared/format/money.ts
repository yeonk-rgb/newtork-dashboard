// 금액 표시 유틸. 저장은 정수(원, BigInt), 소수 계산·반올림은 표시 단계에서만 한다.

/** 금액으로 받을 수 있는 값. string은 bigint를 직렬화한 정수 문자열("-1234")만 허용한다. */
export type AmountInput = bigint | number | string;

const wonFormatter = new Intl.NumberFormat("ko-KR", {
  maximumFractionDigits: 0,
});

const INTEGER_STRING = /^-?\d+$/;

function toFormattable(value: AmountInput): bigint | number {
  if (typeof value === "string") {
    if (!INTEGER_STRING.test(value)) {
      throw new TypeError(`금액 문자열은 정수여야 합니다: "${value}"`);
    }
    return BigInt(value);
  }
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new TypeError(`금액이 유한한 숫자가 아닙니다: ${value}`);
  }
  return value;
}

/** 1234000n → "1,234,000" (number는 원 단위로 반올림) */
export function formatAmount(value: AmountInput): string {
  return wonFormatter.format(toFormattable(value));
}

/** 1234000n → "1,234,000원" */
export function formatWon(value: AmountInput): string {
  return `${formatAmount(value)}원`;
}
