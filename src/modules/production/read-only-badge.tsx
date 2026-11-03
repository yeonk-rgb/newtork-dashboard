// 생산팀원(열람만) 화면 표시 — 버튼은 숨기지 않고 비활성으로 두고 제목 옆에 이 배지 (2026-11-03 사용자 지시)
import { cn } from "@/shared/lib/utils";
import { pillClass } from "@/shared/ui/styles";

import { READ_ONLY_LABEL } from "./rules";

export function ReadOnlyBadge({ note }: { note?: string }) {
  return (
    <span className="inline-flex items-center gap-2 align-middle">
      <span className={cn(pillClass, "bg-muted text-muted-foreground")}>
        {READ_ONLY_LABEL}
      </span>
      {note && (
        <span className="text-xs font-normal text-muted-foreground">
          {note}
        </span>
      )}
    </span>
  );
}
