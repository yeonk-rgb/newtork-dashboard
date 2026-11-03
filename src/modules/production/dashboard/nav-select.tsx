"use client";
// 고르면 그 주소로 이동하는 선택 상자 (연도·분류별 판매량 기간·납기 예정 월)
import { useRouter } from "next/navigation";

export function NavSelect({
  label,
  value,
  options,
  className,
}: {
  label: string;
  value: string;
  options: { value: string; label: string; href: string }[];
  className?: string;
}) {
  const router = useRouter();
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => {
        const o = options.find((x) => x.value === e.target.value);
        if (o) router.push(o.href, { scroll: false });
      }}
      className={
        className ??
        "h-10 rounded-lg border border-input bg-background px-3 text-sm hover:bg-primary-50"
      }
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
