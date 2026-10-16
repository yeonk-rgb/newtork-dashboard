import {
  formatWon,
  formatWonCompact,
  type AmountInput,
} from "@/shared/format/money";

/**
 * 금액 표시: 화면에는 축약("4.8억"), 마우스를 올리면 원 단위 전체 금액.
 * 스크린 리더에는 전체 금액을 읽어 준다. (string = serializeBigInt 결과)
 */
export function Won({
  value,
  unit = false,
  className,
}: {
  value: AmountInput;
  /** 축약 뒤에 "원" 붙이기 */
  unit?: boolean;
  className?: string;
}) {
  const full = formatWon(value);
  return (
    <span title={full} className={className}>
      <span aria-hidden>
        {formatWonCompact(value)}
        {unit && "원"}
      </span>
      <span className="sr-only">{full}</span>
    </span>
  );
}
