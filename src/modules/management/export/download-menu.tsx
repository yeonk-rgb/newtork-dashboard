"use client";
// [엑셀 다운로드 ▾] 공용 메뉴 — 경영지원 열람 권한이면 누구나 (서버가 can() 으로 다시 확인)
// fetch 로 받아 오류(권한·양식 파일 없음·기록 실패 등)를 화면에 보여 준다. 파일 이름은 서버 Content-Disposition 그대로
import { ChevronDown, Download } from "lucide-react";
import { useState } from "react";

import { cn } from "@/shared/lib/utils";
import { buttonSecondaryClass } from "@/shared/ui/styles";

/** Content-Disposition 의 filename*=UTF-8''… (없으면 filename="…") */
export function fileNameFrom(header: string | null, fallback: string): string {
  const star = /filename\*=UTF-8''([^;]+)/i.exec(header ?? "");
  if (star) return decodeURIComponent(star[1]);
  const plain = /filename="([^"]+)"/i.exec(header ?? "");
  return plain ? plain[1] : fallback;
}

export type DownloadItem = {
  label: string;
  /** 요청 주소 (/api/management/…) */
  href: string;
  /** 메뉴에 보이는 파일 이름 */
  fileName: string;
  /** 응답에 파일 이름이 없을 때 */
  fallbackName: string;
};

export function DownloadMenu({
  items,
  note,
  menuWidthClass = "w-56",
}: {
  items: DownloadItem[];
  /** 메뉴 아래 안내 한 줄 */
  note?: string;
  menuWidthClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const download = async (item: DownloadItem) => {
    setOpen(false);
    setError(null);
    setPending(item.href);
    try {
      const res = await fetch(item.href, { cache: "no-store" });
      if (!res.ok) {
        setError(await res.text());
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileNameFrom(
        res.headers.get("Content-Disposition"),
        item.fallbackName,
      );
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("내려받지 못했습니다. 네트워크를 확인하고 다시 시도하세요.");
    } finally {
      setPending(null);
    }
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={pending !== null}
        onClick={() => setOpen((v) => !v)}
        className={buttonSecondaryClass}
      >
        <Download className="size-4" aria-hidden />
        {pending ? "만드는 중…" : "엑셀 다운로드"}
        <ChevronDown className="size-4" aria-hidden />
      </button>
      {open && (
        <ul
          role="menu"
          className={cn(
            "absolute right-0 z-10 mt-1 rounded-lg border bg-card p-1 shadow-md",
            menuWidthClass,
          )}
        >
          {items.map((item) => (
            <li key={item.href} role="none">
              <button
                type="button"
                role="menuitem"
                onClick={() => download(item)}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-primary-50"
              >
                <span>{item.label}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {item.fileName}
                </span>
              </button>
            </li>
          ))}
          {note && (
            <li
              role="none"
              className="px-3 pt-1 pb-2 text-xs text-muted-foreground"
            >
              {note}
            </li>
          )}
        </ul>
      )}
      {error && (
        <p
          role="alert"
          className="absolute right-0 mt-1 w-72 rounded-lg bg-danger-soft p-2 text-xs text-danger-strong"
        >
          {error}
        </p>
      )}
    </div>
  );
}
