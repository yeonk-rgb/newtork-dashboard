"use client";
// 표 행 전체를 누르면 이동 (친구 앱 "행을 누르면 상세") — 키보드는 행 안의 링크로
import { useRouter } from "next/navigation";

import { cn } from "@/shared/lib/utils";

export function RowLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <tr
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a, button")) return;
        router.push(href);
      }}
      className={cn(
        "cursor-pointer border-b last:border-0 hover:bg-primary-50",
        className,
      )}
    >
      {children}
    </tr>
  );
}
