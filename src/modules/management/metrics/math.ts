// 금액은 BigInt로 계산하고, 비율만 number로 바꾼다.
// (금액은 원 단위 정수라 2^53 ≈ 9천조 원 아래에서는 Number 변환이 정확하다)
import type { Change } from "./types";

export function sum(values: bigint[]): bigint {
  return values.reduce((acc, value) => acc + value, 0n);
}

/** part ÷ whole. whole이 0이면 null */
export function ratio(part: bigint, whole: bigint): number | null {
  if (whole === 0n) return null;
  return Number(part) / Number(whole);
}

/** (current − base) ÷ |base|. base가 null이면 no-data, 0이면 zero-base */
export function changeRate(current: bigint, base: bigint | null): Change {
  if (base === null) return { rate: null, reason: "no-data" };
  if (base === 0n) return { rate: null, reason: "zero-base" };
  const diff = current - base;
  const abs = base < 0n ? -base : base;
  return { rate: Number(diff) / Number(abs) };
}
