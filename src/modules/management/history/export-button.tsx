"use client";
// 변경 이력 [엑셀 내려받기] — 관리자(대표)에게만 보인다 (서버도 다시 확인). 지금 필터 그대로
// fetch 로 받아 오류(기간이 너무 김·권한 등)를 화면에 보여 준다
import { Download } from "lucide-react";
import { useState } from "react";

import { buttonSecondaryClass } from "@/shared/ui/styles";

import { fileNameFrom } from "../ledger/export/export-menu";

export function HistoryExportButton({ search }: { search: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async () => {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/management/history/export?${search}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = fileNameFrom(
        res.headers.get("Content-Disposition"),
        "audit-log.xlsx",
      );
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("내려받지 못했습니다. 네트워크를 확인하고 다시 시도하세요.");
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={download}
        disabled={pending}
        className={buttonSecondaryClass}
      >
        <Download className="size-4" aria-hidden />
        {pending ? "만드는 중…" : "엑셀 내려받기"}
      </button>
      {error && (
        <p
          role="alert"
          className="max-w-xs text-right text-xs text-destructive"
        >
          {error}
        </p>
      )}
    </div>
  );
}
