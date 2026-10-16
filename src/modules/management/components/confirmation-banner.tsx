import { CircleAlert, Info } from "lucide-react";

import { cn } from "@/shared/lib/utils";

import type { Confirmation } from "../metrics/types";
import { confirmationNotice } from "./confirmation-text";

/** 미확정·마감 전 월이 있으면 안내 (아이콘 + 문구, 색만으로 구분하지 않음) */
export function ConfirmationBanner({
  confirmation,
}: {
  confirmation: Confirmation;
}) {
  const notice = confirmationNotice(confirmation);
  if (!notice) return null;

  const Icon = notice.tone === "warning" ? CircleAlert : Info;
  return (
    <p
      role="status"
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
        notice.tone === "warning"
          ? "border-amber-300 bg-amber-50 text-amber-950"
          : "border-border bg-card text-foreground",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>
        <span className="font-semibold">
          {notice.tone === "warning" ? "확인 필요 · " : "안내 · "}
        </span>
        {notice.message}
      </span>
    </p>
  );
}
