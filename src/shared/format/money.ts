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

const EOK = 100_000_000n; // 억
const MAN = 10_000n; // 만

function toBigInt(value: AmountInput): bigint {
  const v = toFormattable(value);
  return typeof v === "bigint" ? v : BigInt(Math.round(v));
}

/** a ÷ b 반올림 (a ≥ 0) */
function roundDiv(a: bigint, b: bigint): bigint {
  return (a + b / 2n) / b;
}

/**
 * 큰 금액 축약 (단위 "원"은 붙이지 않음)
 * - 1억 이상: 소수 첫째 자리까지 "2.5억", "28억"
 * - 1만 이상: "4,817만" (만 단위 반올림)
 * - 그 미만: "9,500"
 * 전체 금액은 formatWon()으로 함께 보여준다 (마우스 오버 등)
 */
export function formatWonCompact(value: AmountInput): string {
  const v = toBigInt(value);
  const sign = v < 0n ? "-" : "";
  const abs = v < 0n ? -v : v;

  const man = roundDiv(abs, MAN);
  if (abs >= EOK || man >= 10_000n) {
    const tenths = roundDiv(abs, EOK / 10n); // 0.1억 단위
    const whole = tenths / 10n;
    const decimal = tenths % 10n;
    return `${sign}${wonFormatter.format(whole)}${decimal === 0n ? "" : `.${decimal}`}억`;
  }
  if (abs >= MAN) return `${sign}${wonFormatter.format(man)}만`;
  return `${sign}${wonFormatter.format(abs)}`;
}

/**
 * 보고서용 짧은 금액 (AI 분석 카드·입력): "7.09억원", "6,668만원", "40.00억원"
 * - 1억 이상: 억 단위 소수 둘째 자리 (0.01억 = 100만 원 단위 반올림)
 * - 1만 이상 1억 미만: 만 원 단위 반올림 "6,668만원" (반올림해 1억이 되면 "1.00억원")
 * - 1만 원 미만: 원 단위 "9,500원", 0 은 "0원"
 * - 음수: 앞에 "-" ("-1.23억원")
 */
export function formatWonShort(value: AmountInput): string {
  const v = toBigInt(value);
  const sign = v < 0n ? "-" : "";
  const abs = v < 0n ? -v : v;

  if (abs < MAN) return `${sign}${wonFormatter.format(abs)}원`;
  const man = roundDiv(abs, MAN);
  if (man < 10_000n) return `${sign}${wonFormatter.format(man)}만원`;
  const hundredths = roundDiv(abs, EOK / 100n); // 0.01억 단위
  const whole = hundredths / 100n;
  const fraction = String(hundredths % 100n).padStart(2, "0");
  return `${sign}${wonFormatter.format(whole)}.${fraction}억원`;
}
