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
  /** 축약 뒤에 "원" 붙이기. "subtle" = KPI 큰 숫자용 — "원"을 숫자보다 작고 연하게 */
  unit?: boolean | "subtle";
  className?: string;
}) {
  const full = formatWon(value);
  return (
    <span title={full} className={className}>
      <span aria-hidden>
        {formatWonCompact(value)}
        {unit === "subtle" ? (
          <span className="ml-1 text-[0.55em] font-medium tracking-normal text-muted-foreground">
            원
          </span>
        ) : (
          unit && "원"
        )}
      </span>
      <span className="sr-only">{full}</span>
    </span>
  );
}
